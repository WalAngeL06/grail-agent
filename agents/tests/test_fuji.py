from copy import deepcopy
import json
from pathlib import Path

import pytest
from eth_tester import EthereumTester, PyEVMBackend
from web3 import Web3, EthereumTesterProvider
from web3.logs import DISCARD

from grail_agents.config import GrailError
from grail_agents.payload import commitment
from grail_agents import chain as chain_module


class FujiTestProvider(EthereumTesterProvider):
    def make_request(self, method, params):
        if method == 'eth_chainId':
            return {'id': 1, 'jsonrpc': '2.0', 'result': 43113}
        return super().make_request(method, params)


@pytest.fixture
def evm(tmp_path):
    backend = PyEVMBackend()
    w3 = Web3(FujiTestProvider(EthereumTester(backend=backend)))
    descriptor = json.loads((Path(__file__).parents[2] / 'contracts/chain.json').read_text())
    sender = w3.eth.accounts[0]
    def deploy(name, *args):
        code = json.loads((Path(__file__).parent / 'fixtures' / (name + '.json')).read_text())['bytecode']
        factory = w3.eth.contract(abi=descriptor['contracts'][name]['abi'], bytecode=code)
        receipt = w3.eth.wait_for_transaction_receipt(factory.constructor(*args).transact({'from': sender}))
        descriptor['contracts'][name].update(address=receipt.contractAddress, deployTx=receipt.transactionHash.to_0x_hex())
        return w3.eth.contract(address=receipt.contractAddress, abi=factory.abi)
    registry = deploy('IdentityRegistry')
    tx = registry.get_function_by_signature('register(string)')('data:test').transact({'from': sender})
    registered = registry.events.Registered().process_receipt(w3.eth.wait_for_transaction_receipt(tx), errors=DISCARD)
    descriptor['agentId'] = str(registered[0]['args']['agentId'])
    ledger = deploy('GrailLedger', registry.address)
    descriptor['agentWallet'] = sender
    path = tmp_path / 'chain.json'
    path.write_text(json.dumps(descriptor))
    settings = {'AGENT_PRIVATE_KEY': backend.account_keys[0].to_hex(), 'AGENT_ADDRESS': sender}
    return w3, descriptor, ledger, settings, path, tmp_path / 'runtime'


def adapter(evm):
    w3, _, _, settings, path, runtime = evm
    cls = getattr(chain_module, 'FujiChain', None)
    assert cls is not None, 'real Fuji adapter is missing'
    return cls(path, runtime, settings=settings, web3=w3, receipt_timeout=0.05)


def test_signed_commit_and_reveal_are_verified_on_real_local_evm(evm):
    chain = adapter(evm)
    salt = '0x' + '11' * 32
    digest = commitment('{}', salt)
    commit_tx = chain.commit(9, digest)
    assert commit_tx.startswith('0x') and len(commit_tx) == 66
    assert chain.lookup(9)['commit_hash'] == digest
    assert chain.next_cycle_id() == 10
    reveal_tx = chain.reveal(9, '{}', salt, '{"BTC-USDT":"simulated"}')
    assert chain.lookup(9)['revealed'] is True
    assert chain.lookup(9)['commit_tx'] == commit_tx
    assert chain.lookup(9)['reveal_tx'] == reveal_tx
    info = chain.info()
    assert info['commits'] == info['reveals'] == 1 and info['unrevealed'] == 0
    assert info['simulated'] is False and info['agent_id'] == evm[1]['agentId']
    assert adapter(evm).next_cycle_id() == 10
    with pytest.raises(GrailError, match='DUPLICATE'):
        chain.commit(9, digest)
    with pytest.raises(GrailError, match='REVEAL'):
        chain.reveal(9, '{}', salt, '')


def test_bad_vector_identity_and_network_are_rejected_before_signing(evm):
    w3, descriptor, _, settings, path, runtime = evm
    cls = getattr(chain_module, 'FujiChain', None)
    assert cls is not None, 'real Fuji adapter is missing'
    bad = deepcopy(descriptor)
    bad['testVector']['commitHash'] = '0x' + '00' * 32
    path.write_text(json.dumps(bad))
    with pytest.raises(GrailError, match='VECTOR'):
        cls(path, runtime, settings=settings, web3=w3)
    path.write_text(json.dumps(descriptor))
    with pytest.raises(GrailError, match='IDENTITY'):
        cls(path, runtime, settings={**settings, 'AGENT_ADDRESS': w3.eth.accounts[1]}, web3=w3)
    wrong = deepcopy(descriptor)
    wrong['chainId'] = 1
    path.write_text(json.dumps(wrong))
    with pytest.raises(GrailError, match='NETWORK'):
        cls(path, runtime, settings=settings, web3=w3)


def test_broadcast_is_journaled_before_effect_and_timeout_never_resends(evm, monkeypatch):
    chain = adapter(evm)
    w3, _, _, _, _, runtime = evm
    send = w3.eth.send_raw_transaction
    calls = []
    def unknown(raw):
        records = json.loads((runtime / 'fuji-transactions.json').read_text())
        assert list(records['transactions'].values())[0]['tx_hash'] == Web3.keccak(raw).to_0x_hex()
        calls.append(raw)
        raise TimeoutError('do-not-log-secret')
    monkeypatch.setattr(w3.eth, 'send_raw_transaction', unknown)
    digest = commitment('{}', '0x' + '11' * 32)
    with pytest.raises(GrailError, match='UNKNOWN'):
        chain.commit(1, digest)
    with pytest.raises(GrailError, match='UNKNOWN'):
        adapter(evm).commit(1, digest)
    assert len(calls) == 1
    # The original signed tx later appears on chain; only query, never broadcast again.
    send(calls[0])
    assert adapter(evm).lookup(1)['commit_hash'] == digest
    assert len(calls) == 1


def test_mined_but_response_lost_is_reconciled_by_signed_hash(evm, monkeypatch):
    chain = adapter(evm)
    w3 = evm[0]
    original = w3.eth.send_raw_transaction
    def lost(raw):
        original(raw)
        raise TimeoutError('do-not-log-secret')
    monkeypatch.setattr(w3.eth, 'send_raw_transaction', lost)
    tx = chain.commit(7, commitment('{}', '0x' + '11' * 32))
    assert chain.lookup(7)['commit_tx'] == tx
    assert chain.info()['commits'] == 1


def test_reverted_real_evm_commit_never_executes_order(evm, cfg_dict, monkeypatch):
    from grail_agents.loop import AgentLoop
    from test_loop import fixed_decide, Market
    chain = adapter(evm)
    # Enough intrinsic gas to mine, insufficient to execute the storage writes.
    monkeypatch.setattr(evm[0].eth, 'estimate_gas', lambda *a, **kw: 24000)
    cfg_dict['coins'] = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT']
    class NoOrders:
        def execute(self, *a, **kw):
            pytest.fail('reverted commit must not reach execute')
    loop = AgentLoop(cfg_dict, Market(cfg_dict['coins']), chain, evm[5], decide_fn=fixed_decide, orders=NoOrders())
    state = loop.run_once()
    assert state['agent']['status'] == 'degraded'
    assert state['errors'][-1]['code'] == 'CHAIN_TX_REVERTED'
    assert chain.lookup(1) is None
    assert state['chain']['commits'] == state['chain']['reveals'] == 0
    assert list((evm[5] / 'pending').glob('*.json'))


def test_fuji_cli_uses_real_chain_boundary_with_dry_run_only(evm, cfg_dict, monkeypatch, capsys):
    from grail_agents import __main__ as cli
    from test_loop import Market
    chain = adapter(evm)
    config = evm[5].parent / 'config.json'
    config.write_text(json.dumps(cfg_dict))
    monkeypatch.setattr(cli, 'AtkClient', lambda: Market(cfg_dict['coins']))
    monkeypatch.setattr(cli, 'load_provider', lambda: None)
    monkeypatch.setattr(cli, 'FujiChain', lambda path, runtime: chain, raising=False)
    assert cli.main(['run', '--config', str(config), '--chain', 'fuji', '--chain-file', str(evm[4]), '--cycles', '1', '--runtime', str(evm[5])]) == 0
    result = json.loads(capsys.readouterr().out)
    assert result['chain_simulated'] is False
    assert result['commits'] == result['reveals'] == 1


def test_fuji_rpc_log_limit_of_100_blocks_is_respected(evm):
    chain = adapter(evm)
    ranges = []
    class Event:
        def get_logs(self, *, from_block, to_block, argument_filters):
            ranges.append(to_block - from_block + 1)
            assert to_block - from_block < 100
            return []
    assert chain._logs(Event(), end=chain.start_block + 251) == []
    assert ranges == [100, 100, 52]
