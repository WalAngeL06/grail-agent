# GRAIL agents — T-002

Python 3.11+ thin adapter over installed OKX Agent Trade Kit CLI (`@okx_ai/okx-trade-cli`, verified 1.4.8). No runtime Python dependencies. Uses `grail` profile; never reads or stores its API keys. Current contracts: 0.4. Does not implement the agent loop/commit/reveal (T-006).

From the repository's `agents/` directory:

```powershell
uv run pytest -q
uv run python -m grail_agents smoke --config ../contracts/config.example.json
```

Tests are offline and use fake exchange responses. The smoke reads the real trading account and configured spot instruments/tickers/closed candles, then simulates one minimum-config-size BUY. It refuses `dry_run: false` before contacting ATK. Its output contains account balances, so keep it private. No secret is printed. Test/runtime files stay under ignored `runtime/`.

## Read boundary

Every invocation fixes `--profile grail --site tr --live --json`, the TR API host `https://tr.okx.com`, and runs without a shell. Read queries are limited to market ticker/candles/instruments, account balance, and spot get/orders. Credential/base-URL environment overrides cannot route a call to another account/site. No network retry or site fallback occurs. Errors expose stable codes, never raw exchange stdout/stderr.

**Approved task-card deviation:** CLI 1.4.8 rejects `--read-only` (that switch is not a CLI capability). The user explicitly approved the closed read-query allowlist instead. The installed CLI version is preserved. No OAuth/login/config mutation is performed.

An unsupported/suspended/non-USDT spot instrument fails with `ATK_INSTRUMENT` naming the coin and `field: coins`; the integrator can turn that into an engine `validate_config` issue. `minSz` is in base currency, `lotSz` is the base-size step, `tickSz` the price step; the smoke also reports the exchange minimum's current USDT equivalent. USDT portfolio equity is calculated from cash and priced holdings, never from `totalEq` (USD). TRY dust is valued using the inverse public USDT-TRY ticker and included as a synthetic TRY-USDT position marked `tradable: false` / `valuation_pair: USDT-TRY`; available USDT cash excludes TRY. That synthetic ID is never submitted as an order. Any other unpriced holding stops execution, so exposure is never silently omitted.

## Python interfaces for T-006

```python
from grail_agents.atk import AtkClient
from grail_agents.config import AgentConfig
from grail_agents.market import fetch_snapshot
from grail_agents.orders import OrderService
from grail_agents.journal import OrderJournal

cfg = AgentConfig.from_mapping(config_dict)
client = AtkClient()
snapshot = fetch_snapshot(client, cfg)
# snapshot['market'] / ['portfolio'] match contracts/state.example.json.
# snapshot['candles'] maps instId -> raw OKX rows, oldest first;
# only confirmed bars are kept, exactly lookback_bars + 1 per coin.
service = OrderService(client, cfg, snapshot['instruments'])
result = service.execute(
    decision, snapshot['portfolio'], client_order_id='grailCycle12BTC'
)
```

`decision` consumes `inst_id`, `action` (BUY/SELL), `size_usdt`, `ref_price`, optional `dry_run`/`mode` (must match config). HOLD goes straight to the T-006 ledger and needs no order call. The adapter raises `GrailError` on invalid configuration/data/risk; the loop must catch it, record a contract error and skip that order.

Execution accepts only USDT spot market/limit orders in cash mode. It checks configured coins, positive finite amounts, minimum/maximum order size, total held exposure plus reservations, cash/base availability and drawdown (`>= kill_switch_drawdown_pct`). Limits enforce lot/minimum/tick precision; market BUY uses quote currency and `banAmend` so the exchange cannot enlarge it. Market SELL size is based on the decision reference price; actual proceeds can vary with the execution price. Market BUY's estimated base amount is not a fill; simulations have `fill_price: null` and no exchange order ID.

Repeated calls with the same ID/intent are idempotent; a changed intent with that ID fails. Keep one `OrderService` per dry-run portfolio/session so its reservations cover the entire batch. A simulation does not alter the real portfolio; T-006 owns any simulated portfolio accounting.

## Live execution prerequisites (not run during development)

Live execution needs all of: user-owned config `dry_run: false`, explicit user confirmation passed as `live_confirmed=True`, and `OrderJournal` at one shared persistent `runtime/orders.sqlite3` path for this account. The caller must provide a persisted `portfolio['peak_equity_usdt']`; do not reset the peak every cycle. T-006 must first commit the decision successfully on Avalanche. This adapter does not assert or perform that chain precondition.

Before a new live submission the service refreshes instruments, account prices/balance and open orders; an open order outside its journal blocks execution. Journal locking serializes fresh balance reads with reservation updates. Pending/partial orders reserve their whole intended notional (conservative when balances also reflect partial fills). Query terminal orders with `service.query(client_order_id)` to release the reservation against the next fresh balance; this never sends an order. Use the same journal across restarts and workers, and a unique 1–32 character alphanumeric client ID per decision/order.

Intent is committed to the journal **before** submission. Timeout, failed/malformed acknowledgment or process crash leaves an unknown record; the next action queries that same client ID. An unknown lookup is never permission to resubmit, and blocks new live intents until resolved. Submission acknowledgments mean `pending`, not filled. State queries map OKX to pending/partial/filled/canceled/unknown.

Only internal `AtkClient._place_spot` is a write boundary; application callers must use `OrderService.execute`. There are no withdrawal, transfer, leverage or account-setting methods. The smoke exposes no live-trading flag or command. First live order remains a separate user-observed acceptance step, after chain integration.
