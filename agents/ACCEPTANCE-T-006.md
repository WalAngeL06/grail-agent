# T-006 acceptance — real Fuji dry-run gate, contracts 0.5

2026-10-17 14:50 Europe/Istanbul. Role agents, branch role/agents. Main descriptor source: 9bc78e3, merged as 0010c9c. No actual OKX order was sent; dry_run remained true.

## Verified 15:00 gate

- Fuji chainId: 43113; ledger: 0x1B5fcf6DeFf2F9375338A2C35932224522118851; agentId: 1.
- Cycle 1: real ATK market/account reads -> real engine -> analyst fallback (skipped, no provider key) -> real confirmed commit -> five simulated BUY orders, queried locally -> real confirmed reveal.
- Commit: 0x7b47c4f313ffa5630d1acfff6411f11c6d13c321bbc69649ec8c90976995f728, status 1, block 59596837.
- Reveal: 0x541cb8ff88aac0248fbf79d7997915b62bb08fb873e226bbefc35cbcec77cf45, status 1, block 59596842.
- commitHash: 0xd9064ac4000cae4637a50cd3f25b4ae7c9612e9c9600772f7468533371785a83.
- Revealed okxOrderId: `{"AVAX-USDT":"simulated","BTC-USDT":"simulated","ETH-USDT":"simulated","OKB-USDT":"simulated","SOL-USDT":"simulated"}`.
- Runner exit 0, errors 0, commits 1, reveals 1, pending empty, status stopped. State v0.5, verified=true, order_status=simulated, no exchange ordId or fictitious fill.
- Separate read-only Web3 verification checked chainId, both receipts (status/from/to/canonical blockHash), agentId/cycleId events, exact payload bytes, independent Keccak(payload+salt), canonical result mapping, and on-chain committed/revealed flags. Machine-readable proof: `FUJI-GATE-T-006.json`.

Command, from agents/:

```powershell
$env:GRAIL_ENV = 'C:/Users/Serdar Arif/Desktop/Agentic Hack/.env'
$env:FUJI_RPC_URL = 'https://avalanche-fuji-c-chain-rpc.publicnode.com'
uv run python -m grail_agents run --config ../contracts/config.example.json --chain fuji --cycles 1 --runtime runtime/t006-fuji-gate
```

The configured AVAX_RPC_URL returned Cloudflare HTTP 429 during the first run; that run stopped before any transaction or order. The alternate explicit process endpoint was verified as 43113 before use; .env was unchanged. No automatic provider fallback or broadcast retry exists. The default endpoint also enforces a maximum 100-block log range; pagination has a regression test. CLI failures with unavailable chain metadata now return structured failure rather than a traceback.

## Checks

| Command (from agents/) | Actual result |
|---|---|
| `uv run pytest -q --tb=short` | 135 passed, 8.30s |
| `uv run pytest -q ../engine/tests ../analyst/tests --tb=short` | 84 passed, 1.11s |
| chain.json testVector | Exact Keccak match, no skip |
| Actual Fuji run above | exit 0, one commit/reveal, five simulated orders, errors=0 |
| Independent read-only chain verification | Passed; evidence JSON generated at 14:50:50 +03:00 |

Offline local EVM tests execute compiled IdentityRegistry/GrailLedger fixtures from chain@fdd4bf0. They cover signed commit/reveal, verified receipts/events/counters, a chain cycle gap (cycle 9 -> next 10 on restart), invalid vector/identity/network, journal-before-broadcast, unknown broadcast without any resend, lost response after mining, and a mined status=0 commit reaching no order execution. Additional R-003 tests cover monotonic persistent floors, empty no-order summary, canonical simulated/unknown/ordId mapping, order query before reveal, and preserving a known order ID when its status query fails.

Existing loop tests cover BUY reduction/veto matching commit/execution/reveal, unchanged exempt SELL, provider absence/timeout/bad output, HOLD commits, recovery without recommit or analyst invocation, unknown order lookup, corrupt pending storage, single-runner locking and scheduling. A real subprocess is killed after its *simulated-ledger* commit and recovered using identical bytes/salt; a forced process kill during an actual Fuji cycle was not performed. Local EVM timeout/receipt reconciliation and the actual normal Fuji cycle are separate evidence.

## Runtime and review handoff

- UI state (ignored): `C:/Users/Serdar Arif/Desktop/Agentic Hack-wt/agents/agents/runtime/t006-fuji-gate/state.json`; web owner can point GRAIL_STATE_PATH here. This role did not change web/.
- Keep the runtime: its pending salt/payload, control/peak, transaction hash/nonce journal and future orders.sqlite3 are recovery data. On a fresh runtime the next cycle is read from the largest own-agent DecisionCommitted cycleId, checked against commitCount; local counters never move backwards.
- Pending bytes/salt are published in state.decisions only after successful reveal. Guard outcomes never change committed decision fields; rounded execution sizes have separate execution_size_* fields.
- Commit receipt/event/state must confirm before execute. Unknown transactions only get queried by durable signed hash; no automatic resend. One runner/runtime per signer/ledger is required.
- At the original Fuji gate, live orders were disabled by the CLI. The R-004 follow-up adds explicit activation for separate review; no actual live order was run. R-002-1/2 fixes have regressions; R-002-3/4 were not expanded in this task. First live order is a separate explicit user-observed step.
- Independent cross-model review is pending through the integrator, as required by AGENTS.md. Shared contracts/, coord/STATE.md and other roles' files were not edited by agents.

## R-004 follow-up (offline only, 2026-10-17)

- R-004-1: a7312a3 already aligns config/state to contracts 0.6 while preserving deployment descriptor 0.5 and saved-state history. Baseline full suite: 136 passed (10.50s).
- R-004-2: eadee19 creates automatic dry-run services per batch; the regression first failed in a later cycle, then passed with full suite 137 passed (9.86s). Limits still apply across the current batch.
- R-004-3: d23f0c8 persists incremental block cursors and confirmed receipt markers. Regressions cover restart, partial/empty log responses, canonical checkpoint change, legacy journal upgrade, receipt query counts and crash between receipt and post-send lookup. Full suite: 145 passed (16.10s).
- GO condition 2: CLI requires config dry_run=false, --live --confirm-live GRAIL-LIVE-SPOT, and --chain fuji. Tests first produced 13 failures, then all passed. Positive execution uses a local EVM and fake exchange, verifies commit-before-execute and query-before-reveal, and restarts the same runtime without replaying its order. Final full suite: 157 passed (15.31s).
- CLI-only review base: d23f0c8; inspect the following commit's __main__.py, test_cli.py and live-CLI regression in test_fuji.py. Review independently before any real live run. R-004-4/5/6/7 remain open and outside this requested change. No new external RPC, ATK smoke, Fuji transaction or actual OKX order was run in this follow-up.
