# T-006 acceptance — simulated-chain phase, contracts 0.5

2026-10-17, Europe/Istanbul. Role agents, branch role/agents. User requested R-002-1/R-002-2 first, then an offline-testable chain interface/fake adapter while deployment is pending. No real order, wallet use or chain transaction occurred.

## Review fixes

- `ef5aecd`: definite structured nonzero exchange sCode with empty order ID -> terminal rejected with safe rejection_code. Works with raw array/envelope JSON and nonzero CLI exit. Text errors, malformed/contradictory responses and timeout stay unknown. Requery of a rejected record cannot turn it back into unknown. Next distinct intent can execute.
- Before a new live intent, unknown/pending/partial orders are automatically queried before the fresh portfolio/budget check. Regression reproduces 29.40 USDT cash, first BUY 10 filled, remaining 19.40: the second BUY 10 is allowed.
- All live-path tests use fakes; no real rejection/order was triggered to test CLI behavior. The local installed CLI source was inspected; no raw stderr text is accepted as proof of a definitive rejection.

## Automated checks

From `agents/`:

| Command | Actual result |
|---|---|
| `uv run pytest -q --tb=short` | 121 passed, 1 skipped, 3.38s |
| `uv run pytest -q ../engine/tests ../analyst/tests --tb=short` | 84 passed, 1.13s |
| `uv run python -m grail_agents --help` | exit 0 |

All tests are offline. The sole skip is the `contracts/chain.json` deployment testVector: the file is absent, and no vector was invented. The Ethereum empty-input Keccak reference vector passes; canonical JSON sorting, ASCII escaping, analyst fields, fresh 32-byte salts and hash validation are tested.

Recovery proof includes a **real subprocess** terminated with `os._exit(23)` immediately after the fake ledger persisted its commit, before the loop could save its receipt. Fresh adapter/loop instances recovered the identical payload/salt, performed one reveal, and never recommitted or sent an order. Additional tests cover reveal failure, live unknown/pending-ID queries, corrupt pending JSON, provider absence/timeout/bad JSON, BUY reduction/veto, SELL exempt, HOLD-only cycles, persistent peak/cycle IDs, continued cycles after errors, single runner lease and safe stop status.

One test run observed `STORAGE_WRITE`; the isolated rerun passed. Its original exception class was hidden by old redaction, so the exact original cause was not proven. Safe exception-type diagnostics and a targeted transient-PermissionError regression were added; atomic replacement retries once after 20ms. This is a local file operation only; network/chain/order submissions are never retried. Subsequent full suites and actual-read smoke passed.

## Actual ATK-read cycle, simulated chain

```powershell
uv run python -m grail_agents run --config ../contracts/config.example.json --chain simulated --cycles 1 --runtime runtime/t006-smoke
```

Actual output:

```json
{"ok":true,"chain_simulated":true,"cycle_id":1,"errors":0,"commits":1,"reveals":1}
```

The runner read all five configured instruments/tickers/49 confirmed bars and real portfolio data from OKX TR. Real engine + analyst fallback produced five BUY decisions, each executed as `simulated` / `llm_flag=skipped`. The fake ledger committed and revealed once. State is contracts 0.5, dry_run=true, agent status stopped, five decision rows, no separate ledger array. Identity fields are null, transaction IDs start `simulated:`, verified=false. Pending directory is empty after reveal.

Output file (ignored): `agents/runtime/t006-smoke/state.json`. Web may point `GRAIL_STATE_PATH` at its absolute path. No web files or shared contracts/STATE files were edited.

## Real-chain follow-up

- Supply and merge `contracts/chain.json` from T-003; run its actual testVector, then implement the confirmed ChainAdapter using the deployed ABI, verified agent identity and existing wallet configuration.
- Demonstrate a real Fuji commit/reveal with dry_run still true before enabling any real order. This phase does not satisfy the real-transaction 15:00 gate.
- Public state publishes payload/salt only after reveal; unrevealed cycles remain private pending records and visible through counters/errors. Rounded execution sizes use additive execution_size_* fields; committed decision fields remain exact.
- R-002-3 (SELL market-value sizing) and R-002-4 (unpriced non-config holdings) remain outside the two fixes requested in this phase; existing documented fail-closed behavior remains. Full independent review is pending.
