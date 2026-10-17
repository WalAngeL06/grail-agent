# PROJECT STATE — tek yetkili durum (yazarı: integrator)

- Durum revizyonu: r19 · 2026-10-17 15:33 (Europe/Istanbul)
- Ürün: Fuji 43113, dört kontrat, ERC-8004 agentId 1; tarihsel 14:50 dry_run kapısı geçti. Canlı koşu çalıştırılmaz; sınırlı kullanıcı koşusu R-004b + hedef T-006 main test/merge sonucunu bekler.
- OKX: grail profili, gerçek para; örnek config dry_run=true. Kod yazan AI ilk canlı emri çalıştırmaz.
- Aktif sözleşme: contracts/VERSION 0.6; chain.json deployment 0.5, adres/ABI/hash/testVector değişmedi.
- Sıralı kullanıcı entegrasyonu: 2/6 tamam; kalan: engine@b7e294b; chain@f36a95d; review@ac96902; agents@2bf5668. Her merge sonrası main push edilir.
- Son yerel kontrol: web build PASS; engine 84 (önceki tur), agents 78 (önceki tur), chain 25 (önceki tur). Sayıların hangi aşamada koşulduğu aşağıda.
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
| T-006 | Agent döngüsü: decide → analyst → commit → ATK → reveal → state | agents (Codex · hesap 1) | BLOCKED (merge kapısı) | R-004-1/2/3 düzeltme + yeniden inceleme/test; canlı NO-GO |
| T-007 | LLM analist (yalnız BUY riskini azaltır; SELL exempt) | analyst (Claude Code · Max) | INTEGRATED | T-001; contracts 0.5 |
| T-008 | Teslim metinleri: form açıklaması, README taslağı, pitch, demo | docs (Claude Code · Max) | INTEGRATED (taslaklar; freeze sonrası doğrulama açık) | T-003/T-006 gerçek değerleri; D-012 |
| T-009 | Engine reason metinleri: sade İngilizce; alan/API aynı | engine (Claude Code · Max) | TODO | T-001; contracts 0.6; tasarım + web talebi |
| T-010 | Snowtrace kaynak doğrulama + verify-cycle.ts okuma komutu | chain (Codex · hesap 2) | TODO | T-003 mevcut deploy; yeni deploy/tx yok; contracts 0.6 |
| T-011 | Pitch outline → PowerPoint (docs/pitch/) | docs (Claude · Pro) | INTEGRATED (taslak; final hazırlığı açık) | caedc29; 10 slayt/not/render; README/kaynak notları/TBD/süreler bekler |
| T-012 | 30-day replay: GRAIL vs eşit ağırlık | engine (Claude Code · Max) | TODO | T-009 ile sırayla; gerçek OKX mumları, engine/out/replay.json + kısa EN özet; yalnız okuma |
| T-013 | Plain English UI metinleri | docs | INTEGRATED (ilk kopya) | 1d411c0; 5 kart, 21 terim, ekran/boş/hata; web uygulaması ayrı |
| R-002 | T-002 incelemesi: APPROVE koşullu, BLOCKER yok | Claude Code · Max (Opus 5.5) | DONE | bad30c3; R-002-1/2 T-006 kabulünde |
| R-003 | T-003 incelemesi: APPROVE koşullu, yeniden deploy yok | reviewer (Claude Code · Opus 5.5) | DONE | a6044d7; R-003-2 decision.md v0.6, R-003-3 T-006 kabulünde |
| R-004 | T-006 incelemesi: APPROVE koşullu; 3 MAJOR; canlı NO-GO | reviewer (Claude Code · Opus 5.5) | DONE | 62ef3c3; dcf68db incelendi; D-014 üçü de merge öncesi |
| R-005 | Public öncesi sır/anahtar/.env/gitignore taraması | reviewer (Codex · hesap 2) | TODO | coord/reviews/R-005-public.md; tüm ref geçmişi + güncel ağaç; yayınlanacak son SHA kontrolü |
| R-* | Merge öncesi bağımsız inceleme (`coord/reviews/`) | reviewer (engine işini Codex · hesap 2; Codex işlerini Claude · Pro) | T-003 sonrası | READY_FOR_REVIEW dal |

## Kanıtlar / bu entegrasyon
- Başlangıç main@9205570 temiz ve origin/main ile aynı. Altı hedef uzak rol branch’lerinde erişilebilir; her sahibin yazma sınırı kontrol edildi.
- Tarihsel Fuji cycle1: gerçek ATK okuma + 5 simulated BUY; errors=0, commit/reveal 1/1. Bu tur dış ağ kanıtı yeniden üretilmedi.
- T-005 57e2287: UI v2 + How it works; npm run build PASS (48 modül, 556ms). Gerçek Fuji fixture ve ekran kanıtları sahip teslimi; integrator bu tur tarayıcı/RPC açmadı. diff --check: Dashboard.tsx:321 fazladan EOF boş satırı (MINOR, hedef aynen alındı).
- T-013 1d411c0: docs/ui-copy.md: 5 How it works kartı, 21 terim, ekran şablonları, boş/bekleme/hata metinleri. Belge/alan kapsamı okundu; web uygulaması ve ek tooltip/replay metni tamamlama ayrı. diff --check temiz.

## Bekleyenler / sınırlar
- engine@b7e294b; chain@f36a95d; review@ac96902; agents@2bf5668.
- T-011 sunum son hazırlığı: README/kaynak notları/süreler/TBD; T-013 ilk kopyasının eksik tooltip/replay/terimleri docs, uygulamasını web tamamlar.
- T-012 kapanış-fill varsayımı açık; sonraki açılış, strict eksik/tekrar veri ve provenance/şema kabul maddeleri tamamlanmış sayılmaz.
- R-005 public taraması bekler; R-006 bağımsız chain incelemesi chain aşamasında kart açılacak. Canlı koşu, deploy, yeni tx veya otomatik rol mesajı yok.
- R-004-4/5/6/7 ve R-002-3/4 MINOR/NIT açık; R-004b raporundaki sınırlar korunur. Gerçek runtime UI ve ilk canlı kanıtı henüz yok.
- T-006 merge kapısı: R-004-1/2/3 düzeltmeleri + bağımsız R-004b + integrator hedef testleri birlikte gerekli; tamamlanmadan canlı koşu yok.
