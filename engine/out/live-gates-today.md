# What the entry gates did today: live dry run, Oct 17 2026

Source: the agent's own files, read-only copies taken at 14:00 UTC (17:00 local) and frozen at cycle 50: `agents/runtime/dryrun-5coin-20261017-1545/` (`state.json`, `fuji-transactions.json`, `restart-*-cycle-*.json`) and `agents/runtime/live/state.json`. Every number below comes from those files; the raw numbers are in `live-gates-today.json`.
Mode: `dry_run: true`. Real OKX prices, real Avalanche Fuji commit/reveal, no real orders. Coins: AVAX, BTC, ETH, OKB, SOL. Signals use 48 closed 1H bars.

**Özet (TR):** T-014 kapıları devreye girince aynı piyasa verisiyle döngü başına alım 5 emirden 1 emre, simüle alım tutarı 19.02 USDT'den 2.64 USDT'ye indi. 4 coin "ranging" (Hurst 0.32–0.42) sayıldığı için alımları durdurdu, ETH kırılım olmadığı için yarım boyutla alındı; hiçbir kapı yeni alım üretmedi. Hurst 48 barla yapılmış bir tahmindir, kesin tespit değildir; bu yüzden kapılar "piyasa yatay" diye kanıtlamaz, sadece belirsizlikte temkinli davranır.

## 1. Before vs after T-014 (buy decisions)

| | Cycles | Time (UTC) | BUY per cycle | Simulated buy USDT per cycle | Simulated buy USDT total |
|---|---|---|---|---|---|
| Before T-014 (all) | 3–33 (31) | 12:46–13:31 | 5.0 | 18.97 | 588.00 |
| **Before T-014, same bars** | **12–33 (22)** | **13:00–13:31** | **5.0** | **19.02** | 418.44 |
| **After T-014** | **34–50 (17)** | **13:34–13:58** | **1.0** | **2.64** | 44.88 |

- Cycles 12–50 all ran between 13:00 and 13:59 UTC, so they all used **the same 48 closed hourly bars**. The cleanest comparison is 12–33 vs 34–50: same market data, only the engine changed. Result: 5 buys → 1 buy per cycle, **19.02 → 2.64 USDT per cycle (−86%)**.
- SELL decisions: 0 before and 0 after. The gates did not create any sells.
- Caution about totals: in dry run, simulated fills do not change the account, so the agent proposes the same buys again every cycle. Per-cycle numbers are meaningful; the cumulative totals overstate what a real account would buy, since the 50 USDT deploy cap would stop buying after a few cycles.

## 2. After T-014, per coin (cycles 34–50, 17 cycles)

| Coin | Hurst | Regime (cycles) | Setup (cycles) | Result (cycles) | Before T-014, same bars |
|---|---|---|---|---|---|
| AVAX | 0.42 | ranging 17 | none 17 | HOLD, ranging: 17 | BUY 3.12 |
| BTC | 0.32 | ranging 17 | none 17 | HOLD, ranging: 17 | BUY 3.28 |
| ETH | 0.64 | trending 17 | none 17 | half size: 17 (BUY 2.64) | BUY 5.29 |
| OKB | 0.39 | ranging 17 | none 17 | HOLD, ranging: 17 | BUY 5.27 |
| SOL | 0.42 | ranging 17 | none 17 | HOLD, ranging: 17 | BUY 2.06 |

- Results counted: HOLD, ranging = 68; HOLD, waiting for breakout retest = 0; half size = 17; full size = 0.
- ETH 2.64 is exactly half of its old 5.29 (rounded down to the cent).
- Hurst range per coin is a single value because the bars did not change during 34–50.
- Where the signals come from:
  - `metrics.signals` is stored in 5 snapshots (cycles 34, 35, 45, 46, 50), and all 5 are identical.
  - For the 4 ranging coins, the Hurst value also appears in the reason text in all 17 cycles.
  - For the other 12 cycles, ETH's regime and setup and the other coins' setup are taken from those snapshots. Those cycles used the same bars and gave identical decisions, and the engine is deterministic.

## 3. AI analyst (second opinion on each decision)

| Cycles | approved | reduced | vetoed | skipped |
|---|---|---|---|---|
| 3–23 (before) | 105 | 0 | 0 | 0 |
| 24–33 (before) | 0 | 0 | 0 | 50 provider_error |
| **34–44 (after)** | **0** | **0** | **0** | **50 provider_error + 5 timeout** |
| 45–50 (after) | 5 | 0 | 0 | 5 timeout + 20 not sent (HOLD) |

- Honest note: from cycle 24 to 44 the AI provider failed. `skipped: provider_error` in 20 cycles (24–38, 40–44) and `timeout` in cycle 39 was the Gemini quota problem. So **the AI analyst gave no opinion in cycles 34–44**. The engine and the on-chain record kept running: when the analyst fails, the engine's decision stands (fail-open).
- After the provider restart (cycle 45+): 5 of the 6 ETH buys were approved, and cycle 48 timed out. In cycles 45–50, HOLD decisions were not sent to the analyst (empty note).
- The analyst never reduced or vetoed a decision today (0 / 0).

## 4. Errors and on-chain record

- Engine errors: 0. `state.errors` was empty at cycle 50, and no decision has an "Engine error" reason (240 decisions, cycles 3–50).
- Avalanche Fuji, contract `0x1B5fcf6DeFf2F9375338A2C35932224522118851`, cycles 3–50:
  - 48 commit transactions and 48 reveal transactions, all `confirmed` in the tx log.
  - All 240 decisions have a commit tx and a reveal tx, and are marked `verified: true`.
  - HOLD decisions are committed too.
  - The integrator's `npm run audit` result (48/48 MATCH) is separate; it was not re-run here.
- The live order cycle (`runtime/live/state.json`, cycle 2): BTC BUY 2.00 USDT, `filled` at 81538.6, 2 commits / 2 reveals, 0 errors. This ran on the pre-T-014 engine, so the gates were not active for the real order.

## 5. Honest reading

Yes, the gates cut buying: on identical market data, buys per cycle fell from 5 to 1 and buy size by 86%, without creating any buy or sell the old engine would not have made. But Hurst on 48 hourly bars is an estimate, not proof. On pure random data, about 41% of 48-bar windows are labeled "ranging" (review R-009-5). So "4 of 5 coins ranging" means the agent chose caution, not that the market was proven to be ranging.
