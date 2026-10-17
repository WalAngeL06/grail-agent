# Ortak sözleşmeler (sahibi: integrator · `chain.json` hariç → chain rolü)

Sürüm: `VERSION` dosyası. Her değişiklikte sürüm artar ve `coord/DECISIONS.md`'ye not düşülür.
Etkilenen roller bir sonraki görev başında `git merge main` ile alır ve RAPOR'da okudukları sürümü yazar.

### Revizyon 0.6.2 — opsiyonel O-U metriği (T-017 / D-023)
- Yalnız `state.metrics.signals[inst_id].ou` eklenir; mevcut `hurst/regime/setup` alanları korunur. `ou` opsiyoneldir; bulunmaması eski state için geçerli, bilinmeyen alanın yok sayılması eski okuyucu için yeterlidir. Bu belge/örnek uygulama veya yeni koşu kanıtı değildir.
- Şema: `{"half_life_h":4.0,"z":-1.8,"significant":true,"sleeve":"mean_reversion"}`. `half_life_h` sonlu pozitif **saat** veya `null`; `z` sonlu sayı veya `null`; `significant` boolean. `significant=true` geçerli O-U fit'i, negatif mean-reversion eğiminin `t<=-2.5` olması ve **1<=half_life_h<=12** koşullarını birlikte gerektirir; ranging ve giriş z koşulu ayrıca uygulanır.
- Kullanıcının kesinleştirdiği `sleeve`: bu coin'in bu döngüdeki kolunu belirten metin enum **`"momentum" | "mean_reversion" | "none"`**. Yüzde veya gerçekleşmiş fill miktarı değildir. O-U kolunun toplam <=%25 bütçe tavanı engine kodunda zorlanır/test edilir; sözleşmede bunun için ayrı alan yoktur. Tavanın tabanı ve ortak bütçe kabulü T-017 kartındadır.
- Geçersiz veri fallback'i `{"half_life_h":null,"z":null,"significant":false,"sleeve":"none"}`; NaN/Infinity yasak. Geçerli ama anlamsız fit'te sonlu gözlem değerleri kalabilir; yeni O-U girişine izin vermez. Yuvarlama, raporlanan anlamlılık ile karar eşiğini çeliştirmez.
- Kullanıcı onaylı kol: ranging + anlamlı fit + z<=-1.5 ile küçük giriş; z>=-0.25 ile O-U çıkışı; ara bant/pozisyon devamlılığı ve ortak risk sınırları T-017 test/incelemesinde doğrulanır. Eski momentum kapısı “yalnız BUY azaltır” kuralının bu yeni O-U koluna otomatik uygulanması amaçlanan girişi engellememeli; güvenlik/limit/analist/commit-before-order yolu korunur.
- `VERSION=0.6.2`; config/payload/state `contract_version="0.6"` aynen kalır. `ou` metrics dışına/payload/reveal/hash'e eklenmez; config, ABI, `chain.json` deploy0.5, adresler ve golden testVector değişmez. Tarihsel/pending kayıtlar yeniden yazılmaz. Yeni kararlardaki normal action/size/reason değişimi normal payload hash'ine zaten girer.
- Kullanıcı engine88f00f3 adayını bildirdi; planner GO ve kullanıcının merge veya varsayılan kapalı kararı beklenir. Sözleşme hazırlığı T-017'nin main'e alındığı veya etkinleştirildiği anlamına gelmez.

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
