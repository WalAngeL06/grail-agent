# GRAIL — submission form text

## One-sentence summary
GRAIL is an autonomous, correlation-aware trading agent that trades on OKX TR through the OKX Agent Trade Kit and seals every decision on Avalanche *before* it places the order, so anyone can verify the agent's track record.

## Project description (~170 words)
If you hand your capital to an AI trading agent, you should be able to check its record. Today you can't: backtests are cherry-picked, screenshots get edited, decisions get "fixed" after the fact. On top of that, "diversified" crypto is often one bet: over the last 30 days our five coins behaved like 1.36 independent bets.

GRAIL runs an autonomous loop on OKX TR. It reads market data through the OKX Agent Trade Kit, and a deterministic quant engine (trend filter, HRP weights, volatility target, effective number of bets) decides BUY, SELL or HOLD for each coin. An optional LLM analyst can only shrink or veto a buy. Before any order, the agent commits keccak256(decision ‖ salt) to a GrailLedger contract on Avalanche Fuji, tied to its ERC-8004 identity (agent #1), then reveals it after the order. HOLDs are committed too, and unrevealed commits stay visible. Code enforces the limits: spot only, no leverage, no withdrawals, caps and a kill switch. Its first live order (BUY 2 USDT BTC, 17 Oct) is on chain. Anyone can re-check it: `npm run verify:cycle:1`.

---
Form notes (not part of the text):
- Avalanche contract address (form field): GrailLedger `0x1B5fcf6DeFf2F9375338A2C35932224522118851` — https://testnet.snowtrace.io/address/0x1B5fcf6DeFf2F9375338A2C35932224522118851#code
- Other contracts: IdentityRegistry `0x120A4E53A24ddd09991633b4Cb88c3feA6166721` · ReputationRegistry `0x326671e1e2e80121C3Cd53a9b9fA5751a669596F` · ValidationRegistry `0x1a9c67CA99391812D7b157748fB814F6c7dADf0C`
- GitHub → github.com/WalAngeL06/grail-agent (public at 18:30) · website → `<TBD>` · slides link → `<TBD>`
