# T-002 ATK adapter implementation plan

**Goal:** Python ATK adapter for OKX TR market/account reads and guarded spot orders; development runs only simulations.
**Spec:** coord/tasks/T-002.md, contracts v0.4, user AGENTS.md. No chain/engine integration in this task.
**Architecture:** standard-library subprocess transport with fixed commands, Decimal validation/normalization, guarded order service and durable client-ID journal. Python 3.11+, pytest, uv; no OKX credentials in code or environment files.

## Constraints and decisions
- Write only agents/ and coord/handoffs/agents.md; use existing role/agents worktree; no subagents or inter-role messaging.
- Fixed site tr, profile grail, live account context, dry_run=true by default. No live order in this chat.
- CLI 1.4.8 rejects --read-only. User explicitly approved a read-query allowlist on 2026-10-17; never retry an unknown flag or switch site.
- Task card says v0.3; synchronized main provides v0.4 (lookback_bars=48). Use current examples without changing contracts.
- The initial handoff's OKX_DEMO=1 instruction is obsolete against task card/D-007.
- Use inline implementation under existing role ownership; independent Claude Pro review is requested through final RAPOR, per AGENTS.md.

## Task 1 — transport and normalized data
Files: pyproject.toml, src/grail_agents/{config,atk,market}.py, tests/test_market.py, tests/test_transport.py.
Interfaces: AgentConfig.from_mapping(dict); AtkClient.ticker/candles/instruments/balance/order_status; fetch_snapshot(client, cfg) -> market/portfolio/candles/instruments.
- [x] Write and run failing tests for ticker percent, quote valuation, completed candles, unlisted coins, malformed numbers, TR/profile command routing and CLI errors/timeouts.
- [x] Implement fixed read commands, safe Windows Node entrypoint, sanitized errors and API envelope checking. Never expose stdout/stderr from failed commands.
- [x] Run cd agents; uv run pytest -q. Update handoff, commit and push.

## Task 2 — guarded execution
Files: src/grail_agents/{orders,journal}.py, tests/test_orders.py.
Interface: OrderService.execute(decision, portfolio, client_order_id=..., order_type='market', limit_price=None, kill_switch=False, live_confirmed=False).
- [x] Write and run failing tests: allowed spot only, finite positive sizes, order/deploy/cash/base limits, drawdown threshold, dry-run flag, lot/minimum/tick constraints, multiple reservations, idempotent client IDs and unknown submission reconciliation.
- [x] Implement simulation without place calls; live path needs config dry_run=false AND explicit confirmation, fresh account snapshot, durable journal claim before submission; unknown submissions are queried by same client ID and never automatically sent again.
- [x] Run full suite; update handoff, commit and push.

## Task 3 — safe acceptance smoke and delivery
Files: src/grail_agents/__main__.py, README.md, tests/test_smoke.py, coord/handoffs/agents.md.
- [x] Add CLI smoke which refuses dry_run=false, reads configured instruments/tickers/candles/balance, prints normalized state fragment + simulated order.
- [x] Run offline suite and read-only live-account smoke; no order placement. Record missing endpoint or auth failures as BLOCKED, without fallback/retries.
- [x] Check ownership diff, clean status and matching origin/role/agents commit; final RAPOR requests independent review. First live order remains user-gated for a later step.

## Review focus
- CLI errors may contain credentials; expose stable error codes only.
- USDT equity must be computed in USDT from held assets; never relabel totalEq USD.
- Unconfirmed candles must not enter the engine window; require lookback+1 confirmed rows.
- Sequential/uncertain buys must reserve exposure/cash until fresh balance accounts for confirmed completion.
- A reused client ID with changed intent must fail; timeout/restart must query, not resubmit.

## Evidence ledger
- Initial main sync: 987d7e4 -> e06987b; clean role/agents; contracts 0.4.
- Recon: CLI 1.4.8 has --json and --site; --read-only rejected by parser, CLI context hardcodes readOnly=false. User authorized allowlist alternative.
- Task 1: initial collection failed because config/atk/market modules did not exist; implementation then passed 33/33 tests. Public BTC ticker via fixed TR/profile succeeded. API-key presence confirmed without printing credentials. Every command explicitly passes --site tr.
- Task 2: transport tests first exposed an environment base-URL override and missing write method; new order/journal tests first failed on missing modules. After implementation 66/66 pass. Windows shared pytest temporary directory had stale ACLs; tests now use verified worktree-local agents/runtime/pytest (parent created in test config).
- Ruling: force OKX_API_BASE_URL=https://tr.okx.com as well as --site tr. ATK's configured base_url otherwise overrides the site flag; cost is deliberately refusing other API hosts.
- Task 3: 78/78 tests pass (0.20s); full real-account read-only smoke succeeded with five active instruments, 49 confirmed bars each, cash 29.40294764 USDT and simulated BTC BUY 2 USDT (no exchange order ID / fill price).
- Final review fixes: safe malformed input errors; untracked live open orders block; fresh balance and reservation claims serialized. New tests were observed failing before implementation (7 failures plus absent smoke module), then green.
- First real smoke exposed TRY dust (0.001855 TRY) as an unpriced holding. Added two red-to-green tests and inverse public USDT-TRY valuation; second smoke passed. TRY is included in equity as an explicitly nontradable synthetic position, not available USDT cash. Other unpriced holdings still block (cost: config must cover them).
- Independent review: pending Claude Pro per AGENTS.md; no subagent or inter-role message sent. First live acceptance deliberately unrun: config remains dry_run=true and user has not enabled live trading.
