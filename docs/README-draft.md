# GRAIL: a trading agent whose track record you can verify

> Backtests can lie. Avalanche can't.

**[Live demo](<PAGES_URL>)** · **[2-minute video](<VIDEO_URL>)** · **[Slides](<SLIDES_URL>)**

GRAIL is an autonomous spot-trading agent for OKX TR. It knows how correlated its coins are, it trades only inside limits that the code enforces, and it commits every decision to Avalanche **before** placing the order. Its history can't be cherry-picked or edited after the fact.

Built in one day for the OKX ATK × Avalanche Agentic Hackathon (Ankara, 17 Oct 2026).

- **It trades for real:** first live order on 17 Oct 2026 at 15:37 (UTC+3): BUY 2 USDT of BTC on OKX TR, filled, sealed on chain before it was sent.
- **Every decision is on chain:** HOLDs and practice cycles included. Each one is committed before the order and revealed after it. Agent #1 in an ERC-8004 registry on Avalanche Fuji.
- **You don't have to trust us:** one command re-checks every cycle against the chain.

## Verify it yourself in 60 seconds
You need Node.js. There's no wallet, no key and no `.env`; everything is read-only public RPC.

```bash
git clone https://github.com/WalAngeL06/grail-agent && cd grail-agent/chain && npm ci

npm run verify:cycle:1   # one cycle → MATCH agent=1 cycle=1, keccak(payload||salt) == on-chain commitHash
npm run audit            # the whole ledger: every commit/reveal pair, re-hashed and compared → report in deployments/audit-latest.md
```

- `verify:cycle:1` decodes the payload and salt from the reveal transaction's calldata, recomputes `keccak256(payload ‖ salt)` and compares it with the commit stored in `GrailLedger`. It exits non-zero on any mismatch, and when the cycle hasn't been revealed yet.
- `audit` reads every `DecisionCommitted` / `DecisionRevealed` event for agent #1 up to a fixed snapshot block. It doesn't assume cycle ids are consecutive. It cross-checks events against the on-chain counters and verifies each revealed cycle the same way. Last committed report: `<AUDIT_TOTAL>` cycles, all revealed, all `MATCH` (`chain/deployments/audit-latest.md`; the 16:06 snapshot had 16/16).
- **In the browser:** open the [live demo](<PAGES_URL>) → **Decisions** → **Verify yourself**. Your browser recomputes the hash and reads the commit from Fuji. The CLI above is the reference verifier; `<R-010 status>`.
- Public RPCs rate-limit. If you see `Too Many Requests`, wait a few seconds or set `FUJI_RPC_URL` to another Fuji endpoint.

## First live order: the proof
| | |
|---|---|
| When | 17 Oct 2026 15:37 (UTC+3), cycle 2 |
| What | BUY 2.00 USDT of BTC-USDT on OKX TR, filled at 81,538.6 |
| OKX order id | `4017748393474314240` |
| Commit (before the order) | [0x16f2d129…9569](https://testnet.snowtrace.io/tx/0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569) |
| Reveal (after the order) | [0xae6537e9…41f7](https://testnet.snowtrace.io/tx/0xae6537e9acc9e66accfe5d0fe61b2f9a858460d7c42cf3d25f0acafa378541f7) |
| Re-check | `npm run verify:cycle -- --cycle 2 --commit-tx 0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569 --reveal-tx 0xae6537e9acc9e66accfe5d0fe61b2f9a858460d7c42cf3d25f0acafa378541f7` |

The live run was deliberately tiny: one coin, a 2 USDT cap, one cycle, started by a person with an explicit confirmation flag. The first Fuji cycle (practice mode, 5 simulated BUYs) is cycle 1: [commit](https://testnet.snowtrace.io/tx/0x7b47c4f313ffa5630d1acfff6411f11c6d13c321bbc69649ec8c90976995f728) · [reveal](https://testnet.snowtrace.io/tx/0x541cb8ff88aac0248fbf79d7997915b62bb08fb873e226bbefc35cbcec77cf45).

## The problem
- **You can't verify an agent's record.** If you hand money to a trading agent, all you see is its claimed performance: a chosen backtest, a screenshot, a log that can be rewritten.
- **"Diversified" usually isn't.** Coins that move together act like one bet. Over the last 30 days, our 5 coins behaved like **1.36 independent bets** on average (Dalio's "Holy Grail" / effective N).

## The solution
1. **Correlation-aware brain (deterministic).** A time-series momentum filter sends coins with a negative trend to cash. HRP weights, a volatility target and per-coin risk caps size the rest. The engine reports the effective number of bets `n_eff = N / (1 + (N−1)·ρ̄)`. The output is BUY / SELL / HOLD per coin, every cycle. The same input always gives the same payload.
2. **Smart-entry gates that can only say "smaller" or "wait".** Before a buy, two gates look at the market. Is it ranging? That comes from a Hurst *estimate* over 48 hourly bars. Has a breakout been retested? Ranging, or a breakout that hasn't been retested yet, means wait; no breakout yet means half size; breakout plus retest means full size. The gates never create a buy and never touch sells.
3. **LLM analyst that can only say no.** It can keep a BUY, shrink it or turn it into a HOLD. It can never add risk, and SELLs are exempt. Its note and flag are hashed into the decision. If there's no key or the call times out, the decision goes through unchanged and is marked `skipped`.
4. **Commit-reveal ledger on Avalanche.** Each cycle the agent commits `keccak256(canonicalPayload ‖ salt)` to `GrailLedger` on Fuji, then places the order, then reveals the payload, the salt and the OKX order id. HOLDs are committed too. `dry_run` is part of the hash, so simulated and live decisions can't be confused. Unrevealed commits stay on chain and are counted.
5. **ERC-8004 identity.** The agent is registered in an ERC-8004 IdentityRegistry (agent #1). `GrailLedger` accepts writes only from that registered agent.
6. **"Verify yourself" UI.** A dashboard (Dashboard · Decisions · On-chain Ledger · Settings) that shows independent bets, every decision and its reason, and a per-cycle hash check against Fuji.

## Architecture
```
                 +------------------- OKX TR  (OKX Agent Trade Kit CLI, profile "grail") ------------------+
                 |   read allowlist: candles, tickers, instruments, balance      write: guarded spot order   |
                 +-----------+---------------------------------------------------------------^-------------+
                             | (1) snapshot                                                 | (5) order (or simulated
                             v                                                              |     when dry_run)
  config.json --> agents/  autonomous loop ------------------------------------------------+
                    |   (2) engine/  decide()          trend filter + HRP + vol target + caps + entry gates
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
- **Orders:** USDT spot market/limit orders only, in cash mode. A market BUY is quote-sized with `banAmend`, so the exchange can't enlarge it. Each order is idempotent through its client order id and a persistent order journal. An ambiguous result is looked up by id first and never resent blindly.
- **Account:** USDT equity is built from cash plus priced holdings. Unpriced holdings stop execution, so exposure is never silently left out.

## How we use Avalanche
- **Network:** Fuji C-Chain (chain id 43113). Explorer: https://testnet.snowtrace.io
- **Why on chain:** the commit happens *before* the trade, so the decision can't be changed after the market moves. The chain is the agent's tamper-proof résumé, not a place to log results afterwards.

All four contracts are deployed on Fuji, and their source code is verified on Snowtrace.

| Contract | Address | Verified source |
|---|---|---|
| GrailLedger (commit-reveal) | `0x1B5fcf6DeFf2F9375338A2C35932224522118851` | [Snowtrace #code](https://testnet.snowtrace.io/address/0x1B5fcf6DeFf2F9375338A2C35932224522118851#code) |
| IdentityRegistry (ERC-8004) | `0x120A4E53A24ddd09991633b4Cb88c3feA6166721` | [Snowtrace #code](https://testnet.snowtrace.io/address/0x120A4E53A24ddd09991633b4Cb88c3feA6166721#code) |
| ReputationRegistry | `0x326671e1e2e80121C3Cd53a9b9fA5751a669596F` | [Snowtrace #code](https://testnet.snowtrace.io/address/0x326671e1e2e80121C3Cd53a9b9fA5751a669596F#code) |
| ValidationRegistry | `0x1a9c67CA99391812D7b157748fB814F6c7dADf0C` | [Snowtrace #code](https://testnet.snowtrace.io/address/0x1a9c67CA99391812D7b157748fB814F6c7dADf0C#code) |

Agent identity: ERC-8004 agent **#1** (`GRAIL-01`), wallet `0x0660f43f5307Ea7C5Dbb6685FEEB648eD9620fcf`.

## Results so far
- **On chain (Fuji):** 25+ cycles committed and revealed, 0 open (31/31 at 16:29). One live order id; the rest are practice-mode cycles.
- **Tests (offline):** engine + analyst 167 · agents (OKX adapter + loop) 157 · contracts 48.

**30-day replay** (simulation on real OKX 1H candles, 17 Sep → 17 Oct 2026, 50 USDT, 0.1% fee, no orders sent; `engine/out/replay-summary.md`):


| | GRAIL | Equal-weight buy-and-hold |
|---|---|---|
| Worst drop | **4.3%** | 14.5% |
| Return | +2.0% | **+8.8%** |
| Trades | 220 (382 before the entry gates) | — |
| Emergency stop triggered | never | — |

GRAIL earned less than buy-and-hold over these 30 days; we don't claim it beats the market. What it's built for is risk control and a record you can check.

## Running it
Prerequisites: Python 3.11+ with [uv](https://docs.astral.sh/uv/), Node.js 24, and the OKX Agent Trade Kit CLI (`@okx_ai/okx-trade-cli`, tested with 1.4.8) with a `grail` profile in `~/.okx/config.toml` (Read + Trade API key, **no withdraw**).

```bash
# secrets: one git-ignored .env in the main checkout (never committed); other worktrees point to it with GRAIL_ENV
#   AGENT_PRIVATE_KEY=0x...   AGENT_ADDRESS=0x...   (Fuji wallet with test AVAX)
#   LLM_API_KEY=...           (optional; without it the analyst is skipped)
# OKX keys are NOT in .env; the Trade Kit reads them from ~/.okx/config.toml (profile "grail").

# tests (offline)
cd engine && uv run pytest -q          # engine + analyst
cd agents && uv run pytest -q          # OKX adapter + loop (fake exchange, local EVM)
cd chain  && npx hardhat test          # contracts + verifiers

# 30-day replay with saved OKX candles (offline, deterministic)
cd engine && uv run python scripts/replay_okx.py

# autonomous loop in practice mode: real market data, simulated orders, real Fuji commit/reveal
cd agents && uv run python -m grail_agents run --config ../contracts/config.example.json --chain fuji --runtime runtime/demo
#   --cycles 1 runs a single cycle; without it the loop runs every cycle_seconds (90 s)
#   live trading needs a config with dry_run=false AND --live --confirm-live GRAIL-LIVE-SPOT (see agents/README.md)

# dashboard
cd web && npm install
npm run dev                                                    # sample data
GRAIL_STATE_PATH=../agents/runtime/demo/state.json npm run dev  # your agent's live state
npm run build:public                                           # static demo build (see web/README.md)
```

## Safety
- **Practice mode by default.** With `dry_run: true`, decisions are still committed and revealed on chain, but orders are simulated and labeled `simulated`. Live trading needs `dry_run: false` *and* an explicit confirmation flag. The UI can't switch modes.
- **Authority kept narrow:** API key without withdraw rights; spot only; no leverage; only the coins in the config. There are no withdrawal, transfer, leverage or account-settings calls anywhere in the code.
- **Spending capped:** `max_order_usdt` per order, `max_total_deploy_usdt` in total, and a drawdown emergency stop. Code checks all of these before every order.
- **Fail-closed:** if the commit tx fails, there's no order that cycle. Bad or missing data gives a HOLD for that coin. Any failing step skips the cycle, the error is written to state, and the agent keeps running.
- **Crash-safe:** the salt and payload are written to disk before the commit. On restart, open commits are revealed first.
- **No secrets in the repo:** `.env` is git-ignored and never committed. The code never prints or logs keys.

## Honest limitations
- **Lower return than buy-and-hold** in the 30-day replay (+2.0% vs +8.8%). The replay assumes fills at bar close, a 0.1% fee, no slippage and no AI analyst. 30 days is too short to judge a strategy.
- **What commit-reveal proves:** that *sealed* decisions were never changed. It can't prove, on its own, that the agent never traded outside the ledger. Each reveal carries the OKX order id, so the record can be reconciled with the exchange account, but we haven't automated that.
- **No penalty for not revealing.** An unrevealed commit is public and counted, but nothing on chain punishes it. The contract also doesn't force cycle ids to be consecutive; a gap would be visible, and `npm run audit` doesn't assume continuity.
- **One live cycle so far**, by design (2 USDT, BTC only). The continuous loop has run in practice mode with real market data and real Fuji commits.
- **The AI analyst** was `skipped` on the live order (no key yet). In practice cycles 3–5 it approved all 15 BUYs. We haven't yet shown it vetoing a live trade.
- **Hurst on 48 bars is a noisy estimate,** not a regime detector. The gate only ever reduces or delays a buy, so a false alarm can at worst cost a missed entry.
- **The emergency stop blocks new orders; it doesn't close positions.** In the replay it never triggered.
- **Testnet and unaudited.** The contracts run on Fuji and haven't been audited. The ERC-8004 Reputation and Validation registries are deployed but not written to yet.
- **The public demo** shows a frozen snapshot of the agent's state; its chain checks run live. The CLI verifiers above are the reference.

## Repository layout
| Path | What |
|---|---|
| `engine/` | Deterministic quant engine (`validate_config`, `decide`, entry gates, replay), pure Python |
| `analyst/` | LLM analyst guard (`review_payload`), stdlib only |
| `agents/` | OKX Agent Trade Kit adapter (market data, guarded orders, journal) and the autonomous loop |
| `chain/` | Hardhat: ERC-8004 registries + `GrailLedger`, tests, Fuji deploy, `verify:cycle`, `audit` |
| `web/` | Vite + React + TypeScript dashboard, static public build |
| `contracts/` | Shared schemas: config, decision/hash rule, `state.json`, `chain.json` |
| `docs/` | Pitch deck, demo runbook, jury FAQ, UI brief and copy |

## Team
`<TBD>`
