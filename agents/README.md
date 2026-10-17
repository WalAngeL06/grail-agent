# GRAIL agents — T-002 + T-006

Python 3.11+ integration over installed OKX Agent Trade Kit CLI (`@okx_ai/okx-trade-cli`, verified 1.4.8), local editable `grail-engine` / `grail-analyst`, Ethereum Keccak and Web3. Uses `grail` profile; never reads or stores its API keys. Current contracts: 0.5. T-006 includes the autonomous cycle, restart recovery and real Fuji GrailLedger adapter using `contracts/chain.json`.

From the repository's `agents/` directory:

```powershell
uv run pytest -q
uv run python -m grail_agents smoke --config ../contracts/config.example.json
uv run python -m grail_agents run --config ../contracts/config.example.json --chain simulated --cycles 1 --runtime runtime/demo
```

## Agent cycle (T-006)

The `run` command requires explicit `--chain simulated` or `--chain fuji` and refuses `dry_run=false`. Both read real ATK market/account data and simulate orders; `fuji` sends real testnet ledger transactions. Omit `--cycles` for continuous execution at the configured interval (example: 90 seconds). Ctrl+C stops the process and updates agent status. Only one continuous runner can own a runtime, including between cycles; use one stable runtime per signer/ledger and stop an old process before starting another. The OS releases its lock after a crash.

The cycle validates engine config, fetches market/portfolio data, runs the quant engine, applies `analyst.review_payload`, then writes the **final** canonical payload and a fresh 32-byte salt to `runtime/pending/<cycle_id>.json` before commit. A confirmed commit is required before any BUY/SELL execution. HOLD-only cycles also commit and reveal. Order guard failure is an outcome and never rewrites the committed decision. Execution is followed by an order-status query (local for simulation). The reveal uses exactly the recorded bytes/salt. R-003's `okxOrderId` is sorted compact JSON mapping instrument to an actual order ID, `simulated` or `unknown`; HOLD/blocked/rejected-without-ID entries are excluded, and no orders yields the empty string. A query failure preserves any known order ID and records an unknown status.

`AgentLoop(config, client, chain, runtime, provider=None, news_source=None)` exposes `run_once()`, `recover()` and `run(cycles=None, stop_event=None)`. Real engine/analyst are defaults. A missing provider yields `skipped`; SELL remains `exempt`. To enable the configured provider, set `GRAIL_ENV` to the **existing main checkout's** `.env` path, or provide LLM settings through the process environment. Only `LLM_API_KEY`, `LLM_MODEL`, `LLM_PROVIDER` are extracted; no `.env` copy is made and the wallet key is not passed to the provider. Process LLM values take precedence. Provider timeout is enforced by the analyst (at most 8 seconds). No news provider is invented: absent `news_source` supplies an empty news list.

Runtime files: atomic `state.json`, `control.json` (next cycle ID / persisted peak equity), private `pending/*.json`, `fuji-transactions.json` (signed hashes/nonces/intents; no key or raw signed transaction), persistent `simulated-chain.json`, and for future live execution `orders.sqlite3`. Keep this directory across restarts. Recovery queries chain state first, reveals confirmed outstanding commits, queries missing/uncertain live order identities by their recorded client IDs, and never recommits, resends an order or reruns the analyst. Each new cycle starts above the chain's largest own-agent committed cycle ID and the persistent local floor; the commit count is never used as a cycle ID. A missing/unknown chain commitment remains pending for later checks. Corrupt pending JSON blocks new effects but reports an error without killing the runner. Replacement of a locally locked Windows JSON file gets one bounded retry; network/order/chain effects are never retried automatically.

State follows contracts 0.5: configured limits and verified identity fields, analyst fields preserved in `decisions[]`, no separate `ledger[]`. Only successfully revealed cycles publish `payload_utf8`/`salt_hex`; private pending records cover unrevealed cycles, visible through chain counters/errors. Execution rounding is recorded separately as `execution_size_usdt` / `execution_size_base`. History is bounded to 500 decision rows and 100 errors. `SimulatedChain` uses `simulated:` transaction identifiers, null identity/address/network ID and `verified=false`, so it cannot masquerade as a Fuji confirmation. `GRAIL_STATE_PATH` in the web process can point to this runner's absolute `state.json` path; no web files are changed here.

### Real Fuji ledger

`chain.py` exports `FujiChain` and defines `ChainAdapter.next_cycle_id()`, `lookup(cycle_id)`, `commit(cycle_id, commit_hash)`, `reveal(cycle_id, payload_utf8, salt_hex, okx_order_id)` and `info()`. Commit/reveal return after successful receipt, canonical block and event/state verification. The signed hash and nonce are persisted before the single broadcast. A timeout is resolved by that hash; no resubmission is attempted, including when the process restarts. An unresolved previous transaction blocks a new transaction. `lookup` returns confirmed commit hash/transaction and revealed/reveal transaction fields. `info` supplies the v0.5 chain metadata and counters, with verified string `agent_id` and registry address.

Before signing, `FujiChain` checks the deployment testVector, Fuji chainId 43113, deployed ledger/registry code, their linkage, agent authorization, and signer/deployment wallet identity. Read settings come from process environment or the existing main checkout's `GRAIL_ENV`: `AGENT_PRIVATE_KEY`, `AGENT_ADDRESS`, optional `FUJI_RPC_URL` / `AVAX_RPC_URL`, `AVAX_CHAIN_ID`. No keys are written into runtime or reports. The chain descriptor defaults to the repository's `contracts/chain.json`; override with `--chain-file`.

```powershell
$env:GRAIL_ENV = 'C:/Users/Serdar Arif/Desktop/Agentic Hack/.env'
# Acceptance used this explicit Fuji endpoint after the configured endpoint returned HTTP 429.
$env:FUJI_RPC_URL = 'https://avalanche-fuji-c-chain-rpc.publicnode.com'
uv run python -m grail_agents run --config ../contracts/config.example.json --chain fuji --cycles 1 --runtime runtime/t006-fuji-gate
```

The 14:50 Fuji gate is verified in `FUJI-GATE-T-006.json`: cycle 1, one real commit, five simulated BUYs, one real reveal, zero errors, no remaining pending record. The read-only verifier independently matched receipts, events, revealed bytes/salt and Keccak. No actual OKX order was sent. For the existing acceptance run, web can set `GRAIL_STATE_PATH` to `C:/Users/Serdar Arif/Desktop/Agentic Hack-wt/agents/agents/runtime/t006-fuji-gate/state.json`. A new runtime still reads the chain floor, but cannot recover another runtime's private salt/pending records.

Tests are offline with fake exchange responses and a local real EVM running fixtures compiled from `chain/contracts/{IdentityRegistry,GrailLedger}.sol` at fdd4bf0. Dev dependencies are `eth-tester` and `py-evm`; install them as separate packages, since the `eth-tester[py-evm]` extra requests a Windows source-build SHA3 backend. The smoke reads the real trading account and configured spot instruments/tickers/closed candles, then simulates one minimum-config-size BUY. It refuses `dry_run: false` before contacting ATK. Its output contains account balances, so keep it private. No secret is printed. Runtime files stay under ignored `runtime/`.

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

Before a new live submission the service reconciles unknown/pending/partial journal records, then refreshes instruments, account prices/balance and open orders; an open order outside its journal blocks execution. Journal locking serializes fresh balance reads with reservation updates. Still-pending/partial orders reserve their whole intended notional (conservative when balances also reflect partial fills). Well-formed explicit nonzero exchange `sCode` rejections with no order ID are terminal `rejected` records with `rejection_code`; malformed responses/timeouts stay unknown. Rejected records never turn into unknown when queried. Use the same journal across restarts and workers, and a unique 1–32 character alphanumeric client ID per decision/order.

Intent is committed to the journal **before** submission. Timeout, failed/malformed acknowledgment or process crash leaves an unknown record; the next action queries that same client ID. An unknown lookup is never permission to resubmit, and blocks new live intents until resolved. Submission acknowledgments mean `pending`, not filled. State queries map OKX to pending/partial/filled/canceled/unknown.

Only internal `AtkClient._place_spot` is a write boundary; application callers must use `OrderService.execute`. There are no withdrawal, transfer, leverage or account-setting methods. The smoke exposes no live-trading flag or command. First live order remains a separate user-observed acceptance step, after chain integration.
