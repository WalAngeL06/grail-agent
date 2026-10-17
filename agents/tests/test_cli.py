import json

import pytest

from grail_agents import __main__ as cli
from test_loop import Market


def test_run_cli_requires_explicit_simulated_chain(cfg_dict, tmp_path, monkeypatch, capsys):
    path = tmp_path / "config.json"
    path.write_text(json.dumps(cfg_dict))
    monkeypatch.setattr(cli, "AtkClient", lambda: (_ for _ in ()).throw(AssertionError("must not construct ATK")))
    assert cli.main(["run", "--config", str(path), "--cycles", "1", "--runtime", str(tmp_path / "runtime")]) == 1
    assert "CHAIN_REQUIRED" in capsys.readouterr().out


def test_run_cli_refuses_live_config(cfg_dict, tmp_path, monkeypatch, capsys):
    cfg_dict["dry_run"] = False
    path = tmp_path / "config.json"
    path.write_text(json.dumps(cfg_dict))
    monkeypatch.setattr(cli, "AtkClient", lambda: (_ for _ in ()).throw(AssertionError("must not construct ATK")))
    assert cli.main(["run", "--config", str(path), "--chain", "simulated", "--cycles", "1", "--runtime", str(tmp_path / "runtime")]) == 1
    assert "LIVE_CONFIRMATION" in capsys.readouterr().out


@pytest.mark.parametrize('command,dry_run,chain,flags,error', [
    ('run', False, 'fuji', [], 'LIVE_CONFIRMATION'),
    ('run', False, 'fuji', ['--live'], 'LIVE_CONFIRMATION'),
    ('run', False, 'fuji', ['--confirm-live', 'GRAIL-LIVE-SPOT'], 'LIVE_CONFIRMATION'),
    ('run', False, 'fuji', ['--live', '--confirm-live', 'wrong'], 'LIVE_CONFIRMATION'),
    ('run', False, 'simulated', ['--live', '--confirm-live', 'GRAIL-LIVE-SPOT'], 'LIVE_CHAIN'),
    ('run', False, None, ['--live', '--confirm-live', 'GRAIL-LIVE-SPOT'], 'LIVE_CHAIN'),
    ('run', True, 'fuji', ['--live', '--confirm-live', 'GRAIL-LIVE-SPOT'], 'LIVE_CONFIG'),
    ('run', True, 'simulated', ['--live'], 'LIVE_CONFIG'),
    ('run', True, 'simulated', ['--confirm-live', ''], 'LIVE_CONFIG'),
    ('smoke', True, None, ['--live'], 'LIVE_FLAGS'),
    ('smoke', True, None, ['--confirm-live', 'GRAIL-LIVE-SPOT'], 'LIVE_FLAGS'),
])
def test_live_cli_rejects_incomplete_activation_before_any_effect(cfg_dict, tmp_path, monkeypatch, capsys, command, dry_run, chain, flags, error):
    cfg_dict['dry_run'] = dry_run
    path = tmp_path / 'config.json'
    path.write_text(json.dumps(cfg_dict))
    def forbidden(*args, **kwargs):
        pytest.fail('invalid activation must not construct clients, chains or providers')
    for name in ('AtkClient', 'FujiChain', 'SimulatedChain', 'load_provider'):
        monkeypatch.setattr(cli, name, forbidden)
    argv = [command, '--config', str(path), '--cycles', '1', '--runtime', str(tmp_path / 'runtime'), *flags]
    if chain:
        argv += ['--chain', chain]
    assert cli.main(argv) == 1
    assert error in capsys.readouterr().out
    assert not (tmp_path / 'runtime').exists()


def test_run_cli_writes_v06_state_with_offline_market(cfg_dict, tmp_path, monkeypatch, capsys):
    path = tmp_path / "config.json"
    path.write_text(json.dumps(cfg_dict))
    monkeypatch.setattr(cli, "AtkClient", lambda: Market(cfg_dict["coins"]))
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("GRAIL_ENV", raising=False)
    root = tmp_path / "runtime"
    assert cli.main(["run", "--config", str(path), "--chain", "simulated", "--cycles", "1", "--runtime", str(root)]) == 0
    output = json.loads(capsys.readouterr().out)
    assert output["chain_simulated"] is True and output["commits"] == output["reveals"] == 1
    state = json.loads((root / "state.json").read_text())
    assert state["contract_version"] == "0.6" and len(state["decisions"]) == 5
    assert "ledger" not in state and state["chain"]["agent_id"] is None


def test_grail_env_only_passes_llm_settings_to_provider(tmp_path, monkeypatch):
    path = tmp_path / "main.env"
    path.write_text("LLM_API_KEY=fake-value\nLLM_MODEL=test-model\nAGENT_PRIVATE_KEY=do-not-pass\n")
    monkeypatch.setenv("GRAIL_ENV", str(path))
    captured = []
    monkeypatch.setattr(cli, "make_provider", lambda env: captured.append(env))
    cli.load_provider()
    assert captured[0]["LLM_API_KEY"] == "fake-value"
    assert captured[0]["LLM_MODEL"] == "test-model"
    assert set(captured[0]) <= {"LLM_API_KEY", "LLM_MODEL", "LLM_PROVIDER"}


def test_cli_reports_degraded_chain_without_traceback(cfg_dict, tmp_path, monkeypatch, capsys):
    from grail_agents.chain import SimulatedChain
    from grail_agents.config import GrailError
    path = tmp_path / 'config.json'
    path.write_text(json.dumps(cfg_dict))
    class UnavailableChain(SimulatedChain):
        def next_cycle_id(self):
            raise GrailError('CHAIN_RPC: read unavailable')
        def info(self):
            raise GrailError('CHAIN_RPC: read unavailable')
    monkeypatch.setattr(cli, 'SimulatedChain', lambda path: UnavailableChain())
    monkeypatch.setattr(cli, 'AtkClient', lambda: Market(cfg_dict['coins']))
    monkeypatch.setattr(cli, 'load_provider', lambda: None)
    assert cli.main(['run', '--config', str(path), '--chain', 'simulated', '--cycles', '1', '--runtime', str(tmp_path / 'runtime')]) == 1
    result = json.loads(capsys.readouterr().out)
    assert result['ok'] is False and result['errors'] > 0
