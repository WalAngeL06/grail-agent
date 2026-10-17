import json

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
    assert "RUN_DRY_RUN" in capsys.readouterr().out


def test_run_cli_writes_v05_state_with_offline_market(cfg_dict, tmp_path, monkeypatch, capsys):
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
    assert state["contract_version"] == "0.5" and len(state["decisions"]) == 5
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
