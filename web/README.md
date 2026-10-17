# GRAIL web (T-005 v2)

Vite + React + TypeScript. Claude Design handoff (T-005) + plain-language UI. Screen copy is English.
Five screens: Dashboard · Decisions · On-chain Ledger · Safety limits (read-only) · How it works.

```bash
npm install
npm run dev        # example data: ../contracts/state.example.json
npm run dev:demo   # demo data: fixtures/demo-state.json (1 real Fuji round + 4 made-up rounds; refresh times: npm run fixture)
npm run build
```

Real agent data: `GRAIL_STATE_PATH` (relative to web/ or absolute). If the file is missing, example data is shown with a notice.

```bash
GRAIL_STATE_PATH="../../../Agentic Hack/runtime/state.json" npm run dev
```

- `/api/state` re-reads the file on every request; the UI polls every 3 s. `/api/chain` serves `../contracts/chain.json` (or `GRAIL_CHAIN_PATH`).
- Real addresses (GrailLedger, IdentityRegistry, agentId) come from `contracts/chain.json`.
- "Verify yourself" (`src/components/VerifySheet.tsx`, `src/chain.ts`), read-only, no wallet, no extra packages:
  1. payload + salt are decoded from the reveal tx calldata (`revealDecision`) when it exists (R-003-1); state.json is the fallback,
  2. fingerprint `keccak256(utf8(payload) ‖ salt)` is computed in the browser (@noble/hashes),
  3. compared with state `commit_hash` and with `GrailLedger.decisions(agentId, cycleId)` read via `eth_call`,
  4. `payload.cycle_id == cycleId` and `payload.agent == agent name` are shown (R-003-4),
  5. the v0.6 `okxOrderId` map from the reveal is listed per coin.
  Public Fuji RPC rate-limits; Routescan (Snowtrace backend) proxy API is the automatic fallback.
- Plain words first, technical names small and gray underneath (`Term` in `src/components/Bits.tsx`); formulas and raw payload sit under "Show the math".
- The first-visit tour is remembered in localStorage (`grail.intro.dismissed`), wrapped in try/catch.
