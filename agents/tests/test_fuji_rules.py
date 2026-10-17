import json

from grail_agents.loop import AgentLoop
from grail_agents.storage import CycleStore
from test_loop import fixed_decide, Market, rig
from grail_agents.chain import SimulatedChain
from grail_agents.config import GrailError


def test_cycle_floor_survives_restart_and_never_moves_backwards(tmp_path):
    store = CycleStore(tmp_path)
    assert store.allocate_cycle(minimum=42) == 42
    assert CycleStore(tmp_path).allocate_cycle(minimum=3) == 43


def test_new_runtime_starts_above_largest_chain_cycle(cfg_dict, tmp_path):
    cfg_dict['coins'] = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT']
    chain = SimulatedChain()
    chain.commit(99, '0x' + '01' * 32)
    loop = AgentLoop(cfg_dict, Market(cfg_dict['coins']), chain, tmp_path, decide_fn=fixed_decide)
    state = loop.run_once()
    assert state['agent']['cycle_id'] == 100
    assert chain.lookup(100)['revealed']


def test_reveal_summary_excludes_no_orders_and_normalizes_unknown():
    record = {'payload': {'decisions': [{'inst_id': 'SOL-USDT', 'action': 'HOLD'}, {'inst_id': 'BTC-USDT', 'action': 'BUY'}, {'inst_id': 'ETH-USDT', 'action': 'SELL'}]}, 'orders': {'SOL-USDT': {'order_status': 'hold'}, 'BTC-USDT': {'order_status': 'blocked'}, 'ETH-USDT': {'order_status': 'unknown'}}}
    assert AgentLoop._order_summary(record) == '{"ETH-USDT":"unknown"}'
    record['orders']['ETH-USDT'] = {'order_status': 'rejected'}
    assert AgentLoop._order_summary(record) == ''
    record['orders']['BTC-USDT'] = {'order_status': 'simulated'}
    record['orders']['ETH-USDT'] = {'order_status': 'filled', 'okx_order_id': '123'}
    assert AgentLoop._order_summary(record) == '{"BTC-USDT":"simulated","ETH-USDT":"123"}'


def test_simulated_orders_are_queried_before_reveal(rig, monkeypatch):
    _, _, chain, orders, events, create = rig
    original = orders.query
    def queried(client_id):
        events.append('query')
        return original(client_id)
    monkeypatch.setattr(orders, 'query', queried)
    create().run_once()
    assert events.count('query') == 2
    assert events.index('execute') < events.index('query') < events.index('reveal')
    assert json.loads(chain.lookup(1)['okx_order_id']) == {'BTC-USDT': 'simulated', 'ETH-USDT': 'simulated'}


def test_status_query_failure_retains_the_known_order_identity(rig, monkeypatch):
    _, _, chain, orders, _, create = rig
    # Model the exchange boundary only; no network or actual live execution.
    monkeypatch.setattr(orders, 'execute', lambda *a, **kw: {'order_status': 'filled', 'okx_order_id': '42', 'fill_price': '100'})
    def failed_query(client_id):
        raise GrailError('ATK_TIMEOUT: status read unavailable')
    monkeypatch.setattr(orders, 'query', failed_query)
    state = create().run_once()
    row = next(d for d in state['decisions'] if d['inst_id'] == 'BTC-USDT')
    assert row['order_status'] == 'unknown'
    assert row['okx_order_id'] == '42'
    assert json.loads(chain.lookup(1)['okx_order_id'])['BTC-USDT'] == '42'
