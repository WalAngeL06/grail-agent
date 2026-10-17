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
- [x] Add failing tests: reopened cycle floor 42 -> 43; chain cycle 99 -> next loop 100; HOLD/blocked -> empty result; queried simulation -> canonical mapping.
- [x] Run tests RED; implement minimum cycle allocation, next_cycle_id boundary and dry-run local query; run full agents suite GREEN (126 passed).
- [x] Update handoff, commit and push (9c27f12).

## Task 2: FujiChain (fuji.py, pyproject.toml, tests/test_fuji.py)
- [x] Add failing tests against locally executed GrailLedger bytecode: identity/chain/vector validation; real signed commit/reveal receipts/events; gaps; duplicate commit; unknown broadcast recovery without resending; saved intent before broadcast. The status=0/no-execution test confirmed the existing loop gate without requiring a production change.
- [x] Implement FujiChain(path, runtime, settings=None, web3=None, receipt_timeout=40), lookup/commit/reveal/info/next_cycle_id; HTTP retries disabled; paginated log scan from ledger deployment receipt.
- [x] Run full agents suite; update handoff, commit and push (6cd61d9; includes Task 3 CLI and real gate evidence).

## Task 3: command and real gate (__main__.py, README.md, ACCEPTANCE-T-006.md)
- [x] Failing CLI test for explicit --chain fuji / --chain-file and persisted real state; keep dry_run=false denied.
- [x] Implement CLI; run agents + engine/analyst suites and actual ATK-read dry-run with real Fuji transactions.
- [x] Independently read receipts/decision/events; record hashes, canonical reveal result and runtime state path (FUJI-GATE-T-006.json).
- [x] Final diff scope and handoff; documentation/evidence delivered with the final commit/push and RAPOR.

## Evidence
- origin/main@9bc78e3 merged via local merge; vector test passed (1 passed, 0.07s).
- Ruling: use native execution in the user-designated worktree; user role communication/ownership rules override skill review delegation and default docs/ plan locations.
- 135 agents tests passed (8.30s); engine/analyst 84 passed (1.11s). Windows pysha3 build requirement from eth-tester extra avoided by separate eth-tester and py-evm dev dependencies; same local EVM backend.
- Root cause of first adapter restart failure: duplicate POA middleware injection into a reused test Web3 instance; named injection is idempotent, then full suite passed.
- Actual RPC revealed a 100-block log limit; regression failed with a 252-block range, then passed with [100,100,52] pagination.
- Ruling: an explicit process FUJI_RPC_URL using PublicNode was selected after configured/public Avalanche endpoint returned Cloudflare HTTP 429 before any transaction. The new endpoint reported 43113 and all identity checks passed; no automatic failover and no .env changes. Cost: operating the default endpoint can still return a safe read failure until its rate limit clears.
- Query error reporting regression: failed chain metadata previously caused CLI KeyError; test RED then structured failure GREEN. Another RED->GREEN test preserves a known order identity after a status-query failure.
- Real Fuji gate at 14:50: commit 0x7b47c4f313ffa5630d1acfff6411f11c6d13c321bbc69649ec8c90976995f728, reveal 0x541cb8ff88aac0248fbf79d7997915b62bb08fb873e226bbefc35cbcec77cf45; both status=1, cycle=1, five simulated orders, no errors. Separate RPC verification matched receipt/event/state/hash.
- Final review: author inspected chain/receipt/nonce/crash/query behavior. Independent cross-model review remains the integrator's required merge gate; no other role was messaged and main was not modified.
- Fresh real-Fuji adapter (read-only) returned next_cycle_id=2 after cycle 1; proof JSON updated. CLI --help exit 0. Diff against main contains only agents/ and coord/handoffs/agents.md.
