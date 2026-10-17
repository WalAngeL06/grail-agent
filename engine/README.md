# grail-engine (T-001)

Deterministik, saf (ağ/dosya/saat I/O yok) karar kütüphanesi. Test: `cd engine && uv run pytest -q`.
agents'tan kullanım: `agents/pyproject.toml` → `grail-engine = { path = "../engine", editable = true }` (uv sources).

```python
from grail_engine import validate_config, decide
errs = validate_config(cfg)            # [] ya da [{"field": "coins", "message": "..."}]
res = decide(snapshot, portfolio, cfg)  # istisna fırlatmaz
res["payload"]   # decision.md döngü payload'ı → AYNEN kanonik JSON + salt ile hash'lenir (metrics/errors girmez)
res["metrics"]   # state.metrics (avg_corr, n_eff, holy_grail_curve, corr_matrix, hrp_weights_pct, portfolio_vol_pct, psr + ekler)
res["errors"]    # contracts hata nesneleri; res["ok"] False ise state.errors'a ekle
```

**Girdi**
- `snapshot = {"cycle_id": int, "at_ms": int, "candles": {instId: OKX ham satırları}}` — `okx market candles <inst> --bar <candle_bar> --limit <lookback_bars+1>` çıktısı aynen verilebilir (sıra önemsiz, ts'ye göre sıralanır, kapanış = satır[4]). Alternatif: `"closes": {instId: [eskiden yeniye]}`. Ops.: `"last": {instId: "fiyat"}` → `ref_price`.
- `portfolio` = state.portfolio biçimi: `{"equity_usdt", "cash_usdt", "positions": [{"inst_id", "value_usdt" | "size_base"}]}`; ops. `"peak_equity_usdt"` → kill switch.
- `decided_at_ms = snapshot.at_ms`, `cycle_id = snapshot.cycle_id` (engine saat okumaz → aynı girdi = aynı payload).

**Kural (T-001 §6)** trend `close_son/close_(son-lookback)-1 <= 0` → hedef 0 · trendi pozitiflerde HRP · vol hedefi
`w *= min(1, target_vol_pct/portföy_vol)` · tavan `w_i <= max_position_pct` ve `w_i * vol_i <= risk_budget_pct`
(risk bütçesi yorumu: coin başına yıllık vol katkısı tavanı) · hedef = `w * min(equity, max_total_deploy_usdt)` ·
`|fark| < min_order` → HOLD, BUY/SELL `<= max_order_usdt`; BUY'lar toplamda kalan deploy bütçesi ve nakitle sınırlı (inst_id sırasıyla).
Bozuk veri (pencerede NaN/≤0, std=0, < 11 kapanış) → o coin HOLD, pozisyon olsa da satış yok. Kill switch → hepsi HOLD.
**Kapılar (T-014)** — sadece trendi pozitif coinlerde, sadece ALIMI azaltır (satış üretmez; nakit/bütçe kapısız alım boyutuyla tüketilir,
bir coinin kapısı boşalttığı pay başka coine geçmez). Sabitler kodda (`decision.py`), config'te değil. Look-ahead yok: sadece lookback penceresi.
- Rejim: lookback getirilerinden Hurst, DFA-1 (pencereler 4..n/4, baştan+sondan), küçük örnek düzeltmesi
  `H = H_ham − E[H_ham | beyaz gürültü, n] + 0.5` (400 sim, sabit seed, önbellekli). En az 20 getiri; yoksa/NaN → 0.5.
  Raporlanan H `[0,1]`'e kırpılır, 2 ondalık; rejim bu sayıdan: `H<0.45` ranging, `0.45–0.55` unclear, `H>0.55` trending.
  48 barda H gürültülüdür (beyaz gürültüde σ≈0.19); etiket "tespit" değil, temkin sinyalidir.
- Setup: range tepesi = pencerenin ilk 2/3'ünün en yüksek kapanışı; retest bandı `±max(%0.2, 0.5 × bar vol)`.

| Durum | Hedef çarpanı | reason |
|---|---|---|
| ranging | 0 | `Market is ranging (Hurst 0.42), momentum buys paused` |
| breakout (retest yok) | 0 | `Breakout not retested yet` |
| none (kırılım yok) | 0.5 | `...; no breakout yet, half size` |
| retest | 1.0 | `...; breakout + retest confirmed` |

`metrics.signals[inst] = {hurst, regime, setup}` bütün config coinleri için; geçersiz veri → `0.5/unclear/none`.
**Ortalamaya dönüş kolu (T-017)** — sadece `regime == ranging` VE anlamlı O-U olan coinde kararı bu kol verir; trending/unclear → momentum (T-014 aynen).
O-U: lookback log kapanışlarında `Δx = a + b·x₋₁ + e`; θ=−b, yarı ömür ln2/θ (saat), μ=−a/b, σ_eq=sd(e)/√(2θ), z=(x_son−μ)/σ_eq.
Anlamlı = `t(b) ≤ −2.5` ve `1 ≤ yarı ömür ≤ 12 sa` (rastgele yürüyüşte ~%15 yanlış pozitif → Hurst ikinci kanıt).
Giriş `z ≤ −1.5` → hedef = min(momentum coin tavanının yarısı, tek varlık vol hedefi); kol toplamı ≤ %25 × deploy tabanı (mevcut MR coin pozisyonları dahil).
Elde pozisyon: `z ≥ −0.25` → çıkış (hedef 0), arası → tut. Spot, açığa satış yok; max_order / max_total / nakit / kill switch aynen.
`signals[inst].ou = {half_life_h, z, significant, sleeve: momentum|mean_reversion|none}` (2 ondalık; karar aynı sayıdan).
Kol `decision.MR_ENABLED` ile açılır/kapanır; **varsayılan açık** (kullanıcı kararı; lookback 168 backtest'inde T-017 < T-014, `out/lookback-168.md`). Kapalıyken O-U raporlanır, sleeve ranging'de "none", karar T-014 ile aynı.
**Replay (T-012)** — son 30 günün OKX mumlarıyla kararları geriye oynatır, eşit ağırlıklı al-tut ile karşılaştırır. Emir/tx yok.
```
uv run python scripts/replay_okx.py --fetch   # `okx market candles` (salt okunur) → data/okx-candles-1H.json, sonra oynat
uv run python scripts/replay_okx.py           # kayıtlı mumlarla, ağsız ve deterministik
```
Çıktı `out/replay.json` (`series`: saatlik `grail_usdt`/`buy_hold_usdt`/`grail_cash_pct`/`independent_bets`; `grail.max_drawdown_pct`,
`avg_independent_bets`, `times_went_to_cash`, `kill_switch_bars`) + `out/replay-summary.md` (3 cümle). Saf kısım `grail_engine.replay`.
Varsayımlar: sermaye = `max_total_deploy_usdt`, her kapanmış barda bir karar, dolum bar kapanışında, ücret %0.1, kill switch tepesi = en yüksek equity.

`reason` kullanıcıya gösterilir: sade İngilizce, önce düz cümle sonra sayılar (ör. `Not enough data (5 prices, need 11)`, `Price trending down (-9.6%), moving to cash`). Sadece ASCII (JS `JSON.stringify` ile Python `ensure_ascii` aynı baytı üretsin). Para string, `size_usdt` kuruşa aşağı yuvarlı.
