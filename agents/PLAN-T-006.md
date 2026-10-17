# T-006 implementation plan — contracts 0.5

**Goal:** engine -> analyst -> durable final payload/salt -> confirmed commit -> guarded execution -> reveal -> atomic state, with recovery and continued scheduling.
**Spec:** coord/tasks/T-006.md and contracts/decision.md v0.5. User explicitly requested a chain interface/fake adapter while chain.json is unavailable; keep dry_run=true.
**Architecture:** synchronous Python loop, injected ATK/chain/provider/clock boundaries; standard-library durable JSON and OS lock; eth-hash for Ethereum Keccak (not SHA3); local editable engine/analyst packages. Inline execution in role/agents, no cross-role messages or edits.

## Constraints
- Own agents/ and coord/handoffs/agents.md only; no chain deployment/live orders in this task phase.
- Chain methods return confirmed outcomes; an exception/unknown is never permission to resubmit.
- Final analyst payload is immutable after canonicalization; decisions sorted by inst_id, ensure_ascii, compact sorted keys; 32 random salt bytes.
- Pending record and cycle ID allocation are durable before a chain effect. Recovery only queries/reveals, never executes orders or calls the analyst.
- One runtime writer, persistent cycle IDs/peak equity; bounded state history and safe errors. State contains v0.5 limits and verified identity (null for fake).
- Fake chain is explicitly simulated and cannot enable live orders. Real adapter/testVector check remains gated on chain.json arrival.

## Step 0 — review fixes (complete, ef5aecd)
- [x] Read reviewer worktree's coord/reviews/T-002.md (not yet on origin/main).
- [x] R-002-1 typed well-formed sCode rejection -> terminal rejected; transport error/timeout/malformed remains unknown.
- [x] R-002-2 reconcile unknown/pending/partial before every new live execute.
- [x] Regression tests RED -> GREEN; 88 passed; handoff, commit and push.

## Step 1 — immutable records and chain boundary
Files: src/grail_agents/{payload,storage,chain}.py; tests/test_cycle_storage.py.
Interfaces: canonical_payload(dict)->str; commitment(str,salt_hex)->str; CycleStore allocating cycle IDs, atomic pending/state/control writes, OS runtime lock; ChainAdapter Protocol lookup/commit/reveal/info; SimulatedChain for offline tests only.
- [x] Test known Keccak vector, canonical sorting/ASCII/LLM fields, 32-byte salt enforcement, atomic pending, persistent ID/peak, duplicate commit/reveal and hash mismatch.
- [x] Implement; run full suite; update handoff; commit + push.

## Step 2 — recoverable autonomous loop
Files: src/grail_agents/loop.py; tests/test_loop.py.
Interface: AgentLoop(config, client, chain, runtime, provider=None, news_source=None, clock=None, decide_fn=None).run_once()/recover()/run(cycles=None).
- [x] Tests pin final BUY reduction/veto, unchanged SELL exempt, HOLD commit, provider skip/timeout, strict commit-before-execute-before-reveal, durable pending before commit, same payload/salt on recovery and no duplicate execution, commit/reveal/data failures and continued cycles.
- [x] Integrate real engine and analyst, atomically persist peak/cycle IDs, deterministic client IDs, write v0.5 state (decisions[] only; limits/identity fields), bounded error/decision history. Only confirmed reveal publishes salt/payload to public state.
- [x] Run all agents + engine + analyst tests from agents environment; handoff, commit + push.

## Step 3 — command and handoff
Files: src/grail_agents/__main__.py, README.md, ACCEPTANCE-T-006.md.
- [ ] Add explicit simulated-chain run command, refuse dry_run=false, read user config and optional GRAIL_ENV LLM fields without copying .env.
- [ ] CLI validation/help + full offline suite; scope/status/origin checks; final RAPOR with actual fake-chain evidence and real-chain limits.

## Review focus
- Crash after chain confirmation and before its receipt is saved: lookup by cycle, never recommit.
- Crash during order submission: persisted client ID + journal, query only, never resubmit.
- Reveal failure retains private pending record and uses exact recorded bytes/salt next time.
- Unknown chain lookup retains pending; all subsequent processing stays safe; cycle IDs never reused.
- Guard rejection records an execution result without changing the already committed payload.
- Outbound network errors must never copy credentials/provider messages into state.

## Evidence ledger
- Main synced to origin/main 76e0724 via merge 9c67988; contracts 0.5; no chain.json.
- Reviewer fixes: 88/88 pass (0.42s), ef5aecd pushed. R-002-5 placement malformed row also converted to GrailError as part of typed response parsing.
- Step 1: storage/chain tests first failed on missing modules; 97/97 now pass (0.40s). Runtime file lock releases after process exit, IDs/peak and pending use fsync + atomic replace; simulated chain optionally persists its ledger across processes, never reports real identity/tx.
- Step 2: agents 114 passed + 1 intentional skip (chain.json vector unavailable), engine+analyst 84 passed. Actual subprocess os._exit(23) immediately after persisted fake-chain commit was recovered with fresh adapters, exact payload/salt, one commit and one reveal. Three final regression tests exposed and fixed public decision field overwrites, recovery of saved live unknown/pending IDs, and corrupt-pending handling (process survives without new effects).
- Ruling: public state lists only revealed cycles; pending salts/payload stay in private runtime/pending until successful reveal. Unrevealed counts/errors remain visible. This preserves the commit/reveal privacy purpose; cost is delayed decision-row visibility during reveal failures.
- Ruling: execution rounding fields use execution_size_usdt/execution_size_base so v0.5 decision fields stay exactly those in the committed payload. Both are additive fields; cost is UI must opt in to display actual order sizing separately.
