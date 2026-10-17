# PROJECT STATE — tek yetkili durum (yazarı: integrator)

- Durum revizyonu: r28 · 2026-10-17 16:07 (Europe/Istanbul)
- Ürün: ilk CANLI 15:37 başarılı; agent1/cycle2, BUY BTC-USDT 2 USDT, filled (kullanıcı/planner + yerel state eşleşmesi). Yeni/sürekli koşu yetkisi yok.
- Aktif sözleşme: VERSION 0.6.1 (belge/eklemeli metrik); config/payload/state contract_version=0.6, chain.json deploy=0.5. Config/adres/ABI/hash değişmedi (D-017).
- Bu teslim tamam: T-014 kartı + eklemeli signals/5x5 corr/target tabanı + ignore sertleştirmesi; R-005 4927557 ve R-007 2682d99 merge edildi. Her merge sonrası push.
- Güncel yerel kontroller: engine 104 (4.42s), agents 157 (17.93s), web build (633ms); JSON/sinyal/matris ve 26 ignore yolu geçti. T-014 motoru henüz uygulanmadı.
- Public kapısı: R-005 PUBLIC GO yalnız taranan main9acec55/ref kümesi için; MINOR-1 kapandı. Yayınlanacak son HEAD değiştiği için farklar yeniden taranır; bu chat public ayarını değiştirmez.
- Öncelik: engine T-014 teslim 16:30 → chain/Codex-2 inceleme → integrator merge <=16:50; yetişmezse özellik dışarıda. R-007 web etiket/taban MAJOR’ları sahipte açık.
- Önceki ayrıntılı kanıtlar coord/archive/STATE-r26-20261017.md; daha eski kayıt r17 arşivinde.

## Zaman kapıları
| Saat | Kapı | Ölçüt |
|---|---|---|
| 13:30 | Fuji deploy — GEÇ TAMAMLANDI | Kapı kaçtı; chain 13:48 başladı. fdd4bf0 push'lu; 14:36 dört deploy + kayıt RPC receipt/bytecode ile doğrulandı |
| 14:00 | Engine testleri | `engine` test komutu geçer (golden değerler) |
| 14:00 | ATK veri + dry_run emir | bakiye + ticker + simüle emir çalışıyor |
| 15:00 | Uçtan uca dry_run — GEÇTİ (14:50) | agents@dcf68db; kullanıcı/planner tx doğrulaması; gerçek ATK okuma + Fuji commit/reveal + 5 simulated BUY. Canlı ayrı kullanıcı kapısı |
| 15:00 | UI inşası başlar | proje %80 olmasa bile; tasarım ~14:00 Claude Design; Antigravity UI testi + yedek |
| 16:30 | T-014 teslim kapısı | Engine test/handoff/commit/push + RAPOR tamam; geçse kapsam dışı |
| 16:50 | T-014 merge üst sınırı | Codex-2 bağımsız APPROVE + integrator testleriyle merge/push; aksi halde kapsam dışı |
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
| T-014 | Hurst rejimi + kırılım/retest BUY azaltma katmanı | engine; inceleme chain/Codex-2 | TODO | teslim 16:30; merge <=16:50; config aynı; yetişmezse dışarıda |
| R-002 | T-002 incelemesi: APPROVE koşullu, BLOCKER yok | Claude Code · Max (Opus 5.5) | DONE | bad30c3; R-002-1/2 T-006 kabulünde |
| R-003 | T-003 incelemesi: APPROVE koşullu, yeniden deploy yok | reviewer (Claude Code · Opus 5.5) | DONE | a6044d7; R-003-2 decision.md v0.6, R-003-3 T-006 kabulünde |
| R-004 | İlk T-006 incelemesi (tarihsel) | reviewer (Claude Code · Opus 5.5) | DONE; güncel karar R-004b | 62ef3c3; üç MAJOR R-004b ile kapandı |
| R-005 | Public öncesi sır/anahtar taraması | reviewer (Claude Opus) | DONE / PUBLIC GO (taranan kapsam) | 4927557; main9acec55 + ref kümesi; MINOR-1 kapandı, son HEAD tekrar taraması açık |
| R-004b | T-006 düzeltmeleri + sınırlı canlı kapı | reviewer (Claude Opus) | DONE / APPROVE | ac96902; 2bf5668; kullanıcı ilk canlıyı 15:37 yaptı |
| R-006 | T-010 bağımsız inceleme | docs/reviewer (Claude Opus) | DONE / APPROVE | e77eaed; gerçek rapor coord/reviews/T-010.md; 1 MINOR + 3 INFO |
| R-007 | UI matematiği ve etiket/taban incelemesi | engine/reviewer (Claude Opus) | DONE (inceleme; 4 MAJOR açık) | 2682d99; sözleşme istekleri 0.6.1’de işlendi; web düzeltmeleri ayrı |
| R-* | Merge öncesi bağımsız inceleme (`coord/reviews/`) | reviewer (engine işini Codex · hesap 2; Codex işlerini Claude · Pro) | T-003 sonrası | READY_FOR_REVIEW dal |

## Kanıtlar / bu teslim
- Başlangıç main@ad7edd1 temizdi. R-005 4927557 yalnız reviewer handoff + public raporu; R-007 2682d99 yalnız engine handoff + inceleme raporu. İkisi uzak dallarda erişilebilir; sınır/diff kontrolü temiz.
- R-005 raporu: 100 commit / 535 blob desen + 537 blob gerçek sır eşleştirmesi, 0 gerçek sır; PUBLIC GO. Bunlar reviewer kanıtı; integrator bu tur anahtar/.env okumadı veya taramayı tekrar etmedi. MINOR-2/3/4 ve raporun kapsam sınırları korunur.
- Ignore kontrolü: 18 sentetik riskli yol engellendi; 8 örnek/fixture/çıktı yolu açık. İstenen sqlite/runtime/fuji/live-config/envrc/pem/key/.claude kuralları var; public JSON fixtures istisnalı, PEM/key gibi sır türleri fixtures içinde de kapalı. Mevcut tracked fixture’lar korundu.
- R-007 sözleşme istekleri: corr_matrix 5 coin/5x5 simetrik, diag1/offdiag0.62; avg_corr0.62/n_eff1.44/SR0.60 ile tutarlı. target_weight_pct normalde deploy_base=min(equity,max_deploy), koruma HOLD’unda equity; normal HOLD tek başına tabanı ayırt ettirmez. Kod/hash değişikliği yok.
- T-014: metrics.signals coin başına sonlu hurst + rejim + setup. 0.45 ve 0.55 dahil unclear; setup none/breakout/retest yalnız mevcut BUY’ı azaltır, BUY üretmez. Örnek alan eklendi; engine uygulaması/bağımsız inceleme ayrı ve süre kapılı.
- R-007 2682d99: yalnız coord/reviews/R-007-ui-math.md + engine handoff; kullanıcı açık inceleme teslimi talimatıyla rol sınırı istisnası kabul edildi. Matematik formülleri doğru, 4 MAJOR metrik/etiket/taban bulgusu açık; integrator yalnız iki sözleşme isteğini uyguladı.
- Güncel kontroller: uv run --no-sync pytest -q engine104 / agents157; npm run build PASS. İlk sandbox denemeleri uv cache erişiminden başlamadı; izinli aynı komutlar geçti. JSON/matris/signals + config/chain.json değişmezliği doğrulandı. T-014 testleri gelecekte engine teslimindedir.
- İlk canlı OKX 4017748393474314240 filled; commit 0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569 → reveal 0xae6537e9acc9e66accfe5d0fe61b2f9a858460d7c42cf3d25f0acafa378541f7. Planner Fuji doğrulaması kullanıcı kanıtı; bu tur yeni RPC/runner/emir/tx yok.
- LLM_API_KEY eklendi kullanıcı bildirimi; değer okunmadı, fiili provider/cycle2 LLM kullanımı henüz doğrulanmadı. Runtime/journal/pending korunur.

## Bekleyenler / sınırlar
- R-007 2682d99 raporu alındı; dört MAJOR web etiketi/target tabanı bulgusu bu sözleşme açıklamasıyla düzelmiş sayılmaz. Ürün sahipleri RAPOR ile alır, otomatik mesaj yok.
- T-014 engine teslim 16:30, chain/Codex-2 yalnız inceleme raporu/handoff; integrator <=16:50. Geç kalırsa main/demo dışında; yeni özellik için zaman kapısı uzatılmaz.
- Public öncesi son SHA fark taraması; R-006 RPC429 + 3 INFO ve dört Snowtrace #code görsel kontrolü açık. Repo görünürlüğü aynı.
- T-011 final sunum, T-013 web uygulaması/metin tamamlaması, T-012 kapanış-fill/provenance kabul açıkları ve gerçek runtime UI takibi sürer. README D-012 freeze sonrası.
- R-004/R-002 MINOR/NIT sınırları devam eder; yeni canlı/sürekli çalışma, geçmiş/runtime temizleme veya anahtar loglama yok.
