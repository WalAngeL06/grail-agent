# GRAIL 180-day backtest: 5 strategies, same costs

Data: OKX public `history-candles` (no API key, read-only), 1H bars, fetched 2026-10-17T14:50Z. Test window 2026-04-20T15:00Z to 2026-10-17T14:00Z (4320 hourly bars), plus up to 168 bars of warm-up before it. Missing bars across all coins: 0 (not filled; only timestamps present for all 5 coins are used). Same simulation and costs as `scripts/replay_okx.py`: one decision per closed bar, fills at the bar close, 0.1% fee, start 50 USDT, min/max order and total-deploy limits and kill switch from `contracts/config.example.json`. Cash earns 0. No look-ahead. Script: `engine/scripts/backtest_long.py` (run twice, identical output). Daily portfolio values for charts: `backtest-180d.json`.

**Özet (TR):** 180 günde GRAIL varyantlarının hepsi zarar etti (temel motor -5.64%, T-014 -3.22%, T-017 -8.50%, varyant (e) -3.84%); al-tut +16.73% kazandı ama 32.7% düşüş yaşadı, GRAIL'in en kötü düşüşü 6.1–14.6% aralığında kaldı. Örneklem dışı 150 günde Sharpe al-tut +0.69, GRAIL varyantları -2.43 ile -1.06 arası: risk başına getiride de al-tutun gerisindeyiz. Kapılar (T-014) düşüşü 14.6% → 6.7% indirdi ama getiriyi pozitife çevirmedi; T-017'nin O-U kolu T-014'ten daha kötü; %5 güvenlik durdurmasının açık olduğu saat oranı T-017'de %76 ve kapatılınca üç motor da daha çok kaybediyor. Duyarlılık: base HASSAS, t014 HASSAS, t017 HASSAS (örn. t014|lookback168 +7.12%); bu bir aşırı uyum uyarısıdır, parametreleri buna göre DEĞİŞTİRMEDİK.

## Full 180 days

| Strategy | Return | Ann. vol | Sharpe | Worst drop | Calmar | Trades | Fees (USDT) | In market | Avg invested | Safety stop on |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) Buy and hold, equal weight | +16.73% | 46.5% | +0.91 | 32.66% | +1.13 | 5 | 0.05 | 100.0% | 100.0% | 0.0% of hours |
| (b) Base engine, no gates (pre T-014) | -5.64% | 15.8% | -0.67 | 14.57% | -0.76 | 673 | 3.91 | 95.5% | 31.9% | 78.3% of hours |
| (c) T-014: Hurst + breakout/retest gates | -3.22% | 10.5% | -0.58 | 6.65% | -0.96 | 814 | 3.86 | 50.9% | 15.5% | 31.1% of hours |
| (d) T-017: T-014 + mean-reversion arm | -8.50% | 8.4% | -2.09 | 9.79% | -1.68 | 478 | 2.43 | 23.7% | 8.8% | 75.9% of hours |
| (e) T-017, MR exit only on MR-bought amount | -3.84% | 11.1% | -0.66 | 6.11% | -1.25 | 957 | 4.53 | 57.5% | 17.6% | 26.6% of hours |

## Prior 150 days (out of sample: never looked at while building the engine)

| Strategy | Return | Ann. vol | Sharpe | Worst drop | Calmar | Trades | Fees (USDT) | In market | Avg invested | Safety stop on |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) Buy and hold, equal weight | +9.09% | 46.1% | +0.69 | 32.66% | +0.72 | 5 | 0.05 | 100.0% | 100.0% | 0.0% of hours |
| (b) Base engine, no gates (pre T-014) | -7.32% | 15.8% | -1.09 | 14.57% | -1.16 | 450 | 2.70 | 96.4% | 32.1% | 83.4% of hours |
| (c) T-014: Hurst + breakout/retest gates | -5.18% | 9.9% | -1.26 | 6.65% | -1.82 | 597 | 2.79 | 46.5% | 13.9% | 37.0% of hours |
| (d) T-017: T-014 + mean-reversion arm | -4.92% | 5.0% | -2.43 | 5.02% | -2.30 | 328 | 1.69 | 12.8% | 4.4% | 81.0% of hours |
| (e) T-017, MR exit only on MR-bought amount | -4.79% | 10.7% | -1.06 | 6.11% | -1.84 | 727 | 3.41 | 54.3% | 16.3% | 31.6% of hours |

## Last 30 days (already seen in T-012, so not out of sample)

| Strategy | Return | Ann. vol | Sharpe | Worst drop | Calmar | Trades | Fees (USDT) | In market | Avg invested | Safety stop on |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) Buy and hold, equal weight | +7.00% | 48.4% | +1.94 | 14.50% | +8.81 | 0 | 0.00 | 100.0% | 100.0% | 0.0% of hours |
| (b) Base engine, no gates (pre T-014) | +1.81% | 15.8% | +1.46 | 5.80% | +4.20 | 223 | 1.21 | 91.4% | 31.2% | 52.6% of hours |
| (c) T-014: Hurst + breakout/retest gates | +2.07% | 13.2% | +1.96 | 4.61% | +6.15 | 217 | 1.07 | 73.2% | 23.7% | 1.8% of hours |
| (d) T-017: T-014 + mean-reversion arm | -3.76% | 17.4% | -2.59 | 6.05% | -6.16 | 150 | 0.74 | 78.3% | 30.9% | 50.8% of hours |
| (e) T-017, MR exit only on MR-bought amount | +1.00% | 13.0% | +1.00 | 4.93% | +2.61 | 230 | 1.12 | 73.8% | 23.9% | 1.5% of hours |

Mean-reversion buys over 180 days: T-017 12, variant (e) 28.

## Month by month

Month boundaries are UTC. The first and last months are partial.

| Month | buy_hold | base | t014 | t017 | t017_mr_exit_only_mr |
|---|---|---|---|---|---|
| 2026-04 | -0.81% | -4.22% | -2.92% | -3.35% | -2.96% |
| 2026-05 | -0.79% | -1.07% | +0.57% | -1.63% | +0.54% |
| 2026-06 | -18.87% | -7.79% | -2.43% | -0.01% | -2.57% |
| 2026-07 | +6.07% | +0.42% | +0.01% | +0.00% | +0.23% |
| 2026-08 | +29.19% | +4.99% | +0.92% | +0.01% | +0.59% |
| 2026-09 | +15.57% | +3.75% | +2.68% | -0.26% | +2.60% |
| 2026-10 | -7.68% | -1.26% | -1.97% | -3.51% | -2.21% |

## Sensitivity (no tuning, report only)

Hurst thresholds ±0.05 (ranging/trending cut-offs 0.40/0.50 and 0.50/0.60), lookback 96 and 168 bars, mean-reversion entry z −1.0 and −2.0. Rule fixed before running: a strategy is called **sensitive** if any variant flips the sign of its 180-day return or its Sharpe range across variants is wider than 1.0.

| Variant | Return 180d | Sharpe 180d | Worst drop | Trades | Return OOS 150d | Sharpe OOS |
|---|---|---|---|---|---|---|
| **base (default)** | -5.64% | -0.67 | 14.57% | 673 | -7.32% | -1.09 |
| base|lookback96 | -12.55% | -1.67 | 14.72% | 436 | -6.65% | -1.36 |
| base|lookback168 | -1.36% | -0.04 | 17.92% | 625 | -4.00% | -0.39 |
| **t014 (default)** | -3.22% | -0.58 | 6.65% | 814 | -5.18% | -1.26 |
| t014|hurst-0.05 | +3.85% | +0.63 | 7.11% | 1187 | +1.69% | +0.36 |
| t014|hurst+0.05 | -3.02% | -0.54 | 6.89% | 786 | -5.40% | -1.29 |
| t014|lookback96 | +3.34% | +0.60 | 7.20% | 796 | +4.86% | +1.02 |
| t014|lookback168 | +7.12% | +1.16 | 5.81% | 641 | +5.17% | +1.01 |
| **t017 (default)** | -8.50% | -2.09 | 9.79% | 478 | -4.92% | -2.43 |
| t017|hurst-0.05 | -6.98% | -1.69 | 8.21% | 614 | -5.58% | -2.19 |
| t017|hurst+0.05 | -8.55% | -1.58 | 9.84% | 1102 | -5.57% | -1.45 |
| t017|lookback96 | +4.99% | +0.83 | 7.30% | 1079 | +5.88% | +1.13 |
| t017|lookback168 | -2.55% | -0.52 | 5.76% | 628 | -3.16% | -0.85 |
| t017|mr_z-1.0 | -7.24% | -1.71 | 7.84% | 802 | -4.93% | -1.31 |
| t017|mr_z-2.0 | -3.40% | -0.54 | 6.55% | 1345 | -4.63% | -0.93 |

- base: Sharpe range -1.67 to -0.04, return range -12.55% to -1.36% → **SENSITIVE: overfitting warning, do not trust the default numbers alone**
- t014: Sharpe range -0.58 to +1.16, return range -3.22% to +7.12% → **SENSITIVE: overfitting warning, do not trust the default numbers alone**
- t017: Sharpe range -2.09 to +0.83, return range -8.55% to +4.99% → **SENSITIVE: overfitting warning, do not trust the default numbers alone**

## Safety stop (kill switch) context

The config stops all trading while the account is 5% or more below its highest value so far, and it does not sell: positions stay frozen until the account recovers. Over 180 days this rule decides a lot. The 'off' rows show what the same strategy would have done with the stop disabled. This is context only, not a tuned setting: the live config keeps the 5% stop.

- base: first safety stop at 2026-05-01T17:00Z.
- t014: first safety stop at 2026-06-26T10:00Z.
- t017: first safety stop at 2026-05-19T03:00Z.
- t017_mr_exit_only_mr: first safety stop at 2026-06-30T11:00Z.

| Strategy | Safety stop | Return 180d | Sharpe | Worst drop | Trades | Stop on | Return OOS 150d | Sharpe OOS |
|---|---|---|---|---|---|---|---|---|
| base | 5% (config) | -5.64% | -0.67 | 14.57% | 673 | 78.3% | -7.32% | -1.09 |
| base | off | -17.22% | -2.11 | 17.71% | 2578 | 0.0% | -16.33% | -2.42 |
| t014 | 5% (config) | -3.22% | -0.58 | 6.65% | 814 | 31.1% | -5.18% | -1.26 |
| t014 | off | -4.48% | -0.67 | 12.59% | 1307 | 0.0% | -6.21% | -1.17 |
| t017 | 5% (config) | -8.50% | -2.09 | 9.79% | 478 | 75.9% | -4.92% | -2.43 |
| t017 | off | -10.99% | -1.98 | 15.33% | 1765 | 0.0% | -12.21% | -2.72 |

## Data check

| Coin | Bars | First | Last | Missing bars | Bad rows |
|---|---|---|---|---|---|
| AVAX-USDT | 4512 | 2026-04-12T14:00Z | 2026-10-17T13:00Z | 0 | 0 |
| BTC-USDT | 4512 | 2026-04-12T14:00Z | 2026-10-17T13:00Z | 0 | 0 |
| ETH-USDT | 4512 | 2026-04-12T14:00Z | 2026-10-17T13:00Z | 0 | 0 |
| OKB-USDT | 4512 | 2026-04-12T14:00Z | 2026-10-17T13:00Z | 0 | 0 |
| SOL-USDT | 4512 | 2026-04-12T14:00Z | 2026-10-17T13:00Z | 0 | 0 |

## Honest reading
- Every GRAIL variant lost money over 180 days and over the 150 out-of-sample days. Buy-and-hold made +16.73% but fell 32.7% on the way; GRAIL's worst drop stayed between 6.1% and 14.6%. On risk-adjusted terms (Sharpe), GRAIL is still behind buy-and-hold.
- The entry gates (T-014) cut the worst drop of the base engine by more than half, but did not make it profitable. The mean-reversion arm (T-017) is worse than T-014 over 180 days.
- The 5% safety stop was on for a large share of hours. Turning it off makes all three engines lose more, so the stop helped.
- All three engines are sensitive to their thresholds (some variants flip to a gain). Picking the best variant after the fact would be overfitting, so the defaults stay unchanged.
- The last 30 days continue from the state at day 150, so they differ slightly from the T-012 replay, which started flat.
- One 180-day period of 5 highly correlated coins is still a small sample. Sharpe over 150 days has a standard error of about ±1.5.
- The GRAIL variants hold mostly cash (see 'Avg invested'), so they should be compared with buy-and-hold on risk (worst drop, volatility, Sharpe), not on raw return.
- Variant (e) needs the backtest to remember which coins were bought by the mean-reversion arm. The live engine is stateless and cannot do this yet, so (e) is a what-if, not a ready feature.
