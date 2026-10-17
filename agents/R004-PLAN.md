# R-004 implementation and evidence

Scope: user request, T-006 and role/review@62ef3c3:coord/reviews/T-006.md.
Only agents/ and coord/handoffs/agents.md may change. No external orders or transactions.
Existing role/agents worktree; implement inline in the requested order, tests first.

1. R-004-1: verify existing a7312a3 with full `uv run pytest -q`, including v0.6 CLI/state and v0.5 state restart tests. Preserve chain.json deployment v0.5.
2. R-004-2: add multi-cycle real OrderService regression in tests/test_loop.py. Each batch must enforce cash/deploy limits; later cycles start with fresh simulated reservations. Change loop.py to keep automatic dry-run services cycle-local; retain persistent live journal/service. Run loop and full tests; commit/push with handoff.
3. R-004-3: add local EVM regressions in tests/test_fuji.py for incremental logs, restart, failed scan and confirmed journal receipts. Cache complete own-agent events in a separate atomic runtime file, advancing per-event cursor only after a complete scan. Verify checkpoint hash on restart/head rollback and rebuild on mismatch. Keep commitCount consistency checks. Persist successful receipt confirmation in fuji-transactions.json, query only unresolved records before a new send. Run Fuji and full tests; commit/push with handoff.
4. GO condition 2: add rejection matrix and local EVM positive CLI test before editing __main__.py. Require all three: dry_run=false, --live --confirm-live GRAIL-LIVE-SPOT, --chain fuji. Reject live flags on smoke/dry-run before any client/provider construction. Recommend --cycles 1 without restricting continuous mode. Preserve runtime and limits. Run full tests; document phrase and separate review requirement; commit/push with handoff.

Review focus: intra-batch limits, partial/failed scans, changed canonical checkpoint, old journals without markers, invalid live flags causing effects. Tests must exercise these boundaries. R-004-4/5/6/7 remain outside this request and must be reported as open.

Evidence:
- Initial HEAD a7312a3; clean worktree; local main sync merge 230be85.
- R-004-1 verified: full suite 136 passed (10.50s), existing v0.6 startup/state and saved-state restart tests included.
- R-004-2 RED: multi-cycle test reproduced all BUYs blocked in a later cycle (1 failed). Automatic dry-run service is now local to its batch; injected services retain caller ownership.
