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
`reason` sadece ASCII (JS `JSON.stringify` ile Python `ensure_ascii` aynı baytı üretsin). Para string, `size_usdt` kuruşa aşağı yuvarlı.
