# Safety stop (kill switch): rolling 7-day peak, sells allowed

> **Status: analysis only, NOT in the engine.** User decision (18:22): keep the old rule (all-time peak, freeze), because it did better at lookback 168 (+7.12% / 5.81% worst drop) and the joint agents + engine change was too risky 35 minutes before submission. The code change described below was made (d240923) and then reverted on the same branch. The numbers stay as a record. The rolling-peak helper now lives only in `scripts/backtest_long.py`. Re-running `kill_switch_168.py` on the reverted engine reproduces every row except the two "all-time + sell_ok" rows, which needed the reverted sell-while-stopped code.

**Özet (TR):** Kill switch artık son 168 saatin en yüksek hesap değerine göre ölçülüyor ve tetikliyken sadece yeni alım duruyor, satış serbest. Böylece motor kilitli kalmıyor: 180 günde durdurma hiç açılmadı, çünkü haftalık en kötü düşüş %3.62'de kaldı. Bedeli şu: kayıplar bir haftadan uzun sürede biriktiği için toplam düşüş %8.80'e çıktı (eski %5.81) ve T-014 getirisi +7.12%'den +2.27%'ye indi. Eski kuralın 168'deki iyi sonucu büyük ölçüde şanstı: Haziran çöküşünde pozisyonları dondurdu, onlar da Ağustos rallisinde toparlandı. UYARI: engine değişikliği agents'ın kayan zirve değişikliğiyle BİRLİKTE canlıya çıkmalı; tek başına (zirve hâlâ tüm zamanlar + satış serbest) en kötü kombinasyon: −3.37%, durdurma saatlerin %64'ünde açık.

## 1. Diagnosis (before this change)

- **Where it is computed:** in the engine, `decide()`, as `drawdown = 1 − equity / peak_equity_usdt`; the stop is on while that is ≥ `kill_switch_drawdown_pct` (5%). The engine is stateless.
- **Where the peak lives:** in the agent. It is persisted in `agents/.../runtime/<run>/control.json` as `peak_equity_usdt`, the all-time highest equity, and is never reset. The replay used the running maximum, which is the same thing.
- **When it released:** only when equity came back to within 5% of that all-time high.
- **Why it locked up:** while on, every coin was HOLD, so the engine could not even sell. With mostly cash and frozen positions, the account rarely got back. That explains 31–78% locked hours at lookback 48.

## 2. Change (engine side, done)

Choice: **rolling 168-hour peak**, not "24 h no buys, then reset".
- **Why it's simpler:** it needs no trigger time, no timer and no reset rule. The peak is just the max of the last 168 hours, and the same code serves the agent and the replay.
- **Why it's safer:** it can never release because a timer ran out while the account is still falling. As long as the high is inside the window, the stop stays on until the drop is under 5%.
- **Consistency:** 168 hours matches the lookback.

What changed:
- **`grail_engine/peak.py`** (new): `KILL_SWITCH_WINDOW_H = 168`, `rolling_peak(points, now_ms)`, and `PeakTracker` (`update(t_ms, equity) → peak`, `to_list()` for storage).
- **`decide()`:** while the stop is on there are **no new BUYs**. SELLs (trend-down exits, trims, mean-reversion exits) **are allowed**, with "; safety stop on (down X%)" added to the reason. All other coins are HOLD with "Safety stop: losses hit the limit, no new buys (down X% from the 168h high, limit 5%)". The threshold is still the config's `kill_switch_drawdown_pct`. max_order, max_total and cash limits are unchanged.
- **`replay()`:** uses `PeakTracker`, so official replays match what the agent will do.

Tests (all existing tests pass unchanged, except the one that asserted "everything HOLD", which now asserts "no BUY, SELL allowed"):
- (a) 5%+ down → no BUY, including exactly at 5.00% and 6.00%. At 4.99% down, buys are allowed and stay within `max_order`.
- (b) The stop releases by itself once the old high leaves the 168-hour window.
- (c) It never releases early while the drop continues inside the window: every hour from the trigger until the high rolls off is checked.
- (d) SELL is possible while the stop is on.
- (e) R-009-1, T-014, T-017 and replay tests pass.
- `rolling_peak` and `PeakTracker` agree.

## 3. Effect: 180 days, lookback 168 (same data and costs as `backtest-180d.md`)

`engine/scripts/kill_switch_168.py` → `kill-switch-168.json`, run twice, identical. "freeze" = old behavior (no trades at all while the stop is on); "sell_ok" = new behavior. The old rule is the all_time + freeze row, which reproduces `lookback-168.md` exactly.

| Engine | Peak | While stop on | Period | Return | Sharpe | Worst drop | Trades | Stop on |
|---|---|---|---|---|---|---|---|---|
| T-014 | **rolling 168h** | **sell_ok (new)** | 180 days | +2.27% | +0.42 | 8.80% | 749 | 0.0% |
| T-014 | rolling 168h | sell_ok (new) | prior 150 days (OOS) | +0.33% | +0.13 | 8.80% | 643 | 0.0% |
| T-014 | all-time | freeze (old) | 180 days | +7.12% | +1.16 | 5.81% | 641 | 8.1% |
| T-014 | all-time | freeze (old) | prior 150 days (OOS) | +5.17% | +1.01 | 5.81% | 535 | 9.7% |
| T-014 | all-time | sell_ok | 180 days | −3.37% | −1.00 | 5.16% | 223 | 63.9% |
| T-014 | rolling 168h | freeze | 180 days | +2.27% | +0.42 | 8.80% | 749 | 0.0% |
| T-017 | **rolling 168h** | **sell_ok (new)** | 180 days | +1.17% | +0.26 | 9.48% | 1077 | 0.0% |
| T-017 | rolling 168h | sell_ok (new) | prior 150 days (OOS) | −0.47% | −0.03 | 9.48% | 911 | 0.0% |
| T-017 | all-time | freeze (old) | 180 days | −2.55% | −0.52 | 5.76% | 628 | 31.9% |
| T-017 | all-time | sell_ok | 180 days | −3.35% | −0.90 | 5.25% | 366 | 54.2% |

Reading:
- **No more lock-up:** with the rolling peak, the stop was on 0% of hours. The worst drop within any 168-hour window was 3.62% (T-014), so it never reached 5%.
- **The cost is weaker protection.** The rolling stop catches fast losses (5% within a week), not slow ones: the total worst drop rose to 8.80% (T-014) and 9.48% (T-017), above the 5% limit. That is the trade-off of "releases by itself".
- **The old rule's +7.12% at lookback 168 was partly luck.** It froze positions during the June crash and they recovered in August. The same freezing at lookback 48 locked the engine for 31–78% of hours.
- **Never ship half of it:** allowing sells while keeping the all-time peak is the worst combination (−3.37%, stop on 64%). The engine change must go live together with the agent's rolling peak.
- **Same-sample caveats:** one 180-day sample; Sharpe standard error about ±1.5.

## 4. What the agent must change (agents area, not done here)

1. **Stop storing an all-time peak.** In the run's `control.json`, replace `peak_equity_usdt` (all-time max) with an equity window, for example `"equity_window": [[t_ms, equity_usdt], ...]`.
2. **Every cycle:** `tracker = PeakTracker(points=control.get("equity_window", []))`, then `peak = tracker.update(now_ms, equity_usdt)`, then `control["equity_window"] = tracker.to_list()`. Pass `portfolio.peak_equity_usdt = peak` to `decide()` and write it to `state.portfolio.peak_equity_usdt`. Import `PeakTracker` from `grail_engine.peak`; agents already depend on the engine package.
3. **Size:** one point per 90-second cycle is about 6,700 points per week, which is fine. Optionally keep one point per hour holding that hour's max.
4. **Upgrade:** start the window empty, so peak = current equity. A stop that is currently on releases, as intended. Do not seed it with the old all-time peak.
5. **Contract/UI (integrator, web):**
   - `peak_equity_usdt` now means "highest account value in the last 168 hours"; label it "7-day high".
   - New reason texts: "Safety stop: losses hit the limit, no new buys (down X% from the 168h high, limit 5%)", and SELLs may end with "; safety stop on (down X%)".
6. **Merge order:** engine and agents together. If only the engine is merged, the agent keeps sending the all-time peak and the engine starts selling under a permanent stop. That is the worst row in the table above.
