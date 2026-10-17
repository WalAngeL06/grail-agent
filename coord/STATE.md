# PROJECT STATE — tek yetkili durum (yazarı: integrator)

- Durum revizyonu: r26 · 2026-10-17 15:47 (Europe/Istanbul)
- Ürün: Fuji 43113, ERC-8004 agentId 1. İlk CANLI emir 15:37 başarılı: cycle 2, BTC-USDT BUY 2 USDT, filled (kullanıcı/planner bildirimi + yerel state eşleşmesi).
- OKX: grail profili, gerçek para; örnek config dry_run=true. Yeni/sürekli runner için ek talimat yok. LLM_API_KEY eklendi (kullanıcı bildirimi; içerik okunmadı, sağlayıcı çağrısı doğrulanmadı).
- Aktif sözleşme: contracts/VERSION 0.6; chain.json deployment 0.5, adres/ABI/hash/testVector değişmedi.
- Sıralı kullanıcı entegrasyonu (bu teslim): 3/3; alınan chain@2e45f77, docs@e77eaed, agents@1370d41. Üç merge tamamlandı; her merge sonrası main push edildi.
- Önceki ürün kontrolleri (b07f0d0): web build PASS; engine 104, agents 157, chain 38 + typecheck. Bu tur ürün kaynakları değişmedi; test/RPC/runner yeniden çalıştırılmadı.
- Public kapısı: R-005 raporu + yayınlanacak son SHA taraması beklenir; repo görünürlüğü değişmedi. README freeze sonrası D-012.
- Önceki ayrıntılı kanıtlar: coord/archive/STATE-r17-20261017.md (tarihsel kayıt; güncel durum bu dosya).

## Zaman kapıları
| Saat | Kapı | Ölçüt |
|---|---|---|
| 13:30 | Fuji deploy — GEÇ TAMAMLANDI | Kapı kaçtı; chain 13:48 başladı. fdd4bf0 push'lu; 14:36 dört deploy + kayıt RPC receipt/bytecode ile doğrulandı |
| 14:00 | Engine testleri | `engine` test komutu geçer (golden değerler) |
| 14:00 | ATK veri + dry_run emir | bakiye + ticker + simüle emir çalışıyor |
| 15:00 | Uçtan uca dry_run — GEÇTİ (14:50) | agents@dcf68db; kullanıcı/planner tx doğrulaması; gerçek ATK okuma + Fuji commit/reveal + 5 simulated BUY. Canlı ayrı kullanıcı kapısı |
| 15:00 | UI inşası başlar | proje %80 olmasa bile; tasarım ~14:00 Claude Design; Antigravity UI testi + yedek |
| 17:00 | Feature freeze | sadece hata düzeltme + UI güncelleme |
| 18:00 | Yedek demo videosu | kayıt hazır |
| 18:45 | Teslim formu | `coord/SUBMISSION.md` kontrol listesi tamam, form gönderildi (zorunlu: Builder Hub e-postası, GitHub, sunum linki) |
| 19:00 | Teslim kapanır | |

## Görev panosu
| Görev | Başlık | Sahip | Durum | Bağımlılık |
|---|---|---|---|---|
| T-001 | Quant engine çekirdeği + golden testler | engine (Claude Code · Max) | INTEGRATED | contracts 0.5 uyumu doğrulandı |
| T-002 | ATK veri çekme + emir katmanı (dry_run; canlı öncesi R-002-1) | agents (Codex · hesap 1) | INTEGRATED | contracts 0.4; 0.5 ile 78 test |
| T-003 | ERC-8004 kimlik + GrailLedger + Fuji deploy | chain (Codex · hesap 2) | INTEGRATED (R-003 koşulları işlendi) | deploy contracts 0.5; v0.6 ile ABI/hash uyumlu |
| T-004 | UI brifi (ekranlar, palet, alan eşlemesi) | docs (Claude · Pro) | INTEGRATED | contracts 0.3 |
| T-005 | UI v2: sade dil + How it works + Fuji doğrulama sheet | web · QA Antigravity | INTEGRATED | 57e2287; build geçti; gerçek runtime UI kontrolü açık |
| T-006 | Agent döngüsü + sınırlı canlı kapı | agents | INTEGRATED; ilk CANLI GEÇTİ | 15:37 cycle2, BUY BTC 2 USDT, filled; OKX 4017748393474314240 |
| T-007 | LLM analist (yalnız BUY riskini azaltır; SELL exempt) | analyst (Claude Code · Max) | INTEGRATED | T-001; contracts 0.5 |
| T-008 | Teslim metinleri: form açıklaması, README taslağı, pitch, demo | docs (Claude Code · Max) | INTEGRATED (taslaklar; freeze sonrası doğrulama açık) | T-003/T-006 gerçek değerleri; D-012 |
| T-009 | Engine reason sade İngilizce | engine | INTEGRATED | b7e294b; pytest 104; main agents 78 |
| T-010 | Explorer kaynak doğrulama + salt okunur cycle komutu | chain | INTEGRATED; R-006 APPROVE | kod f36a95d; kanıt 2e45f77 (4 VERIFIED, cycle1 MATCH) |
| T-011 | Pitch outline → PowerPoint (docs/pitch/) | docs (Claude · Pro) | INTEGRATED (taslak; final hazırlığı açık) | caedc29; 10 slayt/not/render; README/kaynak notları/TBD/süreler bekler |
| T-012 | 30-day replay: GRAIL vs eşit ağırlık | engine | INTEGRATED (kapanış-fill modeli) | b7e294b; 720 saat, ağsız tekrar; yöntem/kabul açıkları kartta |
| T-013 | Plain English UI metinleri | docs | INTEGRATED (ilk kopya) | 1d411c0; 5 kart, 21 terim, ekran/boş/hata; web uygulaması ayrı |
| R-002 | T-002 incelemesi: APPROVE koşullu, BLOCKER yok | Claude Code · Max (Opus 5.5) | DONE | bad30c3; R-002-1/2 T-006 kabulünde |
| R-003 | T-003 incelemesi: APPROVE koşullu, yeniden deploy yok | reviewer (Claude Code · Opus 5.5) | DONE | a6044d7; R-003-2 decision.md v0.6, R-003-3 T-006 kabulünde |
| R-004 | İlk T-006 incelemesi (tarihsel) | reviewer (Claude Code · Opus 5.5) | DONE; güncel karar R-004b | 62ef3c3; üç MAJOR R-004b ile kapandı |
| R-005 | Public öncesi sır/anahtar/.env/gitignore taraması | reviewer (Codex · hesap 2) | TODO | coord/reviews/R-005-public.md; tüm ref geçmişi + güncel ağaç; yayınlanacak son SHA kontrolü |
| R-004b | T-006 düzeltmeleri + sınırlı canlı kapı | reviewer (Claude Opus) | DONE / APPROVE | ac96902; 2bf5668; kullanıcı ilk canlıyı 15:37 yaptı |
| R-006 | T-010 bağımsız inceleme | docs/reviewer (Claude Opus) | DONE / APPROVE | e77eaed; gerçek rapor coord/reviews/T-010.md; 1 MINOR + 3 INFO |
| R-* | Merge öncesi bağımsız inceleme (`coord/reviews/`) | reviewer (engine işini Codex · hesap 2; Codex işlerini Claude · Pro) | T-003 sonrası | READY_FOR_REVIEW dal |

## Kanıtlar / bu entegrasyon
- Başlangıç main@9205570 temiz ve origin/main ile aynı. Altı hedef uzak rol branch’lerinde erişilebilir; her sahibin yazma sınırı kontrol edildi.
- Tarihsel Fuji cycle1: gerçek ATK okuma + 5 simulated BUY; errors=0, commit/reveal 1/1. Bu tur dış ağ kanıtı yeniden üretilmedi.
- T-005 57e2287: UI v2 + How it works; npm run build PASS (48 modül, 556ms). Gerçek Fuji fixture ve ekran kanıtları sahip teslimi; integrator bu tur tarayıcı/RPC açmadı. diff --check: Dashboard.tsx:321 fazladan EOF boş satırı (MINOR, hedef aynen alındı).
- T-013 1d411c0: docs/ui-copy.md: 5 How it works kartı, 21 terim, ekran şablonları, boş/bekleme/hata metinleri. Belge/alan kapsamı okundu; web uygulaması ve ek tooltip/replay metni tamamlama ayrı. diff --check temiz.
- T-009/T-012 b7e294b: Engine pytest 104; main agents pytest 78. Kayıtlı OKX verisiyle ağsız replay tekrarlandı, JSON/özet baytları aynı; 720 saatlik ortak bar. Engine reason EN. Replay: kapanış fiyatında dolum, %0.1 ücret varsayımı, slippage/AI yok; sonraki açılış modeli ve sıkı veri/provenance kabulü açık.
- T-010 f36a95d ürün kodu; 2e45f77 güncel kanıt/handoff: yalnız checkedAt değişti. R-006 e77eaed APPROVE; chain sahibi ve reviewer 4 VERIFIED/cycle1 MATCH kanıtı sundu. Integrator bu tur RPC/ürün testi tekrarlamadı.
- R-004b ac96902: APPROVE tam agents@2bf5668 farkı için; R-004-1/2/3 kapalı. Reviewer 157 test + CLI kapı matrisi sundu; integrator'ın son birleşmiş ağaç kontrolleri T-006 satırında. Kullanıcının tek coin 2 USDT ilk canlı koşu talimatı D-015'te.
- T-006 2bf5668: önceki birleşmiş main testleri agents 157 + agents ortamından engine/analyst 104 PASS; R-004b kaynakları aynı. İlk canlı 15:37 kullanıcı tarafından yapıldı; yeni koşu yetkisi yok.
- Replay sonucu (tarihsel simülasyon): 50 → GRAIL 50.92 (+1.83%, DD 7.48%); equal weight 54.41 (+8.81%, DD 14.51%). Üstünlük iddiası yok; 5% kill switch zarar tavanı değildir. JSON/özet web/sunum sahiplerine aktarılacak.
- D-015 dar canlı koşulu 15:37 kullanıcı koşusuyla gerçekleşti; D-016 canlı kanıtı ve LLM anahtar bildirimi kaydıdır. Yeni genel/sürekli canlı çalışma yetkisi verilmedi.

- İlk CANLI 2026-10-17 15:37 Europe/Istanbul: kullanıcı terminali, agent=1 cycle=2, dry_run=false, BTC-USDT BUY 2.00 USDT; OKX 4017748393474314240 filled. Kaynak kullanıcı/planner bildirimi; agents runtime/live/state.json alanları integrator tarafından salt okunur eşleştirildi.
- Canlı commit 0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569 → reveal 0xae6537e9acc9e66accfe5d0fe61b2f9a858460d7c42cf3d25f0acafa378541f7. Planner Fuji doğrulaması kullanıcı tarafından bildirildi; integrator bu tur receipt/RPC sorgulamadı.
- LLM_API_KEY eklendi (kullanıcı bildirimi). Değer okunmadı/kopyalanmadı/loglanmadı; eklenmiş olması LLM sağlayıcısının çalıştığını veya cycle2 kararını incelediğini kanıtlamaz.
- T-010 kanıt/handoff 2e45f77: JSON checkedAt yenilendi; diğer metadata ve bütün ürün kaynakları aynı. Scope, diff --check, JSON eşitliği doğrulandı.

- R-006 gerçek çıktı coord/reviews/T-010.md (karttaki R-006.md yerine); docs rolü reviewer şapkasıyla, Codex implementer’dan farklı model. Kullanıcının açık e77eaed merge talimatıyla kabul edildi. RPC 429 MINOR; API önbelleği/.env yüklenmesi/test edilemeyen senaryo INFO; 4 Snowtrace #code sayfasının gözle kontrolü açık.

- agents@1370d41 yalnız hazırlık handoff’u: tarihsel 15:30 boş runtime kaydıdır; 15:37 canlı koşu sonrası artık boş değildir. Sonraki oturum canlı runtime/journal/pending’i korur, temizlemez veya yeni runner başlatmaz.

## Bekleyenler / sınırlar
- Önceki altı ürün merge tamamlandı; bu teslim yalnız kanıt/inceleme/handoff ekidir.
- T-011 sunum son hazırlığı: README/kaynak notları/süreler/TBD; T-013 ilk kopyasının eksik tooltip/replay/terimleri docs, uygulamasını web tamamlar.
- T-012 kapanış-fill varsayımı açık; sonraki açılış, strict eksik/tekrar veri ve provenance/şema kabul maddeleri tamamlanmış sayılmaz.
- R-005 public taraması bekler; R-006 APPROVE e77eaed ile alındı. Bu chat yeni emir/tx veya otomatik rol mesajı çalıştırmadı.
- R-004-4/5/6/7 ve R-002-3/4 MINOR/NIT açık. İlk canlı kanıtı alındı; gerçek runtime UI ve LLM sağlayıcısının fiili çalışması henüz doğrulanmadı.
