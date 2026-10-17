# GRAIL — a trading agent whose track record you can verify

> Backtests can lie. Avalanche can't.

GRAIL is an autonomous spot-trading agent for OKX TR. It knows how correlated its coins are, it trades only inside limits that the code enforces, and it commits every decision to Avalanche **before** placing the order. Its history can't be cherry-picked or edited after the fact.

Built for the OKX ATK × Avalanche Agentic Hackathon (Ankara, 17 Oct 2026).

## The problem
- **You can't verify an agent's record.** If you hand money to a trading agent, all you see is its claimed performance: a chosen backtest, a screenshot, a log that can be rewritten.
- **"Diversified" usually isn't.** By the formula below, five coins with an average correlation of ρ̄ = 0.62 behave like about 1.44 independent bets (worked example, not a live measurement). Adding more coins that move together adds almost nothing (Dalio's "Holy Grail" / effective N).

## The solution
1. **Correlation-aware brain (deterministic).** A time-series momentum filter sends coins with a negative trend to cash. HRP weights, a volatility target and per-coin risk caps size the rest. The engine reports the effective number of bets
   `n_eff = N / (1 + (N−1)·ρ̄)` and the portfolio Sharpe `SR_p = SR₁ · √n_eff`. The output is BUY / SELL / HOLD per coin, every cycle. The same input always gives the same payload.
2. **LLM analyst that can only say no.** It can keep a BUY, shrink it or turn it into a HOLD. It can never add risk, and SELLs are exempt. Its note and flag are hashed into the decision. If no LLM key is configured, or the call times out, the decision goes through unchanged and is marked `skipped`.
3. **Commit-reveal ledger on Avalanche.** Each cycle the agent commits `keccak256(canonicalPayload ‖ salt)` to `GrailLedger` on Fuji, then places the order, then reveals the payload, the salt and the OKX order id. HOLDs are committed too. `dry_run` is part of the hash, so simulated and live decisions can't be confused. Unrevealed commits stay on chain and are counted, so the agent can't selectively show only its good calls.
4. **ERC-8004 identity.** The agent is registered in an ERC-8004 IdentityRegistry. `GrailLedger` accepts commits only from that registered agent.
5. **"Verify yourself" UI.** The dashboard recomputes the hash in your browser and checks it against the commit transaction on Fuji. You don't need a wallet, and you don't need to trust us.

## Architecture
```
                 +------------------- OKX TR  (OKX Agent Trade Kit CLI, profile "grail") ------------------+
                 |   read allowlist: candles, tickers, instruments, balance      write: guarded spot order   |
                 +-----------+---------------------------------------------------------------^-------------+
                             | (1) snapshot                                                 | (5) order (or simulated
                             v                                                              |     when dry_run)
  config.json --> agents/  autonomous loop ------------------------------------------------+
                    |   (2) engine/  decide()          trend filter + HRP + vol target + caps
                    |   (3) analyst/ review_payload()  LLM may only shrink / veto BUYs
                    |
                    |   salt + payload saved to runtime/pending/ BEFORE commit (crash-safe)
                    |
                    |   (4) commitDecision(agentId, cycleId, keccak256(payload || salt))   <-- before the order
                    |   (6) revealDecision(agentId, cycleId, payload, salt, okxOrderId)    <-- after the order
                    v
       Avalanche Fuji:  IdentityRegistry (ERC-8004 agentId)  <--  GrailLedger (commit-reveal + counters)
                    |
                    v
       runtime/state.json  -->  web/  Dashboard | Decisions | On-chain Ledger | Settings   ("Verify yourself")
```

## How we use OKX Agent Trade Kit
- **Data:** confirmed 1H candles, tickers, instrument rules (`minSz`, `lotSz`, `tickSz`) and account balance from OKX TR, all through `@okx_ai/okx-trade-cli` with profile `grail`, site `tr`, and JSON output. Only a closed allowlist of read queries is allowed.
- **Orders:** USDT spot market/limit orders only, in cash mode. A market BUY is quote-sized with `banAmend`, so the exchange can't enlarge it. Each order is idempotent through its client order id and a persistent order journal. An ambiguous result (timeout, malformed acknowledgment) is looked up by id first and is never resubmitted blindly.
- **Account:** USDT equity is built from cash plus priced holdings. Unpriced holdings stop execution, so exposure is never silently left out.

## How we use Avalanche
- **Network:** Fuji C-Chain (chain id 43113). Explorer: https://testnet.snowtrace.io
- **Contracts:** ERC-8004 registries (based on `ava-labs/8004-boilerplate`) plus our `GrailLedger`.
- **Why on chain:** the commit happens *before* the trade, so the decision can't be changed after the market moves. The chain is the agent's tamper-proof résumé, not just a place to log results.

All four contracts are deployed on Fuji, and their source code is verified on Snowtrace.

| Contract | Address | Verified source |
|---|---|---|
| GrailLedger (commit-reveal) | `0x1B5fcf6DeFf2F9375338A2C35932224522118851` | [Snowtrace #code](https://testnet.snowtrace.io/address/0x1B5fcf6DeFf2F9375338A2C35932224522118851#code) |
| IdentityRegistry (ERC-8004) | `0x120A4E53A24ddd09991633b4Cb88c3feA6166721` | [Snowtrace #code](https://testnet.snowtrace.io/address/0x120A4E53A24ddd09991633b4Cb88c3feA6166721#code) |
| ReputationRegistry | `0x326671e1e2e80121C3Cd53a9b9fA5751a669596F` | [Snowtrace #code](https://testnet.snowtrace.io/address/0x326671e1e2e80121C3Cd53a9b9fA5751a669596F#code) |
| ValidationRegistry | `0x1a9c67CA99391812D7b157748fB814F6c7dADf0C` | [Snowtrace #code](https://testnet.snowtrace.io/address/0x1a9c67CA99391812D7b157748fB814F6c7dADf0C#code) |

- **Agent identity:** ERC-8004 agent **#1** (`GRAIL-01`), wallet `0x0660f43f5307Ea7C5Dbb6685FEEB648eD9620fcf`.

### On-chain proof
| Cycle | What happened | Commit (before the order) | Reveal (after the order) |
|---|---|---|---|
| 1 | First Fuji cycle, practice mode: 5 simulated BUYs | [0x7b47c4f3…f728](https://testnet.snowtrace.io/tx/0x7b47c4f313ffa5630d1acfff6411f11c6d13c321bbc69649ec8c90976995f728) | [0x541cb8ff…cf45](https://testnet.snowtrace.io/tx/0x541cb8ff88aac0248fbf79d7997915b62bb08fb873e226bbefc35cbcec77cf45) |
| 2 | **First live order**, 17 Oct 2026 15:37 (UTC+3): BUY 2 USDT of BTC-USDT on OKX TR, filled at 81,538.6, OKX order id `4017748393474314240` | [0x16f2d129…9569](https://testnet.snowtrace.io/tx/0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569) | [0xae6537e9…41f7](https://testnet.snowtrace.io/tx/0xae6537e9acc9e66accfe5d0fe61b2f9a858460d7c42cf3d25f0acafa378541f7) |

### Verify it yourself (read-only, no wallet, no keys)
```bash
cd chain && npm ci
npm run verify:cycle:1        # → MATCH agent=1 cycle=1, keccak(payload||salt) == on-chain commitHash
npm run verify:cycle -- --cycle 2   --commit-tx 0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569   --reveal-tx 0xae6537e9acc9e66accfe5d0fe61b2f9a858460d7c42cf3d25f0acafa378541f7
```
The script decodes the payload and salt from the reveal transaction's calldata, recomputes the hash and compares it with the commit stored on chain. It exits with a non-zero code on any mismatch, and when the cycle has not been revealed yet. Public RPCs can rate-limit; set `FUJI_RPC_URL` to another Fuji endpoint if that happens.

## Repository layout
| Path | What |
|---|---|
| `engine/` | Deterministic quant engine (`validate_config`, `decide`), pure Python |
| `analyst/` | LLM analyst guard (`review_payload`), stdlib only |
| `agents/` | OKX ATK adapter (market data, guarded orders, journal) and the autonomous loop |
| `chain/` | Hardhat project: ERC-8004 registries + `GrailLedger`, tests, Fuji deploy |
| `web/` | Vite + React + TypeScript dashboard |
| `contracts/` | Shared schemas: config, decision/hash rule, `state.json`, `chain.json` |

## Running it
Prerequisites: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node.js 24, OKX Agent Trade Kit CLI (`@okx_ai/okx-trade-cli`, tested with 1.4.8) with a `grail` profile in `~/.okx/config.toml` (Read + Trade API key, **no withdraw**).

```bash
# secrets: one .env at the repo root (never committed)
#   AGENT_PRIVATE_KEY=0x...   AGENT_ADDRESS=0x...   (Fuji wallet with test AVAX)
#   LLM_API_KEY=...           (optional; without it the analyst is skipped)
# OKX keys are NOT in .env; ATK reads them from ~/.okx/config.toml (profile "grail").

# engine + analyst tests (offline)
cd engine && uv run pytest -q

# OKX adapter tests (offline) and a read-only smoke test (simulated order, dry_run only)
cd agents && uv run pytest -q
uv run python -m grail_agents smoke --config ../contracts/config.example.json

# contracts
cd chain && npx hardhat test
npm run deploy:fuji            # already done; addresses are in contracts/chain.json
npm run verify:sources         # checks that all 4 sources are verified on the explorer

# autonomous agent loop (writes <runtime>/state.json); practice mode, real Fuji commit/reveal
cd agents
uv run python -m grail_agents run --config ../contracts/config.example.json --chain fuji --runtime runtime/demo
#   add --cycles 1 for a single cycle; omit it to run every cycle_seconds
# live trading needs a config with dry_run=false AND both flags (see agents/README.md):
#   --chain fuji --live --confirm-live GRAIL-LIVE-SPOT

# dashboard
cd web && npm install
npm run dev                                   # mock state (contracts/state.example.json)
npm run dev:demo                              # demo fixture with real hashes
GRAIL_STATE_PATH=../agents/runtime/demo/state.json npm run dev   # live agent state
```

Config (`contracts/config.example.json`): coins, `cycle_seconds`, `candle_bar`, `lookback_bars`, `risk_budget_pct`, `max_position_pct`, `target_vol_pct`, `min_order_usdt`, `max_order_usdt`, `max_total_deploy_usdt`, `kill_switch_drawdown_pct`, `dry_run`.

## Safety
- **Dry run by default.** With `dry_run: true`, decisions are still committed and revealed on chain, but orders are simulated and labeled `simulated`. Live trading requires the user to set `dry_run: false` *and* confirm it explicitly. The UI can't switch modes.
- **Authority kept narrow:** API key without withdraw rights; spot only; no leverage; only the coins in the config. There are no withdrawal, transfer, leverage or account-settings calls anywhere in the code.
- **Spending capped:** `max_order_usdt` per order, `max_total_deploy_usdt` in total, and a drawdown kill switch. Code checks all of these before every order.
- **Fail-closed:** if the commit tx fails, there is no order that cycle. Bad or missing data or zero volatility gives a HOLD for that coin. Any step that errors skips the cycle, the error is written to state, and the agent keeps running.
- **Crash-safe:** the salt and payload are written to disk before the commit. On restart, open commits are revealed first.
- **No secrets in the repo:** `.env` is git-ignored, and the code never prints or logs keys.

## Status at submission
- **On chain (Fuji):** 25+ cycles committed, all revealed, 0 open (31/31 at 16:29). `cd chain && npm run audit` reads the whole ledger and checks every cycle: all MATCH. Cycle 1 was in practice mode; cycle 2 was the first live order (see "On-chain proof").
- **Live trading:** one live order so far: BUY 2 USDT of BTC-USDT, filled. A person switched on live mode for that run with a 2 USDT cap.
- **Tests (offline):** engine + analyst 167 · agents (OKX adapter + loop) 157 · contracts 48.
- **30-day replay** (simulation on real OKX 1H candles, 17 Sep → 17 Oct 2026, 50 USDT, 0.1% fees, no orders sent): GRAIL's worst drop was **4.3%** vs **14.5%** for an equal-weight buy-and-hold of the same 5 coins, and its emergency stop never triggered. Return was +2.0% vs +8.8%; we don't claim GRAIL beats buy-and-hold. The smart-entry gates (Hurst estimate + breakout retest, which can only shrink or skip a buy) cut trades from 382 to 220. The 5 coins averaged **1.36 independent bets**. Details: `engine/out/replay-summary.md`.

## Team
`<TBD>`
