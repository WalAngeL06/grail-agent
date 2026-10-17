# Karar nesnesi ve hash kuralı (v0.6)

## Karar (engine.decide çıktısı, coin başına bir tane)
```json
{
  "cycle_id": 12,
  "agent": "GRAIL-01",
  "mode": "live",
  "dry_run": true,
  "inst_id": "BTC-USDT",
  "action": "BUY",
  "size_usdt": "5",
  "ref_price": "67250.1",
  "target_weight_pct": 22.5,
  "reason": "trend+, n_eff=1.9, vol hedefi altında",
  "llm_note": "Approved within configured limits",
  "llm_flag": "approved",
  "decided_at_ms": 1760700000000
}
```
- `action`: `"BUY"` | `"SELL"` | `"HOLD"`. HOLD'da `size_usdt` = `"0"`.
- Bir döngüdeki bütün kararlar tek payload'da toplanır: `{ "cycle_id", "agent", "mode", "dry_run", "decided_at_ms", "decisions": [ ... ] }`.
  `dry_run` hash'e girer: zincirde simüle ve canlı kararlar ayırt edilir.

## `target_weight_pct` tabanı (revizyon 0.6.1, R-007-3)
- Bu açıklama mevcut `engine/decision.py` davranışını tanımlar; hesap/payload biçimini veya geçmiş hash'leri değiştirmez. `target_weight_pct`, gerçekleşen emir veya emir sonrası pozisyon yüzdesi değildir.
- **Normal, geçerli veri/portföy yolu:** `deploy_base_usdt = min(equity_usdt, max_total_deploy_usdt)`; `target_weight_pct = 100 * w_i` (iki ondalık), burada `w_i` trend filtresi, HRP, volatilite ölçekleme ve pozisyon/risk tavanları sonrasındaki hedef ağırlıktır. Hedef USDT yaklaşık `target_weight_pct / 100 * deploy_base_usdt` (yuvarlama farkıyla). Bu taban normal BUY/SELL ve minimum emir/nakit/bütçe nedeniyle çıkan normal HOLD için de geçerlidir.
- **Koruma/atlanmış analiz yolu:** kill switch veya coin verisi geçersiz olduğunda HOLD kaydındaki `target_weight_pct` mevcut `100 * position_value_usdt / equity_usdt`'dir (iki ondalık). Equity geçersizse veya genel engine hata fallback'inde `0` olur. Sadece `action=HOLD` bilgisinden taban seçilemez: normal hedef HOLD'u ve koruma HOLD'u farklıdır.
- `metrics.target_weights_pct` aynı karar değerlerini yansıtır; `metrics.hrp_weights_pct` limit/volatilite öncesi dağılımdır ve gerçek hedef yerine kullanılamaz. Mevcut pozisyon `portfolio.positions[].weight_pct` her zaman toplam equity tabanındadır.
- UI normal hedefi equity ile karşılaştıracaksa `target_pct_of_equity = target_weight_pct * min(equity_usdt, max_total_deploy_usdt) / equity_usdt`; koruma HOLD'unda mevcut equity yüzdesini tekrar dönüştürmez. Örnek: equity=100, max_deploy=50, normal hedef=20% → hedef 10 USDT → equity'nin %10'u; koruma HOLD'unda 20% → mevcut 20 USDT'dir. Referans tabanı bilinmiyorsa iki çubuğu aynı yüzdeymiş gibi kıyaslama.
- Bu revizyon `deploy_base_usdt` veya bir taban alanını runtime'a eklemez. T-014 `metrics.signals` eklemesi de bu alanın tabanını/payload anahtarlarını değiştirmez. Alan hash'e girer; semantiği tek tabana dönüştüren bir uygulama değişikliği ayrı görev/onay gerektirir.

## Opsiyonel analist alanları (T-007, D-011)
- `llm_note`: tek satır ASCII metin, en çok 160 karakter; analistin gerekçesi veya atlama nedeni.
- `llm_flag`: `"skipped"` | `"approved"` | `"reduced"` | `"vetoed"` | `"exempt"`.
  `skipped`: analist uygulanamadı/atlanmış, karar aynı; `approved`: BUY aynı;
  `reduced`: BUY miktarı azaldı; `vetoed`: BUY → HOLD (`size_usdt = "0"`); `exempt`: SELL analistten muaf.
- Alanlar engine'in ham çıktısında bulunmayabilir. `analyst.review_payload` sonrasında eklenir;
  **varsa ikisi de kanonik payload'ın ve hash'in parçasıdır**, reveal'de aynı değerler kullanılır.
- Sadece BUY'lar LLM'e gider: miktar artırılamaz, yön değiştirilemez, yeni coin/emir eklenemez; HOLD emre dönüşmez.
- **SELL her durumda değişmeden geçer ve `llm_flag = "exempt"` olur**; sağlayıcı yokken veya hata verdiğinde de SELL veto edilmez/küçültülmez.
- Anahtar yok / en çok 8 sn timeout / bozuk yanıt → BUY/HOLD aynı kalır, `skipped`; SELL yine `exempt`.

## Kanonik payload (hash'lenen bayt dizisi)
- JSON, anahtarlar alfabetik sıralı (iç içe nesneler dahil), boşluksuz (`separators=(",", ":")`); ASCII dışı karakterler `\uXXXX` olarak kaçışlanır (Python: `ensure_ascii=True`); sonuç UTF-8 bayt.
- `decisions` listesi `inst_id`'ye göre sıralı.
- Sayılar: `cycle_id`, `decided_at_ms` tamsayı; `target_weight_pct` en çok 2 ondalık; para/fiyat string.
- `salt`: 32 rastgele bayt, döngü başına yeni.
- `commitHash = keccak256(payloadBytes ‖ salt)` — Solidity: `keccak256(abi.encodePacked(payload, salt))`.

## Hash'e GİRMEYENLER
- `okx_order_id`, dolum fiyatı, emir durumu. Bunlar reveal sonrası sonuç alanlarıdır.

## Reveal `okxOrderId` biçimi (R-003-2, D-013)
- `revealDecision` çağrısındaki döngü başına tek `okxOrderId` string'i, `inst_id` → emir sonucu eşlemesinin kanonik JSON metnidir:
  `{"BTC-USDT":"<ordId>|simulated|unknown"}`. `|` seçenekleri gösterir; gerçek değer OKX `ordId` string'i, `"simulated"` veya `"unknown"` olur.
- Anahtarlar alfabetik sıralı, boşluksuz, `ensure_ascii=True`; payload ile aynı JSON kanonikleştirme kuralı kullanılır.
  Çok emir örneği: `{"BTC-USDT":"1234567890","ETH-USDT":"unknown"}`; dry_run örneği: `{"BTC-USDT":"simulated"}`.
- HOLD ve emir gönderilmeyen kararlar eşlemeye eklenmez. Döngüde emir/simülasyon veya sonucu belirsiz emir girişimi yoksa alan tam olarak boş string `""` olur (`"{}"` değil).
- Emir durumu sorgulandıktan sonra reveal edilir. Belirsiz sonuç ilgili `inst_id` altında `"unknown"` olur; kurtarmada da aynı biçim kullanılır, tüm alan düz `"unknown"` yapılmaz. Reveal tek seferliktir; sonradan emir sonucu değiştirilemez.
- Bu sonuç string'i karar payload'ına/hash'e girmez. `state.decisions[].okx_order_id` coin başına alan olarak kalır; döngü eşlemesi reveal çağrısında oluşturulur.

## Döngü sırası
engine.decide → analyst.review_payload → son payload'ı kanonikleştir ve salt ile diske yaz → commit tx →
(BUY/SELL varsa) ATK emri → reveal tx (aynı payload + salt + okx_order_id). Commit başarısızsa emir yok.
Emirler analistten çıkan ve commit edilen kararları kullanır; commit sonrasında analist yeniden çalıştırılmaz/payload değiştirilmez.
