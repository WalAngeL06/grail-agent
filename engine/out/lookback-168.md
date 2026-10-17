# Lookback 48 → 168 hours: check, backtest, recommendation

User decision: the engine's lookback goes from 48 to 168 hourly bars (weekly regime). The reason predates the data: Hurst on 48 bars is noisy (review R-009-5). This page checks that the engine scales with it, compares both settings on the same 180-day backtest, and recommends whether the mean-reversion arm (T-017) stays on.

**Özet (TR):** Motorda 48'e sabitlenmiş bir hesap yok; Hurst, kırılım tepesi, O-U ve trend penceresi config'teki `lookback_bars` ile ölçekleniyor, bu yüzden kod değişikliği gerekmedi. 168 saatte T-014 180 günde +7.12% (örneklem dışı 150 gün +5.17%, Sharpe +1.01) verirken T-017 −2.55% (örneklem dışı −3.16%) verdi. Bu yüzden O-U kolunu varsayılan KAPALI yaptık (`MR_ENABLED = False`; O-U yine hesaplanıp ekranda gösteriliyor). Uyarı: 168, duyarlılık testinde en iyi çıkan değerdi; bu sonuç tek bir 180 günlük dönemden geliyor, aşırı uyum riski var ve sunumda böyle söylenmeli.

## 1. Does the engine scale with lookback 168?

Yes, so no code change was needed for the lookback itself. Nothing in the calculations is fixed to 48; the only "48" in `decision.py` is a comment.

| Piece | How it uses the window | 168 bars |
|---|---|---|
| Trend | `close_last / close_first − 1` over the whole lookback window | 7-day trend |
| Hurst (DFA) | scales 4 … n/4 on the window's returns; small-sample bias computed for that exact n (cached) | scales 4 … 42 |
| Breakout setup | range top = highest close in the first 2/3 of the window | first 113 of 169 closes |
| O-U fit | regression over the whole window; half-life limits 1–12 h are in hours, not bars | unchanged rule |
| Minimum data | a coin needs `min(lookback, 10)` returns; with less it is HOLD | unchanged |
| Vol / HRP / n_eff | computed on the window's returns | 7-day estimates |

To run with 168, the agent must send at least 169 closed 1H bars per coin. That is within one OKX candles call (limit 300), but it is the agents' side to check.

## 2. Backtest: 48 vs 168 (same 180 days, same costs)

Same data and simulation as `backtest-180d.md` (OKX public 1H candles, 0 missing bars, 0.1% fee, 50 USDT, config limits, 5% safety stop). Script: `engine/scripts/lookback_168.py` → `lookback-168.json`. Run twice, identical.

| Engine | Lookback | Period | Return | Sharpe | Worst drop | Trades | Safety stop on |
|---|---|---|---|---|---|---|---|
| T-014 | 48 | 180 days | −3.22% | −0.58 | 6.65% | 814 | 31.1% |
| T-014 | 48 | prior 150 days (out of sample) | −5.18% | −1.26 | 6.65% | 597 | 37.0% |
| T-014 | 48 | last 30 days | +2.07% | +1.96 | 4.61% | 217 | 1.8% |
| **T-014** | **168** | **180 days** | **+7.12%** | **+1.16** | **5.81%** | **641** | **8.1%** |
| **T-014** | **168** | **prior 150 days (out of sample)** | **+5.17%** | **+1.01** | **5.81%** | **535** | **9.7%** |
| T-014 | 168 | last 30 days | +1.85% | +2.06 | 2.92% | 106 | 0.0% |
| T-017 | 48 | 180 days | −8.50% | −2.09 | 9.79% | 478 | 75.9% |
| T-017 | 48 | prior 150 days (out of sample) | −4.92% | −2.43 | 5.02% | 328 | 81.0% |
| T-017 | 48 | last 30 days | −3.76% | −2.59 | 6.05% | 150 | 50.8% |
| T-017 | 168 | 180 days | −2.55% | −0.52 | 5.76% | 628 | 31.9% |
| T-017 | 168 | prior 150 days (out of sample) | −3.16% | −0.85 | 5.76% | 470 | 37.2% |
| T-017 | 168 | last 30 days | +0.63% | +0.74 | 3.34% | 158 | 5.1% |

Mean-reversion buys over 180 days: T-017 at 48 → 12, at 168 → 14. For reference, buy-and-hold over the same 180 days: +16.73%, Sharpe +0.91, worst drop 32.66%.

Honest caveats:
- 168 was already the best lookback in the sensitivity table of `backtest-180d.md`. Choosing it after seeing that table is overfitting risk, even though the reason for a longer window existed before. Sharpe over 150 days has a standard error of about ±1.5, so +1.01 is not proof.
- At 168, T-014 is still behind buy-and-hold on return (+7.12% vs +16.73%) but with a much smaller worst drop (5.81% vs 32.66%). On Sharpe they are close (+1.16 vs +0.91), well within that error.

## 3. Recommendation: mean-reversion arm OFF at 168

At 168, T-017 loses to T-014 in every period: 180 days −2.55% vs +7.12%, out of sample −3.16% vs +5.17%, last 30 days +0.63% vs +1.85%. The arm also adds trades and keeps the safety stop on four times as often (31.9% vs 8.1% of hours).

Done in code: `decision.MR_ENABLED = False` (default).
- With the flag off, the O-U fit is still computed and reported in `metrics.signals[inst].ou` (half-life, z, significant), so the UI can still show it. `sleeve` reads `"none"` for ranging coins, because no arm acts on them; trending/unclear coins stay `"momentum"`.
- Decisions are then identical to T-014. A test checks this, and that the default is off.
- To switch the arm on, set `MR_ENABLED = True`. All T-017 tests run with it on.
- The analysis scripts turn it on explicitly for their T-017 runs.

## 4. Safety stop (kill switch): why it locks the engine for so long

- **How it works now:** the engine computes the drawdown as `1 − equity / peak_equity_usdt` and holds every coin (no buys, no sells) while it is 5% or more. `peak_equity_usdt` is the highest equity ever seen. In the replay it is the running maximum; in the live agent it is stored in `control.json`. It never resets. So the stop releases only when equity climbs back to within 5% of that all-time peak.
- **Why that locks it:** while the stop is on, the engine is frozen, and GRAIL holds mostly cash (on average 10–30% invested). The only way back is the frozen coins rising enough to lift the whole account. With 15% invested, a 1% equity gain needs about a 7% rise in those coins, and the engine cannot act in the meantime. Each small new loss after a release re-arms it.
- **The result:** this explains why the stop was on for 31–78% of hours over 180 days at lookback 48. At lookback 168, T-014 had fewer losses, so the stop was on only 8% of the time.
- **Proposed fix, not applied** (it is a safety mechanism; no last-minute change; it needs the agents side for the peak):
  1. On trigger, move to cash instead of freezing positions.
  2. Pause for a cool-down, e.g. 24 hours.
  3. Then reset the peak to the current equity (a new high-water mark) and resume.
  - A softer alternative: measure the drawdown from a rolling 7-day peak instead of the all-time peak.
  - Either version must be backtested before going live. The 180-day "stop off" rows in `backtest-180d.md` show that having no stop at all is worse.
