# Karar günlüğü (yazarı: integrator; yeni karar en alta)

## D-001 · Koordinasyon: dosya + kullanıcı rölesi, worktree başına bir rol
Araçlar birbirine mesaj atamaz. Her rol kendi worktree/branch'inde, kendi klasöründe yazar; `coord/STATE.md` tek yazarlı.
Yeniden değerlendir: iki rol aynı dosyaya ihtiyaç duyarsa → sahiplik integrator'da toplanır.

## D-002 · Stack
- engine + agents: Python 3.12 (uv ile; makinedeki 3.14 bazı bilimsel paketlerde wheel sorunu çıkarabilir). Her paket kendi `pyproject.toml`'u.
- engine sadece numpy / pandas / scipy kullanır (HRP için scipy kümeleme yeterli). Ağır optimizer (cvxpy vb.) yok.
- chain: Hardhat + TypeScript (Node 24 kurulu; Foundry bu makinede yok, Windows kurulumu zaman kaybı).
- web: Vite + React + TypeScript (web sahibi kütüphane seçimini kendi `web/package.json`'unda yapar). Veri kaynağı: `runtime/state.json` (sözleşme: `contracts/state.example.json`).
- Ağ: Avalanche Fuji (43113). Mainnet sadece vakit kalırsa.

## D-003 · Karar hash'i
`commitHash = keccak256(payloadBytes ‖ salt)`; payloadBytes = kanonik JSON (bkz. `contracts/decision.md`).
okxOrderId ve dolum fiyatı hash'e girmez; reveal'de ayrı alan. HOLD da commit edilir.
Commit başarısızsa emir verilmez (fail-closed).

## D-004 · Backtest motoru yok
Geçen hackathon dersi. Engine canlı/son veriden karar üretir; tarihsel kontrol gerekiyorsa küçük sabit veri ile basit vektörel tekrar.

## D-005 · Kimlik = rol + worktree; iki Codex hesabı
"GPT Plus 2" ayrı bir araç değil, ikinci hesapla açılan Codex'tir. Roller araç adıyla değil rol + worktree + branch ile ayrılır.
İki Codex hesabı aynı anda çalışacaksa her biri ayrı `CODEX_HOME` ile oturum açar. Integrator yedeği önce Codex · hesap 2.

## D-006 · Zincir tabanı ERC-8004 boilerplate; ATK yapılandırması (workshop slaytı, 17.10)
- Avalanche workshop'u ERC-8004 tabanlı agent'ı Fuji'de çalıştırmayı gösterdi (github.com/ava-labs/8004-boilerplate, Hardhat).
  Önerilen 1. proje yönü bizimkiyle aynı: "ATK demo'da işlem yapan agent'ı ERC-8004 ile kaydet, karar ve sonuçlarını zincire yaz".
- Karar: chain = boilerplate registry'leri (Identity/Reputation/Validation) + bizim GrailLedger (commit-reveal). Agent IdentityRegistry'de kayıtlı;
  GrailLedger sadece kayıtlı agent'ı kabul eder. Boilerplate'in frontend/backend'i kullanılmaz.
- Farkımız: diğer takımlar "sonucu zincire yaz" yapacak; biz kararı emirden ÖNCE commit ediyoruz (sonradan değiştirilemez) + quant engine.
- Uzatma (vakit kalırsa): ikinci bir "risk bekçisi" agent (slayttaki 2. yön) kararları ValidationRegistry'de doğrular.
- ATK: `@okx_ai/okx-trade-cli` / `okx-trade-mcp`; site `tr`; anahtarlar `~/.okx/config.toml` profilinde (`demo = true`), `.env`'de değil.
- Jüri sorusu listesi (slayt 16): canlı mı çalışıyor; yetki/limitler; kimlik ve geçmiş doğrulanabilir mi; hata/beklenmedik girdide ne yapıyor;
  problem ve hedef kullanıcı. Demo ve UI bu beş soruya cevap verecek şekilde kurulur.

## D-007 · Gerçek para (OKX TR hackathon bakiyesi) · contracts 0.2
OKX TR katılımcılara gerçek bakiye verdi; emirler canlı hesapta. Erişim: `~/.okx/config.toml` → `grail` profili (alt hesap API key, Read+Trade, Withdraw yok).
- Kod yazan AI araçları emir veremez (MCP sadece `market`). Emri sadece agent kodu verir.
- `dry_run` bayrağı (varsayılan true): karar + zincir commit/reveal çalışır, emir simüle edilir. Canlıya kullanıcı geçirir; ilk canlı emri kullanıcı izler.
- Kod tarafında zorunlu guardrail: sadece spot, kaldıraç yok, sadece config coinleri, `max_order_usdt`, `max_total_deploy_usdt`, kill switch.
- Çekim/transfer/kaldıraç/hesap ayarı çağrısı yok. Bu, slayt 10'daki "yetkiyi daralt, harcamayı sınırla, izi tut, insan onayı" ilkesinin karşılığı ve sunumda gösterilir.

## D-008 · Yön sinyali, çökme-güvenli reveal, "Kendin Doğrula" (contracts 0.3)
- Engine yön sinyali: trend filtresi (time-series momentum) + HRP/vol hedefi ile hedef ağırlık; karar = hedef ile mevcut farkı
  (`min_order_usdt` bandı, `max_order_usdt` tavanı). Yeni config alanı yok. Z-skoru/kırılım vetosu gibi ek sinyaller bugün kapsam dışı.
- Salt + payload commit'ten ÖNCE `runtime/pending/`'e yazılır; açılışta açıkta kalan commit'ler reveal edilir.
- state.decisions[]'e `commit_hash`, `payload_utf8`, `salt_hex` eklendi (eklemeli değişiklik; okuyucular bilinmeyen alanda çökmez).
- UI'da "Kendin Doğrula": tarayıcı keccak256(payload‖salt) hesaplar, zincirdeki commit'le karşılaştırır.
- Kaynak: Gemini eleştirisinden alınan 3 fikir; "4. jüri sorusu brief'te yok" iddiası yanlıştı (BRIEF'te vardı).

## D-009 · Claude Max'i ana kas yap; Antigravity QA/yedek; bulut kredisi; LLM analist
- Claude Max en bol kota: engine (Opus 5.5, high) + web (Sonnet 5.5, medium) + T-007 analyst (Opus). UI tasarımı Claude Design ile (~14:00).
- Antigravity UI sahibi değil: tarayıcı testi (`coord/reviews/ui-*.md`) ve Claude limiti biterse web'in yedek sahibi.
- 250$ "bulut oturumu kredisi" (son: 5 Kasım) = Claude Code bulut oturumları; API kredisi DEĞİL. Sırsız işler için ek işçi:
  inceleme, test yazma, README, mock state ile UI varyantı. Branch `cloud/<görev>`; `.env`/OKX/cüzdan erişimi yok.
- Agent içindeki LLM (T-007) için ücretsiz katmanlı API (varsayılan Gemini Flash, `LLM_API_KEY`); yoksa analist atlanır, döngü etkilenmez.
- Model/efor: kritik (engine, kontrat, guardrail) high; UI/dokümantasyon medium. Takılınca önce efor, sonra model.
- Bağlam: 1 görev = 1 chat; görev ortasında şişerse `/compact <neyi koru>`.

## D-010 · T-001 kullanıcı onayları: risk bütçesi ve 48 bar pencere (contracts 0.4)
- Kullanıcı `risk_budget_pct` yorumunu kabul etti: coin başına yıllık volatilite katkısı tavanı. Hedef ağırlık `w_i` (0–1), yıllık coin volatilitesi yüzde cinsinden `vol_i_pct` olmak üzere `w_i * vol_i_pct <= risk_budget_pct`; örnek config'te tavan %10.
- Kullanıcı varsayılan `lookback_bars` değerinin 168 → 48 olmasını onayladı. `candle_bar = "1H"` ile 48 saatlik trend için 49 kapanış istenir. Engine'in 13:10 veri kontrolünde 168 bar bütün coinlerde HOLD üretmişti; pencere değişikliği sonraki veride BUY garantisi vermez.
- `contracts/VERSION` 0.3 → 0.4; config ve state örneklerinin `contract_version` alanları 0.4. Alan biçimleri ve karar/hash sözleşmesi aynı; etkilenen agents, engine ve web rolleri sonraki başlangıçta `git merge main` ile alır.
- T-001 engine uygulaması `role/engine@f8a7dc9` üzerinden main'e alınır. `dry_run: true` korunur; canlı emir yetkisi verilmedi.

## D-011 · Analist payload'ı ve UI alanları; onaylı ATK sorgu sınırı (contracts 0.5)
- Kullanıcı T-004 `role/docs@1b61651`, T-007 `role/engine@98ae2ba`, T-005 v1 `role/web@3cce8c2` teslimlerinin bu sırayla, kontrol komutları çalıştırılarak merge edilmesini istedi. T-007'nin `engine/pyproject.toml` test bağlantısı bu teslimin parçası olarak kabul edildi. T-002 `role/agents@1e36e99` yalnız Claude R-002 APPROVE sonrasında merge edilecek.
- KABUL: karar başına opsiyonel `llm_note` (ASCII, tek satır, ≤160) ve `llm_flag` (`skipped|approved|reduced|vetoed|exempt`). Varsa ikisi de payload/hash'e girer. LLM sadece BUY'ı aynı tutar, küçültür veya HOLD'a çevirir; SELL miktar/yön değişmeden `exempt` geçer. Sağlayıcı yok/hatalıysa BUY/HOLD `skipped`, SELL yine `exempt`.
- T-006 sırası: `decide → analyst.review_payload → son payload + salt kalıcı kayıt → commit → ATK emir → reveal`. Commit/reveal ve emirler aynı analist çıktısını kullanır; kurtarmada LLM yeniden çalıştırılmaz. `grail-analyst` yerel paket bağımlılığı T-006'da agents sahibi tarafından eklenir.
- KABUL: `state.config.max_order_usdt`, `max_total_deploy_usdt`, `kill_switch_drawdown_pct`; `state.chain.agent_id`, `identity_registry`. Kimlik deploy doğrulanana kadar null; agent_id ondalık string, registry adres string. Kaynak etkin config + chain deploy çıktısıdır.
- RED: ayrı `ledger[]`. Sicil `decisions[]` içinden cycle_id'ye göre gruplanır; chain sayaçları korunur.
- Kullanıcı onaylı T-002 istisnası kartına işlendi: kurulu CLI 1.4.8'de `--read-only` yok; yerine kapalı sorgu izin listesi (`market ticker/candles/instruments`, `account balance`, `spot get/orders`) kullanılır. `grail` profili, TR site/host ve JSON çıktı sabit; izin dışı sorgu reddedilir. T-002'nin okuduğu sürüm 0.4 olarak düzeltilir; 0.5 döngü entegrasyonunda alınır. Canlı emir onayı verilmedi.
- `contracts/VERSION` ile config/state sürüm alanları 0.5. Engine/analyst/agents/web bir sonraki başlangıçta `git merge main` ile alır. T-005 v1'in gerçek state/Fuji doğrulaması bekliyor; 13:30 deploy kapısı kaçtı, chain Codex hesap 2 13:48'de başladı.

## D-012 · T-008 teslim taslakları; README köke taşıma kapısı
- Kullanıcı `role/web@9eb1b52` (v0.5 UI alanları) ve ardından `role/docs@d1e8ea0` (T-008 teslim metinleri) merge + push istedi. T-008 kartı bu teslimde açılır; contracts sürümü 0.5 kalır.
- T-008 ilk teslimi docs/ altında dört İngilizce taslaktır: form açıklaması, README-draft, 10 slayt pitch, 2:00 demo senaryosu. Adresler ve henüz doğrulanmamış çalışma/ölçüm/komutlar açık yer tutucuyla kalır.
- **README-draft.md köke taşıma kararı: 17:00 freeze SONRASI ve gerçek adresler doldurulup doğrulandığında.** Docs sahibi taslağı günceller ve RAPOR eder; köke taşıma integrator tarafından yapılır. Bu merge'de kök README değiştirilmez.

## D-013 · R-003 koşullu onay; çok emirli reveal ve kalıcı cycle_id (contracts 0.6)
- Kullanıcı `role/review@a6044d7` R-003 incelemesinin merge + push'unu istedi. T-003 APPROVE koşullu; BLOCKER/MAJOR yok, yeniden deploy gerekmez. İnceleme yalnız `coord/reviews/T-003.md` + reviewer handoff'u değiştirir.
- R-003-2: `decision.md` reveal `okxOrderId` alanı kanonik JSON `{"BTC-USDT":"<ordId>|simulated|unknown"}` olarak tanımlandı; `|` alternatifleri gösterir. Çok coin alfabetik/boşluksuz eşleme, emir yoksa `""`; normal/kurtarma aynı biçim. Emir durumu sorgulandıktan sonra reveal; sonuç hash'e girmez. Kullanıcı bu biçimi agents'a verdi.
- R-003-3: T-006 kabulü kalıcı ve monoton cycle_id ister; restart, tamamlanmış pending kayıtlarının silinmesi ve dry_run/canlı geçişi aynı agent için kimlikleri yeniden kullanmaz. Uygulama ve ağsız test kanıtı agents sahibinin T-006 tesliminde aranır.
- `contracts/VERSION` ve config/state örnekleri 0.5 → 0.6. ABI, payload/hash kuralı ve golden testVector değişmedi. `chain.json.contractVersion=0.5` deploy anının kaydı olarak korunur; adres/kimlik/bytecode değişmez. Etkilenen agents/web rolleri `git merge main` ile alır; ürün kodlarına bu teslimde yazılmaz.
- R-003-1/4 UI bağımsız doğrulama önerileri, R-003-5/6 opsiyonel metadata/deployBlock notları inceleme dosyasında korunur; bu merge'in koşulu değildir. Canlı mod için R-002-1 kapısı açık, dry_run=true.

## D-014 · R-004 incelemesini al; T-006 için üç düzeltme, canlı emir NO-GO
- Kullanıcı `role/review@62ef3c3` (R-004, coord/reviews/T-006.md) merge + push istedi. Bu merge yalnız inceleme + reviewer handoff'u ve integrator koordinasyon kayıtlarını içerir; agents ürün dalı alınmaz. Contracts v0.6 değişmez.
- İnceleme dcf68db üzerinde APPROVE koşullu: R-002-1/2 ve R-003-2/3 kapandı; üç MAJOR (v0.6 config/state, döngüler arası dry_run rezerv birikmesi, geçmişle büyüyen RPC maliyeti) var. İnceleme 135 test/Fuji RPC/offline repro kanıtını içerir; bunlar reviewer kanıtıdır, bu tur integrator yeniden çalıştırmadı.
- Kullanıcının açık talimatı daha sıkı kapı koyar: **R-004-1/2/3'ün üçü de düzeltilip test ve bağımsız ek-fark incelemesiyle doğrulanmadan T-006 merge YOK.** Uzak agents HEAD a7312a3 R-004-1 adayını içeriyor; incelenen dcf68db'den sonraki bu fark tek başına kapıyı kapatmaz.
- Düzeltmeler agents sahibince kendi worktree'sinde yapılır; kabul T-006'ya işlendi. Canlı emir **NO-GO**; dry_run=true ve CLI canlı reddi korunur. Review'daki canlı giriş önerisi uygulama yetkisi değildir; ayrı kullanıcı talimatı ve inceleme olmadan --live/canlı yol eklenmez.
- 14:50 Fuji dry_run kapısı tarihsel kanıt olarak geçerli kalır; yeniden runner/deploy/kayıt/commit/reveal veya OKX emri gönderilmez. R-004-4/5 MINOR ve R-004-6/7 NIT inceleme dosyasında korunur.


## D-015 · R-004b sonrası T-006 entegrasyonu; ilk canlı kullanıcı terminalinde (2026-10-17 15:38)
- Kullanıcı altı hedefi sırayla merge + push istedi; T-010/R-006 paralel bağımsız incelemesi kabul edildi. R-004b ac96902 tam agents@2bf5668 için APPROVE; R-004-1/2/3 kapandı ve integrator birleşmiş main üzerinde 157 testi doğruladı. D-014 üçlü merge kapısı sağlandı.
- Eski canlı giriş yasağı bu talimatla sınırlı olarak güncellenir: varsayılan dry_run=true korunur. İlk canlı koşuyu kullanıcı KENDİ terminalinden, R-004b koşullarıyla yapacak: BTC-USDT tek coin, min_order_usdt=max_order_usdt=2, max_total_deploy_usdt=10, kill_switch_drawdown_pct=5, cycles=1, Fuji ve incelenen canlı CLI onayı. Trend HOLD ise emir zorlanmaz. Yeni genel/sürekli canlı çalışma yetkisi yok.
- Integrator bu chat runtime/live-config oluşturmadı, config'i false yapmadı; ATK hesabı/emir, smoke/run veya Fuji tx çalıştırmadı. İlk canlı yapıldı/başardı diye yazılmaz. Gerçek ordId/tx sonrası ayrıca kanıt doğrulanır; belirsizlikte kimliği sorgulamadan tekrar gönderim veya yeni runtime ile atlatma yok.
- R-004b'nin hesap/sermaye/gaz önkoşulları kullanıcı tarafından kontrol edilir; burada doğrulanmış sayılmaz. orders.sqlite3, fuji-transactions.json ve pending korunur. R-004-4/5/6/7 ve R-002-3/4 MINOR/NIT açık; R-005 public ve R-006 chain incelemesi ayrı, canlı onayıyla kapanmaz. Contracts 0.6 değişmedi.


## D-016 · İlk canlı emir kanıtı ve LLM anahtar bildirimi (2026-10-17 15:46)
- Kullanıcı 15:37 ilk CANLI koşunun başarılı olduğunu bildirdi: cycle2, BUY BTC-USDT 2 USDT, OKX 4017748393474314240 filled. Yerel agents/runtime/live/state.json bu alanlar ve dry_run=false ile eşleşiyor.
- Commit 0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569 → reveal 0xae6537e9acc9e66accfe5d0fe61b2f9a858460d7c42cf3d25f0acafa378541f7; planner Fuji doğrulamasını kullanıcı bildirdi. Integrator bu tur bağımsız RPC/receipt veya OKX sorgusu yapmadı; yeni emir/tx/runner başlatmadı.
- D-015 tek coin/2 USDT/tek döngü kapısı gerçekleşti; yeni/sürekli koşu yetkisi yok. Gerçek runtime/live/journal/pending korunur. Eski hazırlık handoff’undaki boş runtime bilgisi artık tarihsel kabul edilir.
- Kullanıcı LLM_API_KEY eklendi dedi. Anahtar okunmaz/raporlanmaz; provider çalışması veya geçmiş cycle2 LLM onayı kanıtlanmış sayılmaz. Örnek config dry_run=true, contracts 0.6 korunur; R-005 public kapısı ayrı.


## D-017 · T-014 planner kararı; eklemeli 0.6.1 ve R-005/R-007 (2026-10-17 16:05)
+- Kullanıcı T-014’ü engine’e atadı: Hurst rejimi, 0.45–0.55 dahil ölü bant; kırılım/retest setup yalnız mevcut BUY boyutunu azaltır, BUY üretmez. Config değişmez. metrics.signals[inst_id]={hurst:float,regime:trending|unclear|ranging,setup:none|breakout|retest} hash dışı eklemeli alandır.
+- Teslim 16:30 (test/handoff/commit/push), bağımsız inceleme chain/Codex-2, merge <=16:50; yetişmezse T-014 kapsam dışında. Kullanıcının inceleme ataması bu karta özel chain reviewer çıktısı coord/reviews/T-014.md + chain handoff kapsamını verir; engine/chain ürün alanlarında çapraz yazma yok.
+- Her contracts değişikliğinde VERSION artışı için revizyon 0.6 → 0.6.1; protokol/config/payload/state contract_version=0.6 korunur. Agents runtime’ın tam 0.6 kabulü ve kullanıcı config değişmez talimatı böyle korunur. 0.6.1 belge/eklemeli örnek revizyonudur; README ayrımı açıklar. chain.json deployment0.5, adres/ABI/hash/testVector ve config.example.json aynı.
+- Kullanıcı R-007 sözleşme isteklerini onayladı: örnek corr_matrix5x5, diag1/offdiag0.62, 5 coin/avg_corr/n_eff ile tutarlı; target_weight_pct tabanı mevcut normal deploy_base=min(equity,max_deploy) ve koruma HOLD equity dallarıyla belgelenir. Kod/historical payload semantiği değiştirilmez; deploy_base_usdt alanı eklenmez. Web’in 4 MAJOR düzeltmesi ayrı sahip işi.
+- R-005 PUBLIC GO raporu 4927557 main9acec55/ref kümesini tarar; güncel yayın SHA farkları hâlâ tekrar kontrol edilmeli. Kullanıcının MINOR-1 isteğiyle sqlite/runtime/fuji/live-config/envrc/pem/key/.claude ignore kuralları eklendi. Public JSON fixtures korunur, gerçek sır türleri fixture içinde de ignore kalır. Public ayarı/key rotation/history rewrite yetkisi yok.
+- T-014 kartı/örnek alan motorun uygulandığı anlamına gelmez. Bu teslim yeni runner/canlı emir/Fuji tx yetkisi vermez; 15:37 ilk canlı kanıtı ve gerçek runtime/journal korunur.

- R-007 2682d99 raporu/handoff’u kullanıcı talimatıyla merge edildi; inceleme DONE, web MAJOR’ları açık. R-005 ilk teslim 0c8a02b’de pushlandı; bu tur root/contract/coord dışında ürün kodu değiştirilmedi.
