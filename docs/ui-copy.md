# GRAIL — UI copy (T-013 · contracts v0.6)

Plain-English text for end users. Owner of the text: docs. Owner of the code: web.
Sources: `docs/ui-brief.md`, design handoff `design_handoff_grail_dashboard/README.md`, and the pitch deck terms, so the UI and the slides use the same words.

**Rules**
- `{field}` = value from `runtime/state.json`. `{a|b}` = pick by state. Never show an invented number; if a field is missing, show "—".
- Plain name first, technical name second and muted: **Independent bets** · n_eff. The jury's crypto researcher still sees the real term.
- Sentences are short and active. No "please". No exclamation marks.
- Icons: the design uses no icon library. Each card has a [Lucide](https://lucide.dev) name (if web adds `lucide-react`) and a glyph fallback that Inter / JetBrains Mono can render.

---

## (a) "How it works" — 5 cards

| # | Title | Text (2 sentences) | Icon (Lucide · fallback) |
|---|---|---|---|
| 1 | **Independent bets** | Coins that rise and fall together act like one bet, so five coins can be worth barely more than one. GRAIL counts real bets, not coins, and sizes every position by them. | `layers` · `ρ̄` |
| 2 | **Sealed envelope** | Before any order, GRAIL writes a fingerprint of its decision to Avalanche, like sealing an envelope. After the trade it opens the envelope, so anyone can check that nothing changed. | `mail-check` · `‖` |
| 3 | **AI second opinion** | An AI reviews each buy and can make it smaller or cancel it. It can never make a trade bigger, and it never blocks a sell. | `scan-eye` · `?` |
| 4 | **Safety limits** | The agent can only buy and sell spot coins from its list, with hard caps per order and in total. It cannot withdraw money or borrow, and an emergency stop halts trading after a set loss. | `shield-check` · `✓` |
| 5 | **OKX + Avalanche** | OKX Agent Trade Kit gives GRAIL live prices and places its orders on OKX TR. Avalanche keeps the record of every decision, which no one can edit. | `link` · `↗` |

Section title: **How it works** · subtitle: "Five ideas behind every decision GRAIL makes."

---

## (b) Glossary — plain name + one sentence

Use the plain name as the visible label, and the term plus the sentence as the tooltip / info popover.

| Term | Plain name | One sentence |
|---|---|---|
| n_eff (effective N) | **Independent bets** | How many truly separate bets your coins add up to, once you account for how much they move together. |
| ρ̄ (average correlation) | **Togetherness** | How much the coins rise and fall together, from 0 (independently) to 1 (in lockstep). |
| Sharpe ratio (SR) | **Return per unit of risk** | How much return you get for each unit of price swing you live through; higher is better. |
| PSR (probabilistic Sharpe) | **Skill confidence** | How sure we can be that the return per unit of risk is real and not luck; it needs some trading history first. |
| HRP (hierarchical risk parity) | **Family-based sizing** | Coins that behave alike are grouped into families, and each family gets its fair share of risk. |
| commit | **Seal** | A fingerprint of the decision is written to Avalanche before any order is sent. |
| reveal | **Open** | After the order, the full decision and its random code are published so the seal can be checked. |
| open / unrevealed commit | **Unopened envelope** | A sealed decision that has not been opened yet; it stays visible on chain, so none can be hidden. |
| hash (keccak256) | **Fingerprint** | A short code computed from the decision; change one character and the fingerprint changes completely. |
| salt | **Random code** | A random value sealed together with the decision, so nobody can guess the decision from its fingerprint early. (Not a password or wallet key.) |
| dry run | **Practice mode** | Decisions are made and sealed for real, but orders are only simulated; no money moves. |
| kill switch (drawdown) | **Emergency stop** | If the account drops by the set percentage, the agent stops placing new orders. |
| fail-closed | **Safe stop** | When something important fails, the agent does nothing rather than guess. |
| volatility | **Price swings** | How much a coin's price typically moves up and down over a year. |
| risk budget per coin | **Risk cap per coin** | The most price swing any single coin may add to the portfolio. |
| cycle | **Check-in** | One full round: read the market, decide, seal, trade, open. |
| ERC-8004 agent ID | **On-chain ID card** | The agent's public registration on Avalanche; only this agent can write to its record. |
| Fuji | **Avalanche test network** | Avalanche's public test chain: real blockchain, test coins. |
| Snowtrace | **Block explorer** | A public website where anyone can look up any Avalanche transaction. |
| BUY / SELL / HOLD | **Buy / Sell / Hold** | Hold is a decision too, and it is sealed like any trade. |
| llm_flag | **AI verdict** | `approved` kept as is · `reduced` made smaller · `vetoed` turned into a hold · `exempt` sells are not reviewed · `skipped` AI not available, decision unchanged. |

---

## (c) Screen headers + live summary sentence

Each screen: **title** (h1), **subtitle** (static, muted), **live summary** (one sentence under it, refreshed every poll). Pick the variant by state.

### Dashboard
- Title: **Dashboard**
- Subtitle: "How many real bets you hold, and what the agent is doing right now."
- Live summary:
  - Normal: "{n_assets} coins, {n_eff} independent bets. Last check-in #{cycle_id}: {buys} buy · {sells} sell · {holds} hold. Next in {countdown}."
  - All cash: "All in cash — every coin's trend is down, so the agent is waiting. Next check-in in {countdown}."
  - No decisions yet: "Waiting for the first check-in — next in {countdown}."
- Hero label: **Independent bets** · `n_eff` — sub: "out of {n_assets} coins · togetherness {avg_corr}"
- Holy Grail card title: **More coins, fewer real bets** · sub: "Return per unit of risk vs. number of coins"
- Chart footer: "Adding coins that move together adds almost nothing. GRAIL sizes positions by independent bets."
- What-if note: "Preview only. The agent keeps using today's togetherness ({avg_corr})." · reset link: "Back to live ({avg_corr})"

### Decisions
- Title: **Decisions**
- Subtitle: "What the agent decided for each coin, and why. Every check-in is sealed before any order."
- Live summary:
  - Normal: "Check-in #{cycle_id} at {time}: {buys} buy · {sells} sell · {holds} hold. Sealed {and opened|, waiting to be opened}."
  - Practice mode suffix: " Practice mode — orders were simulated."
  - Commit failed: "Check-in #{cycle_id} could not be sealed, so no order was sent."
- Toggle: "Only trades ({n})"

### On-chain Ledger
- Title: **On-chain record**  (menu label may stay "On-chain Ledger")
- Subtitle: "Every decision is sealed on Avalanche before the trade and opened after it. Nothing can be hidden or edited."
- Live summary:
  - All opened: "{commits} envelopes sealed, {reveals} opened. Every envelope is open."
  - Some open: "{commits} envelopes sealed, {reveals} opened, {unrevealed} still sealed — visible to everyone."
  - Empty: "No envelopes yet — the first one is sealed at the next check-in."
- Counter subs: Commits → "sealed before any order" · Reveals → "opened and checkable" · Unrevealed (>0) → "Still sealed — they stay visible, so no decision can be hidden." · Unrevealed (0) → "Every envelope has been opened."
- Identity card title: **On-chain ID card** · "Agent #{agent_id} · registered on Avalanche Fuji (ERC-8004)"

### Settings
- Title: **Settings** + tag "READ-ONLY"
- Subtitle: "What the agent is allowed to do. The limits live in its settings file and are checked in code before every order."
- Live summary:
  - Practice: "Practice mode: decisions are sealed for real, orders are simulated. Max {max_order_usdt} per order, {max_total_deploy_usdt} in total, emergency stop at −{kill_switch_drawdown_pct}%."
  - Live: "Live mode: real orders on OKX TR. Max {max_order_usdt} per order, {max_total_deploy_usdt} in total, emergency stop at −{kill_switch_drawdown_pct}%."
- Mode note: "Switching to live is done by a person in the settings file, not by a button here."

### Verify yourself (sheet)
- Title: **Check it yourself** · button label stays **Verify yourself**
- Intro: "Your browser rebuilds the fingerprint from the opened decision and compares it with the seal on Avalanche. Nothing is sent to a server."
- Row labels: "Fingerprint computed in your browser" · "Fingerprint the agent reported" · "Seal on Avalanche"
- Match: **"Match — you didn't have to trust us."** Sub: "All {n} decisions in check-in #{cycle_id}, holds included, are exactly what was sealed at {time}, before any order."
- Mismatch: **"Mismatch."** Sub: "This decision no longer matches its seal. Changing a single digit breaks it."
- Try to cheat: "Change one number and check again." · button "Change {coin} {action} {old} → {new}" · reset "Put the original back"

---

## (d) Empty, waiting and error text

| Where | State | Text |
|---|---|---|
| Top bar | loading | "connecting…" |
| Top bar | mock data | badge "MOCK DATA" · tooltip "No live agent data found. Showing sample data." |
| Strip | stale | "No update from the agent for {age} — showing the last known state." · countdown "overdue" |
| Strip | read error | "Can't read the agent's data right now. Retrying — showing the last known state." |
| Strip | agent stopped | "The agent is stopped. No new check-ins until it is restarted." · countdown "paused" |
| Any screen | no decisions | "Waiting for the first check-in — next in {countdown}." |
| Dashboard | no positions | "All in cash — the trend filter is staying out of the market." + "{cash_usdt} available" |
| Dashboard | no correlation yet | "Not enough price history yet. Needs at least two coins with data." |
| Dashboard | PSR null | "— (needs more history)" |
| Decisions | step pending | "pending" |
| Decisions | all hold | "All hold — nothing to trade this check-in." |
| Decisions | only-trades filter | "+ {n} hold hidden" |
| Decisions | commit failed | "✕ Couldn't seal this decision, so no order was sent (safe stop)." |
| Decisions | order simulated | "SIMULATED" · tooltip "Practice mode — no real order was sent." |
| Decisions | reason missing | "No reason recorded." |
| Decisions | AI skipped | "AI review unavailable — decision unchanged." |
| Ledger | reveal missing | tag "OPEN" · tooltip "Sealed but not opened yet. It stays visible on chain." |
| Ledger | no agent ID yet | hide the ID card (per design) |
| Verify | computing | "computing…" |
| Verify | reading chain | "reading Avalanche…" |
| Verify | chain unreachable | "Couldn't reach Avalanche right now. Your browser check still ran; try again in a moment." |
| Verify | not opened yet | "Not opened yet — nothing to check until the envelope is opened." |
| Verify | mock data | "Sample data — there is nothing real to check." |
| Settings › Errors | none | "✓ No errors" |
| Settings › Errors | has rows | message shown verbatim; header note "The agent skips a check-in when a step fails, logs it here, and carries on." |
| Links | not a real hash | "Not a real transaction — no explorer link." |
| Copy | copied | "Copied {short}" |
