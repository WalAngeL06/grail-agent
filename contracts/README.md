# Ortak sözleşmeler (sahibi: integrator · `chain.json` hariç → chain rolü)

Sürüm: `VERSION` dosyası. Her değişiklikte sürüm artar ve `coord/DECISIONS.md`'ye not düşülür.
Etkilenen roller bir sonraki görev başında `git merge main` ile alır ve RAPOR'da okudukları sürümü yazar.

### Revizyon 0.6.1 — eklemeli metrik ve açıklama (D-017)
- `VERSION=0.6.1` bu sözleşme belgelerinin/örneklerinin revizyonudur. Config, karar payload'ı ve runtime state içindeki `contract_version="0.6"` **değişmez**; mevcut agent'ın 0.6 kabulü korunur. Config dosyasına yeni alan/değer eklenmez. `chain.json.contractVersion=0.5` tarihsel deploy kaydı olarak kalır.
- `state.metrics.signals` opsiyonel, coin kimliğinden `{hurst, regime, setup}` nesnesine eşlemedir (T-014). `hurst` sonlu float, `[0,1]`; `regime` `trending|unclear|ranging`, `setup` `none|breakout|retest`. `H<0.45` ranging, `0.45<=H<=0.55` unclear, `H>0.55` trending. Veri yetersiz/geçersizse `0.5/unclear/none` fallback'i kullanılır. Alan yokken eski okuyucu çalışır; bilinmeyen metrik alanı yok sayılır.
- Signals yalnız gözlem metriğidir; payload/hash'e yeni alan eklemez. T-014 motor uygulaması ayrı teslimdir; örnekte bulunması motorun uygulandığı anlamına gelmez. Geçmiş/pending kararlar yeniden yazılmaz. Yapısal payload/hash/ABI değişikliği ve yeniden deploy yok.
- `corr_matrix` etiketi ve satır/sütun sayısı birbiriyle, `n_assets` ve geçerli coin kümesiyle eşleşir. Örnekte beş coin ve ortalama 0.62 ile tutarlı 5×5 matris kullanılır. `target_weight_pct` tabanı için `decision.md`'deki normal/koruma yolları geçerlidir.

## Genel kurallar (bütün dosyalar)
- Zaman: Unix epoch **milisaniye**, UTC, alan adı `*_ms`.
- Para / miktar / fiyat: **ondalık string** (`"0.00012"`), float değil. Birim alan adında: `*_usdt`, `size_base` (coin cinsinden).
- Yüzde: 0–100 arası sayı, alan adı `*_pct` (0.2 ≠ %20 karışıklığı olmasın).
- Sembol: OKX instId biçimi, `"BTC-USDT"`.
- Mod: `"live"` (OKX TR gerçek bakiye). `dry_run: true` iken emir gönderilmez, `order_status: "simulated"`. Her emir ve state kaydı `mode` ve `dry_run` taşır.
- Para limitleri (config): `max_order_usdt` emir başı, `max_total_deploy_usdt` toplam; kod emirden önce zorlar.
- `risk_budget_pct`: coin başına yıllık volatilite katkısı tavanı; hedef ağırlık `w_i` (0–1) ve yıllık coin volatilitesi `vol_i_pct` için `w_i * vol_i_pct <= risk_budget_pct` (D-010).
- Varsayılan `lookback_bars = 48`; `candle_bar = "1H"` ile trend penceresi 48 saat, gereken kapanış sayısı 49 (D-010).
- Hata nesnesi: `{ "code": "ATK_TIMEOUT", "message": "...", "at_ms": 0, "where": "agents.order", "context": {} }`.
- Bilinmeyen alanlar okuyucuyu çökertmez (ileriye uyumlu).
- Karardaki opsiyonel `llm_note` / `llm_flag` varsa hash'e girer; SELL analistten muaf (`exempt`). Ayrıntı `decision.md` (D-011).
- `state.config`, etkin config'ten `max_order_usdt` ve `max_total_deploy_usdt` (ondalık string) ile `kill_switch_drawdown_pct` (yüzde sayı) taşır.
- `state.chain.agent_id`: ERC-8004 uint256 kimliği ondalık string; `identity_registry`: 0x ile başlayan registry adresi. Deploy doğrulanana kadar ikisi de `null`; gerçek değerler `contracts/chain.json` çıktısından alınır.
- Sicil UI'ı `state.decisions[]` kayıtlarını `cycle_id` ile gruplar; ayrı `ledger[]` eklenmez (D-011).
- Reveal `okxOrderId` döngü başına kanonik `inst_id` → `ordId|simulated|unknown` JSON string'i; emir yoksa boş string. Ayrıntı `decision.md` (D-013).
- `chain.json.contractVersion` deploy anındaki sözleşme sürümüdür (mevcut Fuji çıktısı 0.5). v0.6 sonuç string'ini tanımlar; ABI, karar payload/hash kuralı ve test vektörü aynı olduğundan yeniden deploy gerekmez (D-013).

## Dosyalar
- `config.example.json` — kullanıcı ayarları (engine doğrular).
- `decision.md` — karar nesnesi, kanonik payload ve hash kuralı.
- `state.example.json` — agent'ın yazdığı, UI'ın okuduğu tek dosya (`runtime/state.json`).
- `chain.json` — kontrat adresi, ABI, test vektörü (chain rolü T-003'te üretir).
