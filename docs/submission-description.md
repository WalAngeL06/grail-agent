# GRAIL — submission form text

## One-sentence summary
GRAIL is an autonomous, correlation-aware trading agent that trades on OKX TR through the OKX Agent Trade Kit and seals every decision on Avalanche *before* it places the order, so anyone can verify the agent's track record.

## Project description (~150 words)
If you hand your capital to an AI trading agent, you should be able to check its record. Today you can't: backtests are cherry-picked, screenshots get edited, decisions get "fixed" after the fact. On top of that, most "diversified" crypto portfolios are really one bet, because the coins move together.

GRAIL runs an autonomous loop on OKX TR. It pulls candles, tickers and balances through the OKX Agent Trade Kit. A deterministic quant engine (trend filter, HRP weights, volatility target, effective number of bets) then decides BUY, SELL or HOLD for each coin. An optional LLM analyst can only shrink or veto a buy. Before any order is placed, the agent commits keccak256(decision ‖ salt) to a GrailLedger contract on Avalanche Fuji, tied to its ERC-8004 identity. After the order it reveals the decision. HOLDs are committed too, and unrevealed commits stay visible. Code enforces the limits: spot only, no leverage, no withdrawals, per-order and total caps, a kill switch, and dry-run by default. The dashboard recomputes every hash in your browser, so you don't have to trust us.

---
Form notes (not part of the text): contract address → `contracts/chain.json` → GrailLedger `<CHAIN_ADDRESS>`; GitHub → github.com/WalAngeL06/grail-agent (public at 18:30); website → `<TBD>`.
