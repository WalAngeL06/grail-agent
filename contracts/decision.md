# Karar nesnesi ve hash kuralı (v0.5)

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

## Döngü sırası
engine.decide → analyst.review_payload → son payload'ı kanonikleştir ve salt ile diske yaz → commit tx →
(BUY/SELL varsa) ATK emri → reveal tx (aynı payload + salt + okx_order_id). Commit başarısızsa emir yok.
Emirler analistten çıkan ve commit edilen kararları kullanır; commit sonrasında analist yeniden çalıştırılmaz/payload değiştirilmez.
