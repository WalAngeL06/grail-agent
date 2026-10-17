# Ortak sözleşmeler (sahibi: integrator · `chain.json` hariç → chain rolü)

Sürüm: `VERSION` dosyası. Her değişiklikte sürüm artar ve `coord/DECISIONS.md`'ye not düşülür.
Etkilenen roller bir sonraki görev başında `git merge main` ile alır ve RAPOR'da okudukları sürümü yazar.

## Genel kurallar (bütün dosyalar)
- Zaman: Unix epoch **milisaniye**, UTC, alan adı `*_ms`.
- Para / miktar / fiyat: **ondalık string** (`"0.00012"`), float değil. Birim alan adında: `*_usdt`, `size_base` (coin cinsinden).
- Yüzde: 0–100 arası sayı, alan adı `*_pct` (0.2 ≠ %20 karışıklığı olmasın).
- Sembol: OKX instId biçimi, `"BTC-USDT"`.
- Mod: `"live"` (OKX TR gerçek bakiye). `dry_run: true` iken emir gönderilmez, `order_status: "simulated"`. Her emir ve state kaydı `mode` ve `dry_run` taşır.
- Para limitleri (config): `max_order_usdt` emir başı, `max_total_deploy_usdt` toplam; kod emirden önce zorlar.
- Hata nesnesi: `{ "code": "ATK_TIMEOUT", "message": "...", "at_ms": 0, "where": "agents.order", "context": {} }`.
- Bilinmeyen alanlar okuyucuyu çökertmez (ileriye uyumlu).

## Dosyalar
- `config.example.json` — kullanıcı ayarları (engine doğrular).
- `decision.md` — karar nesnesi, kanonik payload ve hash kuralı.
- `state.example.json` — agent'ın yazdığı, UI'ın okuduğu tek dosya (`runtime/state.json`).
- `chain.json` — kontrat adresi, ABI, test vektörü (chain rolü T-003'te üretir).
