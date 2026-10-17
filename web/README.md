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

## Public demo build (static, for the jury link)

No server, no local files, no secrets: the agent state is a frozen snapshot of the real practice-mode run;
the Ledger and every "Verify yourself" still read Avalanche Fuji live from the visitor's browser
(public RPC, Routescan fallback). The top bar shows "Snapshot of <time> · live chain checks"; countdowns are hidden.

```bash
# 1) refresh the snapshot from a real runtime state.json (whitelisted fields only; salts of unrevealed check-ins are dropped)
npm run snapshot -- "<path to agents runtime>/state.json"
# 2) build (base path defaults to /grail-agent/ for GitHub Pages; override: GRAIL_BASE=/ npm run build:public)
npm run build:public          # → web/dist-public/ (gitignored)
# 3) check locally
npm run preview:public        # → http://localhost:4173/grail-agent/
```

Publish (done by the integrator/user once the repo is public; not done from this branch):
- GitHub Pages: push the contents of `web/dist-public/` to a `gh-pages` branch (e.g. `npx gh-pages -d web/dist-public`, or a
  Pages workflow that runs `npm ci && npm run build:public` in `web/` and uploads `web/dist-public`). Repo Settings → Pages → source `gh-pages`.
  URL: `https://<owner>.github.io/grail-agent/`.
- Any other static host: upload `web/dist-public/` as-is; if it is served from the domain root, build with `GRAIL_BASE=/`.
- Routing is hash-based (`#/ledger`), so no server rewrites are needed.
