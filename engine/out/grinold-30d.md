# Grinold's Fundamental Law, measured on the 30-day replay

Source: `engine/data/okx-candles-1H.json` (real OKX hourly prices, last 30 days of the T-012 candle file, 1H bars), config `contracts/config.example.json`, same simulation as `scripts/replay_okx.py`. Script: `engine/scripts/grinold_ic.py` (deterministic; run twice, identical output). T-014 = momentum + entry gates (mean-reversion arm switched off inside the script only); T-017 = with the mean-reversion arm.

**Özet (TR):** T-014 için 24 saatlik ufukta IC = +0.0032, genişlik = 1.36 bağımsız bahis (yıllık ≈ 495), Grinold IR ≈ +0.07, gerçekleşen IR = +2.02; bu 30 günde tahmin isabeti anlamsız. T-017 için aynı ufukta IC = +0.0002, Grinold IR ≈ +0.00, gerçekleşen IR = +1.72 (anlamsız). 30 gün ve 5 yüksek korelasyonlu coin çok kısa bir örnek: genişlik (n_eff) ölçtüğümüz ve yönettiğimiz şey, isabet (IC) iddiamız yok.

## Definitions
- **Forecast** (primary): the engine's committed decision for each hour and coin, BUY = +1, HOLD = 0, SELL = −1. Also reported: target weight level and its hourly change.
- **Realized**: forward return `close[t+h] / close[t] − 1`, h = 1, 6, 24 hours. Looking forward is used only for scoring; the engine never sees it.
- **IC**: Spearman rank correlation, pooled over all (hour, coin) pairs. Significance: (a) the pooled IC on a non-overlapping subsample (every h-th hour) with its p-value; (b) the mean of the per-hour cross-sectional IC (5 coins) with a Newey-West t (lag h−1). Hours where all 5 forecasts are equal (e.g. all HOLD) have no cross-sectional IC and are skipped. "Significant" = p < 0.05 AND |NW t| ≥ 2.
- **Breadth**: mean n_eff (independent bets per hour, from the engine) × 8760 / h per year.
- **Grinold IR** ≈ IC × √breadth. **Realized IR** = annualized mean / sd of hourly strategy returns (cash earns 0).
- Headline horizon 24h was chosen before looking at results (the signal is a 48-hour trend).

## Results (forecast = BUY/HOLD/SELL score)

| Engine | Horizon | IC pooled | IC non-overlap | Mean cross-section IC | Breadth / yr | Grinold IR | Realized IR | Significant |
|---|---|---|---|---|---|---|---|---|
| T-014 | 1h | +0.0364 | +0.0364 (p=0.029) | +0.0383 (NW t=0.98) | 11,884 | +3.97 | +2.02 | no |
| T-014 | 6h | +0.0044 | +0.0278 (p=0.498) | +0.0531 (NW t=1.87) | 1,981 | +0.20 | +2.02 | no |
| T-014 | 24h | +0.0032 | -0.0389 (p=0.642) | +0.0080 (NW t=0.42) | 495 | +0.07 | +2.02 | no |
| T-017 | 1h | +0.0344 | +0.0344 (p=0.039) | -0.0047 (NW t=-0.14) | 11,884 | +3.75 | +1.72 | no |
| T-017 | 6h | +0.0008 | +0.0344 (p=0.402) | +0.0402 (NW t=1.66) | 1,981 | +0.04 | +1.72 | no |
| T-017 | 24h | +0.0002 | -0.0487 (p=0.560) | +0.0181 (NW t=0.99) | 495 | +0.00 | +1.72 | no |

Replay check: T-014 +2.03%, worst drop 4.33%, 220 trades; T-017 +1.63%, worst drop 4.54%, 295 trades (same as the official replays). Mean n_eff: T-014 1.36, T-017 1.36 out of 5 coins.

Other forecast definitions (pooled IC, non-overlap p):

| Engine | Horizon | Target weight level | Target weight change |
|---|---|---|---|
| T-014 | 1h | -0.0102 (p=0.539) | -0.0029 (p=0.863) |
| T-014 | 6h | -0.0166 (p=0.961) | -0.0006 (p=0.551) |
| T-014 | 24h | -0.0637 (p=0.092) | -0.0124 (p=0.644) |
| T-017 | 1h | -0.0076 (p=0.647) | -0.0036 (p=0.828) |
| T-017 | 6h | +0.0013 (p=0.266) | -0.0049 (p=0.922) |
| T-017 | 24h | -0.0133 (p=0.307) | -0.0137 (p=0.423) |

## Honest reading
- 30 days is short: at 24h there are only ~29 non-overlapping days × 5 coins. One month of mostly rising prices.
- The 5 coins move together (mean n_eff ≈ 1.4 of 5), so the 5 forecasts per hour are not 5 independent bets. That is exactly what n_eff measures.
- The breadth formula assumes a fresh independent forecast every h hours. Our trend signal changes slowly, so true breadth is lower and Grinold IR is an upper bound.
- Realized IR over 30 days has a standard error of about ±3.5 (annualized), so +2.02 (T-014) and +1.72 (T-017) are not statistically different from zero either. With IC ≈ 0, the gap between Grinold IR and realized IR is noise plus being mostly in cash in a rising month, not skill. The implied transfer coefficient (realized / Grinold IR) is left empty (null) when IC is not significant.
- Conclusion: we do not claim forecasting skill (IC) from this sample. What GRAIL measures and manages is breadth: it counts how many independent bets the coins really are (n_eff) and sizes as one group when they move together.
