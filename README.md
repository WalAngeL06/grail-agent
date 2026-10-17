# GRAIL: Proof before profit.

> **A trading agent whose track record you can verify.** Backtests can lie. Avalanche can't.
> TR: *Önce kanıt, sonra kâr.*

**[Live site](https://walangel06.github.io/grail-agent/)** · **[Slides](https://claude.ai/artifact/Bj6g3CH5AzfbHjtKajVPyS)** · **[Tutorial (TR + EN)](docs/TUTORIAL.md)**

GRAIL is an autonomous spot-trading agent for OKX TR. It trades the **5 major coins by OKX TR volume** (BTC, ETH, SOL, AVAX, OKB). It knows how correlated those coins are, it trades only inside limits that the code enforces, and it commits every decision to Avalanche **before** placing the order. Its history can't be cherry-picked or edited after the fact.

Built in one day for the OKX ATK × Avalanche Agentic Hackathon (17 Oct 2026).

- **It trades for real:** first live order on 17 Oct 2026 at 15:37 (UTC+3): BUY 2 USDT of BTC on OKX TR, filled, sealed on chain before it was sent.
- **Every decision is on chain:** HOLDs and practice cycles included. Each one is committed before the order and revealed after it. 100+ cycles so far, 0 left unopened. Agent #1 in an ERC-8004 registry on Avalanche Fuji.
- **You don't have to trust us:** one click on the site re-checks a cycle; one command re-checks the whole ledger.

## New here? Start with the tutorial
- **On the site:** open the [live site](https://walangel06.github.io/grail-agent/) → **Tutorial** (TR: **Rehber**). Six short steps in plain language, plus a "try it in 3 minutes" walk-through.
- **In the repo:** [docs/TUTORIAL.md](docs/TUTORIAL.md), the same text in Turkish and English.
- The site has a **TR / EN** switch. Method names (HRP, Hurst, n_eff…) stay in English in both.

## Verify it yourself in 60 seconds
No wallet, no key, no `.env`; everything is read-only.

**1. In the browser:** open the [live site](https://walangel06.github.io/grail-agent/) → **Decisions** → pick any cycle → **Verify yourself**. Your browser recomputes `keccak256(payload ‖ salt)` and compares it with the commit read live from Avalanche Fuji. Then press **Try to cheat**: change one number and the check turns red. A failed or incomplete chain read never shows as a green match (independent review R-010).

**2. From a terminal, the whole ledger:**
```bash
git clone https://github.com/WalAngeL06/grail-agent && cd grail-agent/chain && npm ci
npm run audit            # every cycle, ~1–2 min on the public RPC → Total N | Revealed N | Unopened 0 | MATCH N | Mismatch 0
npm run verify:cycle:1   # one cycle, a few seconds → MATCH agent=1 cycle=1
```
`audit` reads every `DecisionCommitted` / `DecisionRevealed` event of agent #1, without assuming cycle ids are consecutive. It re-reads `commitCount` / `revealCount` before and after the scan. For each revealed cycle it decodes the payload and salt from the reveal calldata, recomputes `keccak256(payload ‖ salt)` and compares the result with the commit stored on chain. If anything is missing or changes during the scan, it exits with `INCOMPLETE` instead of printing a summary. It is safe to run while the agent keeps adding cycles; `--max-cycle K` audits a fixed cohort. The report is written to `chain/runtime/audit-latest.md`; `npm run audit -- --rpc <URL>` picks another Fuji endpoint.

Recorded run (17 Oct 2026, 18:01, public RPC): `Total 89 | Revealed 89 | Unopened 0 | MATCH 89 | Mismatch 0 | LIVE order IDs 1`. The ledger grows every 90 s while the agent runs (100+ by submission), so your run will show a higher total.

`verify:cycle:1` decodes the payload and salt from the reveal transaction's calldata, recomputes the hash and compares it with the commit stored in `GrailLedger`. It exits non-zero on any mismatch, and when the cycle hasn't been revealed yet. Any other cycle: `npm run verify:cycle -- --cycle N --commit-tx <hash> --reveal-tx <hash>` (cycle 2, the live order, is shown below).

You can also read the counters yourself: `commitCount(1)` / `revealCount(1)` on GrailLedger's "Read Contract" tab on Snowtrace. Public RPCs rate-limit: if you see `Too Many Requests`, wait a few seconds or set `FUJI_RPC_URL` to another Fuji endpoint.

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
- **"Diversified" usually isn't.** Coins that move together act like one asset. Measured live today, our 5 coins behave like only **~1.2 independent assets** (average correlation ≈ 0.81). This is Dalio's "Holy Grail" idea: what matters is the effective number of independent bets, not the number of coins.

## The solution
1. **Correlation-aware sizing (deterministic).** HRP (López de Prado) spreads risk, a 20% volatility target scales the total, and each coin is capped at `min(30%, 10% / σ_i)`. The engine reports the effective number of independent assets `n_eff = N / (1 + (N−1)·ρ̄)`. The output is BUY / SELL / HOLD per coin, every cycle. The same input always gives the same payload.
2. **Weekly regime: 168 hourly bars.** Every signal looks at the last 168 hours (one week): a time-series momentum filter (TSMOM) sends coins with a negative weekly trend to cash, and a DFA-1 Hurst estimate reads the regime (dead band 0.45–0.55).
3. **Strategy by regime.** If a coin looks trending, GRAIL uses momentum. If it looks ranging and an Ornstein-Uhlenbeck fit is significant (t ≤ −2.5, half-life 1–12 h), a separate mean-reversion arm buys a dip (z ≤ −1.5) and exits near the mean (z ≥ −0.25). The mean-reversion arm is **on** and capped at 25% of the deploy budget; all the same per-order, total, cash and safety-stop limits apply.
4. **Smart-entry gates that can only say "smaller" or "wait".** Breakout + retest: the range top is the highest close in the first 2/3 of the window. A retest (tolerance `max(0.2%, ½·σ_bar)`) means full size, no breakout means half size, a breakout that hasn't been retested yet means wait. These gates never create a buy and never touch sells.
5. **AI analyst that can only say no.** It can keep a BUY, shrink it or turn it into a HOLD. It can never add risk, and SELLs are exempt. Its note and flag are hashed into the decision. If there's no key or the call times out, the decision goes through unchanged and is marked `skipped`.
6. **Commit-reveal ledger on Avalanche.** Each cycle the agent commits `keccak256(canonicalPayload ‖ salt)` to `GrailLedger` on Fuji, then places the order, then reveals the payload, the salt and the OKX order id. HOLDs are committed too. `dry_run` is part of the hash, so simulated and live decisions can't be confused. Unrevealed commits stay on chain and are counted.
7. **ERC-8004 identity.** The agent is registered in an ERC-8004 IdentityRegistry (agent #1, `GRAIL-01`). `GrailLedger` accepts writes only from that registered agent.
8. **A site that explains itself.** Plain-language dashboard in TR and EN: Dashboard, Decisions (with "Verify yourself"), On-chain Ledger, How it works, Tutorial, Settings (read-only). Every decision shows its reason in plain words.

## Architecture
```
                 +------------------- OKX TR  (OKX Agent Trade Kit CLI, profile "grail") ------------------+
                 |   read allowlist: candles, tickers, instruments, balance      write: guarded spot order   |
                 +-----------+---------------------------------------------------------------^-------------+
                             | (1) snapshot (169 closed 1H bars per coin)                   | (5) order (or simulated
                             v                                                              |     when dry_run)
  config.json --> agents/  autonomous loop (every 90 s) -----------------------------------+
                    |   (2) engine/  decide()          trend + Hurst regime + HRP + vol target + caps + gates + O-U arm
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
       runtime/state.json  -->  web/  Dashboard | Decisions | Ledger | How it works | Tutorial   ("Verify yourself")
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
- **On chain (Fuji):** 100+ cycles committed and revealed, 0 left unopened, every audited cycle `MATCH` (`npm run audit`). One live order id; the rest are practice-mode cycles with real market data.
- **Tests (offline):** 449 automated tests across engine, analyst, agents and contracts, plus 11 independent code reviews (`coord/reviews/`).

**180-day backtest** (simulation on real OKX 1H candles, 20 Apr → 17 Oct 2026, 50 USDT, 0.1% fee, config limits and 5% safety stop, no orders sent; `engine/out/backtest-180d.md`, `engine/out/lookback-168.md`):

| 180 days, lookback 168 h | Return | Sharpe | Worst drop |
|---|---|---|---|
| Equal-weight buy-and-hold | **+16.73%** | +0.91 | 32.66% |
| GRAIL, momentum + gates only | +7.12% | **+1.16** | 5.81% |
| GRAIL as shipped (+ mean-reversion arm) | −2.55% | −0.52 | **5.76%** |

GRAIL's worst drop was about **one sixth** of buy-and-hold's. It earned less than buy-and-hold, and with the mean-reversion arm on it lost money over these 180 days; we keep the arm on so the agent can act in sideways markets, and we report the number as it is. We don't claim GRAIL beats the market. Results are sensitive to settings (lookback 168 was also the best value in the sensitivity table, which is an overfitting risk), so we make no profit claim.

**Forecasting skill, measured (Grinold's fundamental law, `engine/out/grinold-30d.md`):** `IR ≈ IC · √breadth`. Over 30 days the information coefficient is close to zero and not statistically significant (IC ≈ 0.003 at 24 h). We make no claim of forecasting skill. What GRAIL measures and manages is **breadth**: the 5 coins are only ~1.2–1.4 independent assets.

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

# backtests with saved OKX candles (offline, deterministic)
cd engine && uv run python scripts/replay_okx.py       # 30-day replay
cd engine && uv run python scripts/backtest_long.py    # 180-day backtest

# autonomous loop in practice mode: real market data, simulated orders, real Fuji commit/reveal
cd agents && uv run python -m grail_agents run --config ../contracts/config.example.json --chain fuji --runtime runtime/demo
#   --cycles 1 runs a single cycle; without it the loop runs every cycle_seconds (90 s)
#   live trading needs a config with dry_run=false AND --live --confirm-live GRAIL-LIVE-SPOT (see agents/README.md)

# site
cd web && npm install
npm run dev                                                    # sample data
GRAIL_STATE_PATH=../agents/runtime/demo/state.json npm run dev  # your agent's live state
npm run build:public                                           # static public build (see web/README.md)
```

## Safety
- **Practice mode by default.** With `dry_run: true`, decisions are still committed and revealed on chain, but orders are simulated and labeled `simulated`. Live trading needs `dry_run: false` *and* an explicit confirmation flag. The site can't switch modes.
- **Authority kept narrow:** API key without withdraw rights; spot only; no leverage; only the 5 coins in the config; orders between 2 and 10 USDT. There are no withdrawal, transfer, leverage or account-settings calls anywhere in the code.
- **Spending capped:** `max_order_usdt` per order, `max_total_deploy_usdt` in total, and a 5% drawdown safety stop. Code checks all of these before every order.
- **Fail-closed:** if the commit tx fails, there's no order that cycle. Bad or missing data gives a HOLD for that coin. Any failing step skips the cycle, the error is written to state, and the agent keeps running.
- **Crash-safe:** the salt and payload are written to disk before the commit. On restart, open commits are revealed first.
- **No secrets in the repo:** `.env` is git-ignored and never committed. The code never prints or logs keys.

## Honest limitations
- **Lower return than buy-and-hold** in the 180-day backtest, a loss with the mean-reversion arm on, and **no measurable forecasting skill** (IC ≈ 0, not significant). The backtest assumes fills at bar close, a 0.1% fee, no slippage and no AI analyst.
- **What commit-reveal proves:** that *sealed* decisions were never changed. It can't prove, on its own, that the agent never traded outside the ledger. Each reveal carries the OKX order id, so the record can be reconciled with the exchange account, but we haven't automated that.
- **No penalty for not revealing.** An unrevealed commit is public and counted, but nothing on chain punishes it. The contract also doesn't force cycle ids to be consecutive; a gap would be visible, and `npm run audit` doesn't assume continuity.
- **One live cycle so far**, by design (2 USDT, BTC only). The continuous loop runs in practice mode with real market data and real Fuji commits.
- **The AI analyst** was `skipped` on the live order (no key yet) and has not reduced or vetoed a trade so far. When its provider fails, decisions go through unchanged (fail-open), because it can only ever remove risk.
- **Hurst is an estimate,** not a regime detector, even on 168 bars. The gates only ever reduce or delay a buy, so a false alarm can at worst cost a missed entry.
- **The safety stop freezes; it doesn't close positions.** It measures the drop from the all-time equity peak. A rolling 7-day peak was tested (`engine/out/kill-switch-168.md`) and rejected: it lowered the backtest return.
- **5 coins, chosen by OKX TR volume.** More coins would add breadth, but they are highly correlated too; not done yet.
- **Testnet and unaudited.** The contracts run on Fuji and haven't been audited. The ERC-8004 Reputation and Validation registries are deployed but not written to yet.
- **The public site** shows a frozen snapshot of the agent's state; its chain checks run live from your browser.

## Repository layout
| Path | What |
|---|---|
| `engine/` | Deterministic quant engine (`validate_config`, `decide`, regime, gates, O-U arm, replay, backtests), pure Python |
| `analyst/` | AI analyst guard (`review_payload`), stdlib only |
| `agents/` | OKX Agent Trade Kit adapter (market data, guarded orders, journal) and the autonomous loop |
| `chain/` | Hardhat: ERC-8004 registries + `GrailLedger`, tests, Fuji deploy, `verify:cycle`, `audit` |
| `web/` | Vite + React + TypeScript site (TR / EN), static public build |
| `contracts/` | Shared schemas: config, decision/hash rule, `state.json`, `chain.json` |
| `docs/` | Tutorial, pitch, demo runbook, jury FAQ, UI copy |
| `coord/` | How the AI team was coordinated: tasks, state, handoffs, reviews |

## Team
Serdar Arif ([@WalAngeL06](https://github.com/WalAngeL06)), solo builder, working with a coordinated team of AI coding agents (Codex, Claude Code, Antigravity) under the rules in [AGENTS.md](AGENTS.md).
