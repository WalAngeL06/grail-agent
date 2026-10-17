# GRAIL — jury FAQ (12 hard questions, short honest answers)

For the presenter. Answers are in English, like the deck. Say the **bold line** first; the rest is backup if they push.
Every number here comes from the repo: `coord/STATE.md` r26, `contracts/chain.json`, `engine/out/replay.json` and the agents live runtime state. Don't round up and don't improvise new numbers.

---

### 1. What if the agent never reveals?
**Then everyone can see it. The commit stays on Avalanche, and the contract counts commits and reveals separately.**
- The ledger stores one commit per (agent, cycle) and counts reveals; "unrevealed" shows on the dashboard and on chain. Today: 2 committed, 2 revealed, 0 open.
- Without the salt, nobody can open the envelope, and the agent can't swap in a different decision either: the contract rejects any payload that doesn't match the hash (`HashMismatch`).
- Crash safety: the payload and salt are saved to disk *before* the commit, and on restart the agent reveals any open commit first.
- Honest limit: there is no on-chain penalty (slashing) for an unrevealed commit yet. The only cost is reputation, but that cost is public and permanent.

### 2. Commit-reveal, why not a normal log?
**A log can be edited, and you can show only the parts you like. A commit on Avalanche is timestamped before the order and can't be changed afterwards.**
- The hash locks the decision before the market answers. You can't "fix" a bad call later.
- Why not publish the decision in plain text before trading? That would let others front-run or copy the order. The salt keeps the sealed decision unreadable until after the trade. With only buy/sell/hold for 5 coins, the decision could otherwise be guessed from its hash.
- Honest limit: commit-reveal proves that *sealed* decisions weren't changed. On its own, it can't prove the agent never traded outside the ledger. Each reveal carries the OKX order id, so the record can be reconciled against the exchange account; we haven't automated that reconciliation.

### 3. Why Fuji and not mainnet?
**It's a hackathon build with unaudited contracts, and the organizers provided test AVAX. Nothing in the design is Fuji-specific.**
- The same contracts and deploy script work on C-Chain mainnet; only the network config changes.
- We'd want an audit first, and a decision on who pays for the agent's gas.
- The trades are already real: the first live order went to OKX TR with real funds. Only the *record* is on testnet.

### 4. Your return is lower than buy-and-hold. Why is that good?
**It isn't better on return, and we don't claim it is. GRAIL is built to control risk and to be verifiable.**
- 30-day replay on real OKX hourly prices (17 Sep → 17 Oct, 50 USDT): GRAIL +1.8% with a worst drop of 7.5%; equal-weight buy-and-hold of the same 5 coins +8.8% with a worst drop of 14.5%.
- Replay assumptions: fills at bar close, 0.1% fee, no slippage, no AI analyst. 30 days is far too short to judge a strategy.
- The emergency stop (5%) blocks new orders; it does not sell. That's why the worst drop (7.5%) can be larger than 5%, and the stop paused trading for 23% of the replay.
- The product is the *verifiable record*. Any strategy, better or worse, can plug into the same seal-trade-open loop.

### 5. When does the AI analyst veto?
**It only ever looks at buys. It can keep a buy, make it smaller or turn it into a hold. It can never add risk, and it never touches sells.**
- Code enforces this regardless of what the model says: an opposite direction becomes HOLD, a larger size is clamped back, and anything below the minimum order becomes HOLD.
- No key, a timeout (max 8 s) or a bad reply → the decision goes through unchanged, flagged `skipped`.
- The AI's note and flag go *into the hash*, so its opinion is sealed too.
- Honest: on the first live order the analyst did **not** run (`llm_flag: skipped: no_provider`). The API key was added afterwards, and we haven't yet shown a cycle where it vetoed something live.

### 6. What does ERC-8004 add?
**A public, portable ID for the agent. The record belongs to a registered identity (agent #1), not to an anonymous wallet.**
- GrailLedger only accepts commits and reveals from the registered agent's owner or an approved operator. Anyone else's call reverts.
- If the agent moves to a new wallet or a marketplace, the identity and its record move with it.
- Honest: the Reputation and Validation registries are deployed but not written to yet. The next step is a second "risk guard" agent that writes validations there.

### 7. How did you limit the real-money risk?
**Narrow permissions, hard caps checked in code, practice mode by default, and a human who has to switch on live mode explicitly.**
- The OKX API key has Read + Trade only, with no withdraw right. Orders are spot only, with no leverage, and only for coins in the config. The code has no withdrawal, transfer, leverage or account-settings calls.
- Limits are checked before every order: max per order, max in total, drawdown emergency stop.
- Live mode needs three things together: a config with `dry_run: false`, the `--live --confirm-live GRAIL-LIVE-SPOT` flags, and a real Fuji chain.
- The first live order was deliberately tiny: one coin (BTC), 2 USDT, one cycle, run by a person watching it. It was filled (OKX order 4017748393474314240).
- The AI coding tools that built this could only read market data; only the agent's own code can place orders.

### 8. What does correlation awareness actually change?
**Position sizes. Coins that move together share one risk budget instead of each getting its own.**
- HRP groups similar coins into families and splits risk between families first, then inside them.
- The volatility target uses portfolio volatility, which already includes correlation. When coins move together, the portfolio is riskier, so total exposure is scaled down.
- It also tells the user the truth: over the last 30 days, 5 coins behaved like 1.36 independent bets.
- Honest: we haven't run a with/without-correlation comparison (ablation), so we don't claim a number for its effect on returns.

### 9. Is it really autonomous?
**Yes. Each cycle runs on its own: read market → decide → AI check → seal → order → open → update. Nobody clicks "approve".**
- The human sets the rules (config) and decides whether live mode is on. The agent doesn't change either.
- Honest: in live mode we have run exactly one cycle, by choice, for safety. The continuous loop has run in practice mode with real market data and real Fuji commits.

### 10. What happens when OKX or Avalanche fails mid-cycle?
**It stops safely. If the commit fails, no order is sent. If an order result is unclear, it looks the order up by ID and never sends it twice.**
- Any failing step skips the cycle, logs the error, and the agent carries on with the next one.
- Missing or broken price data → HOLD for that coin, with the reason recorded.
- Every order has a client ID in a persistent journal, so an unknown result blocks new live orders until it's resolved.

### 11. Can the agent commit many decisions and reveal only the good one?
**No. The contract allows exactly one commit per cycle for this agent. A second commit for the same cycle reverts (`AlreadyCommitted`).**
- Cycle IDs are persistent and only go up; a restart doesn't reuse them.
- Honest: the contract doesn't force cycle IDs to be consecutive. A skipped number would show up as a visible gap in the record, but nothing on chain blocks it.

### 12. How do I verify it myself, without trusting you?
**Three ways: the "Verify yourself" button in the dashboard, the terminal command, and Snowtrace.**
- Dashboard: your browser recomputes `keccak256(payload ‖ salt)` and compares it with the commit transaction on Fuji.
- Terminal: `cd chain && npm run verify:cycle:1`. It decodes the payload and salt from the reveal transaction's calldata, recomputes the hash and compares it with the commit stored on chain → `MATCH`. It needs no wallet and no keys.
- Snowtrace: all 4 contracts have verified source code, e.g. GrailLedger https://testnet.snowtrace.io/address/0x1B5fcf6DeFf2F9375338A2C35932224522118851#code

---

### Don't say
- "It beats the market" / "profitable": the replay shows a lower return.
- "The AI approved the live trade": it was `skipped`.
- "The kill switch caps losses at 5%": it blocks new orders; it doesn't close positions.
- "Fully audited" or "production-ready".
