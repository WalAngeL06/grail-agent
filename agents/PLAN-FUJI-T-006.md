# T-006 Fuji adapter implementation plan

**Goal:** real Fuji confirmed commit -> queried simulated order -> real reveal, contracts 0.5 / R-003.
**Spec:** coord/tasks/T-006.md, contracts/chain.json, user R-003 instructions.
**Architecture:** Python Web3 with chain.json ABI, private key read only via GRAIL_ENV; durable signed transaction hash/nonce before one broadcast. Existing AgentLoop and CycleStore own final payload/salt and restart recovery. Native execution in the existing role/agents worktree; independent review via integrator, no cross-role messages.

## Constraints / review focus
- Only agents/ and coord/handoffs/agents.md writes; config dry_run=true; no live OKX order.
- Verify Fuji chainId, deployed code, ledger registry, registry agent authorization and hash vector before signing.
- Unknown receipt is not permission to resend; reconcile recorded hash before any new transaction. Reverted commit never authorizes execution.
- Cycle floor comes from maximum own-agent DecisionCommitted cycleId + 1, including gaps, persisted monotonically with existing runtime floor.
- Reveal result is sorted compact JSON instrument -> ordId/simulated/unknown; no orders is empty string. Query actual/local simulated order status before reveal.

## Task 1: cycle floor and order result (storage.py, chain.py, orders.py, loop.py)
- [ ] Add failing tests: reopened cycle floor 42 -> 43; chain cycle 99 -> next loop 100; HOLD/blocked -> empty result; queried simulation -> canonical mapping.
- [ ] Run tests RED; implement minimum cycle allocation, next_cycle_id boundary and dry-run local query; run full agents suite GREEN.
- [ ] Update handoff, commit and push.

## Task 2: FujiChain (fuji.py, pyproject.toml, tests/test_fuji.py)
- [ ] Add failing tests against locally executed GrailLedger bytecode: identity/chain/vector validation; real signed commit/reveal receipts/events; gaps; duplicate commit; unknown broadcast recovery without resending; status=0/no execution; saved intent before broadcast.
- [ ] Implement FujiChain(path, runtime, settings=None, web3=None, receipt_timeout=40), lookup/commit/reveal/info/next_cycle_id; HTTP retries disabled; paginated log scan from ledger deployment receipt.
- [ ] Run full agents suite; update handoff, commit and push.

## Task 3: command and real gate (__main__.py, README.md, ACCEPTANCE-T-006.md)
- [ ] Failing CLI test for explicit --chain fuji / --chain-file and persisted real state; keep dry_run=false denied.
- [ ] Implement CLI; run agents + engine/analyst suites and actual ATK-read dry-run with real Fuji transactions.
- [ ] Independently read receipts/decision/events; record hashes, canonical reveal result and runtime state path; inspect diff scope, handoff, commit, push and report.

## Evidence
- origin/main@9bc78e3 merged via local merge; vector test passed (1 passed, 0.07s).
- Ruling: use native execution in the user-designated worktree; user role communication/ownership rules override skill review delegation and default docs/ plan locations.
