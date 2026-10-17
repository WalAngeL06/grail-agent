# Karar nesnesi ve hash kuralı (v0.1)

## Karar (engine.decide çıktısı, coin başına bir tane)
```json
{
  "cycle_id": 12,
  "agent": "GRAIL-01",
  "mode": "demo",
  "inst_id": "BTC-USDT",
  "action": "BUY",
  "size_usdt": "5",
  "ref_price": "67250.1",
  "target_weight_pct": 22.5,
  "reason": "trend+, n_eff=1.9, vol hedefi altında",
  "decided_at_ms": 1760700000000
}
```
- `action`: `"BUY"` | `"SELL"` | `"HOLD"`. HOLD'da `size_usdt` = `"0"`.
- Bir döngüdeki bütün kararlar tek payload'da toplanır: `{ "cycle_id", "agent", "mode", "decided_at_ms", "decisions": [ ... ] }`.

## Kanonik payload (hash'lenen bayt dizisi)
- JSON, anahtarlar alfabetik sıralı (iç içe nesneler dahil), boşluksuz (`separators=(",", ":")`); ASCII dışı karakterler `\uXXXX` olarak kaçışlanır (Python: `ensure_ascii=True`); sonuç UTF-8 bayt.
- `decisions` listesi `inst_id`'ye göre sıralı.
- Sayılar: `cycle_id`, `decided_at_ms` tamsayı; `target_weight_pct` en çok 2 ondalık; para/fiyat string.
- `salt`: 32 rastgele bayt, döngü başına yeni.
- `commitHash = keccak256(payloadBytes ‖ salt)` — Solidity: `keccak256(abi.encodePacked(payload, salt))`.

## Hash'e GİRMEYENLER
- `okx_order_id`, dolum fiyatı, emir durumu. Bunlar reveal sonrası sonuç alanlarıdır.

## Döngü sırası
commit tx → (BUY/SELL varsa) ATK emri → reveal tx (payload + salt + okx_order_id). Commit başarısızsa emir yok.
