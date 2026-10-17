# GRAIL — pitch outline (10 slides · 10 min incl. live demo)

Judging weights: **agent architecture & autonomy 35%** · product & strategy 25% · technical quality 20% · demo 20%.
Slides 5–7 (autonomy) get the most time. Jury questions from the Avalanche workshop are answered explicitly: live?, authority/limits,
verifiable identity & history, behavior on errors, problem & user. `<TBD>` = still unknown; no made-up figures. Real values below come from contracts/chain.json, agents runtime state, STATE and engine/out/replay.json. Deck: docs/pitch/GRAIL-pitch.pptx.

| # | Slide | Score focus | Time |
|---|---|---|---|
| 1 | Hook | product | 0:30 |
| 2 | Problem & user | product | 0:45 |
| 3 | Insight: effective bets | strategy | 0:45 |
| 4 | What GRAIL is | product / architecture | 0:30 |
| 5 | Autonomy I — the loop | **autonomy** | 1:00 |
| 6 | Autonomy II — narrow authority | **autonomy** | 0:45 |
| 7 | Autonomy III — when things go wrong | **autonomy** | 0:45 |
| 8 | Avalanche: commit before you trade | architecture / tech | 0:45 |
| 9 | Live demo | demo | 3:30 |
| 10 | Quality, next, close | tech quality | 0:45 |

---

### 1 · "5 coins. 1.36 independent bets (30-day average)."
- Big number from the live dashboard (Holy Grail hero)
- GRAIL — an autonomous trading agent you can verify
- OKX Agent Trade Kit × Avalanche Fuji
> **Note:** Open with the live number, not the team. "You bought five coins. Because they move together, over the last 30 days they behaved like 1.36 bets. And if an agent managed this for you, you couldn't check its record either."

### 2 · Problem: you can't audit a trading agent
- User: someone who wants to hand capital to a trading agent (or pick one from an agent marketplace)
- Records can't be verified: backtests are cherry-picked, screenshots edited, decisions "fixed" later
- "Diversified" crypto is usually a single correlated bet
> **Note:** Answers the jury's "problem & target user" question directly. Say it in one breath, then move on.

### 3 · Insight: count bets, not coins
- `n_eff = N / (1 + (N−1)·ρ̄)` · `SR_p = SR₁ · √n_eff` (Dalio's Holy Grail)
- 30-day replay on real OKX prices: 5 coins averaged 1.36 independent bets (live ρ̄ on the dashboard: `<TBD>`)
- GRAIL sizes positions by effective bets (HRP + volatility target), not by coin count
> **Note:** Show the curve with the "you are here" dot. One sentence on HRP: correlated coins share one risk budget.

### 4 · What GRAIL is — four parts
- **Perceive:** OKX ATK — candles, tickers, instruments, balance (read allowlist)
- **Decide:** deterministic engine → BUY/SELL/HOLD per coin; LLM analyst may only shrink or veto BUYs
- **Account:** commit on Avalanche → order on OKX TR → reveal; **Show:** dashboard with "Verify yourself"
> **Note:** "The LLM doesn't manage the money. Code does. The LLM can only say no."

### 5 · Autonomy I — the loop runs without a human
- Every 90 s: snapshot → decide → analyst → **commit** → order → reveal → state
- No per-trade approval: the human sets the config once, and the agent acts inside it
- 2 cycles sealed on Fuji so far (2 revealed, 0 open); HOLD is a decision and is committed too
> **Note:** This is the 35% slide. Show the architecture diagram from the README. Stress the ordering: the commit happens *before* the order, so the agent is bound before the market answers. The human's role is policy (the config), not clicking "approve".

### 6 · Autonomy II — narrow authority, capped spending
- API key: Read + Trade, **no withdraw**; spot only, no leverage, config coins only
- `max_order_usdt` 10 · `max_total_deploy_usdt` 50 · drawdown kill switch 5% (example config) — enforced in code before every order
- `dry_run` is on by default and part of the hash; going live is a human decision: first live order 17 Oct 15:37, BUY 2 USDT BTC, OKX `4017748393474314240`, filled
> **Note:** Mirrors the workshop principle: narrow the authority, cap the spend, keep the trail, keep a human gate. Show the Settings screen.

### 7 · Autonomy III — when things go wrong
- Commit tx fails → no order that cycle (fail-closed); any step errors → cycle skipped, error logged, agent keeps running
- Bad or missing data / zero volatility → HOLD for that coin, with the reason recorded
- Crash between commit and reveal → salt was saved first; on restart the open commit is revealed. Ambiguous order → look it up by id, never resend
> **Note:** Answers "what does it do on unexpected input?". If the error log has real entries, show one (`<TBD>`). 30-day replay: worst drop 7.5% vs 14.5% for buy-and-hold (return +1.8% vs +8.8%; no claim that it beats buy-and-hold).

### 8 · Avalanche: commit before you trade
- `GrailLedger` on Fuji: `commitDecision(hash)` before the order, `revealDecision(payload, salt, okxOrderId)` after
- ERC-8004 identity: agent #1; only the registered agent can write
- Open (unrevealed) commits are counted on chain → no cherry-picking. Commits 2 / reveals 2 / open 0. Live order: commit `0x16f2d129…9569` → reveal `0xae6537e9…41f7`
> **Note:** "Other teams write results to the chain. We write the *intent* before the trade." Contract: `0x1B5fcf6DeFf2F9375338A2C35932224522118851` (source verified on Snowtrace). Jury command: `cd chain && npm run verify:cycle:1` → MATCH. This is the real reason to use Avalanche, not a bonus checkbox.

### 9 · Live demo
- Dashboard → On-chain Ledger → Decisions (live cycle, Snowtrace, OKX order id, reveal, **Verify yourself ✅**) → Settings
- Follows `docs/ui-brief.md` §5; backup: the 2-minute video (`docs/demo-script.md`)
- Before going on stage: tabs open, real state loaded, dry_run/live badge visible
> **Note:** Let the jury click "Verify yourself" if they like. The cryptography moment: "Don't trust us — your browser just computed it."

### 10 · Quality, what's next, close
- Tests: engine + analyst 104, agents 157, contracts 38; deterministic payload, canonical JSON hash shared by Python, Solidity and the browser
- Next: risk-guardian agent writing to the ERC-8004 ValidationRegistry; reputation from revealed results; mainnet
- Repo: github.com/WalAngeL06/grail-agent
> **Note:** Close with: **"Backtests can lie. Avalanche can't."** Then stop talking.
