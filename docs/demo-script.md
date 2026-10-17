# GRAIL — 2-minute demo video script

Screen order follows `docs/ui-brief.md` §5: Dashboard → On-chain Ledger → Decisions → Settings → Dashboard/Ledger.
Voiceover in English (~250 words, calm pace). `<TBD>` = read the real value off the screen while recording; never invent one.

## Before recording (checklist)
- [ ] Agent loop has been running long enough that the Ledger shows several committed and revealed cycles
- [ ] `web` running against the real state: `GRAIL_STATE_PATH=<path to runtime/state.json> npm run dev` (no **MOCK DATA** badge)
- [ ] Browser zoom 110%, 1920×1080, dark OS theme, notifications off
- [ ] Second tab: Snowtrace (testnet.snowtrace.io) ready; third tab: OKX TR order history (only if a live order exists)
- [ ] Pick one cycle with a BUY or SELL that is revealed and `verified` → note its cycle id: `<TBD>`
- [ ] The mode badge (DRY RUN / LIVE) is visible and the voiceover says which one it is

## Script
| Time | Screen | On-screen action | Voiceover |
|---|---|---|---|
| 0:00–0:08 | Dashboard | Static on the hero number "`<TBD>` effective bets" | "You hold five coins. Because they move together, you really hold `<TBD>` bets." |
| 0:08–0:20 | Dashboard | Drag the ρ slider down to ~0.1, then click "Reset to live ρ̄" | "This is the Holy Grail curve. Lower correlation means more real bets. GRAIL sizes every position by effective bets, not coin count." |
| 0:20–0:28 | Dashboard | Point at the last-cycle chips and the top-bar countdown | "It runs on its own. Every `<TBD>` seconds it reads OKX TR through the Agent Trade Kit and decides buy, sell or hold." |
| 0:28–0:40 | On-chain Ledger | Click the menu; pan over Commits / Reveals / Unrevealed counters | "The problem: you can't audit a trading agent. So GRAIL commits every decision to Avalanche before it trades. Even holds. Open commits stay visible, so there's no cherry-picking." |
| 0:40–0:52 | Decisions | Open the chosen cycle `<TBD>`; the lifecycle reads Decided → Committed → Ordered → Revealed → Verified | "Here's one cycle. The decision is hashed and committed first, then the order is placed, then everything is revealed." |
| 0:52–1:02 | Snowtrace tab | Click the commit tx ↗; show the block timestamp, then go back | "This commit was on chain before the order existed." |
| 1:02–1:10 | Decisions | Point at the OKX order id and order status (`filled` or `SIMULATED`) | "The order went to OKX TR. This run is `<TBD: dry run / live>`, and the mode is inside the hash." |
| 1:10–1:25 | Decisions | Click **Verify yourself** → "computing…" → ✅ three matching hashes | "Don't trust us. Your browser recomputes the hash from the revealed payload and salt, and checks it against the chain. It matches." |
| 1:25–1:42 | Settings | Pan over the mode badge, the limits table and the Guardrails list | "Its authority is narrow: spot only, no leverage, no withdrawals, per-order and total caps, and a drawdown kill switch. Code checks all of it before every order." |
| 1:42–1:50 | Settings › System | Show the Errors table (a real entry, or "No errors") | "If a step fails, the cycle is skipped and logged. If the commit fails, no order goes out." |
| 1:50–2:00 | On-chain Ledger | Contract card → "View on Snowtrace"; hold on the logo | "GRAIL: an agent whose track record you can verify. Backtests can lie. Avalanche can't." |

## After recording
- Cut to exactly ≤ 2:00; no music over the voiceover; burn in subtitles if there's time
- Upload unlisted, put the link in `coord/SUBMISSION.md` (integrator) and pitch slide 9
