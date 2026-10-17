# PROJECT STATE — tek yetkili durum (yazarı: integrator)

- Durum revizyonu: r2 · 2026-10-17 12:20 (Europe/Istanbul)
- Ürün: `coord/BRIEF.md` (kesinleşti). Fuji test cüzdanı `.env` içinde hazır (`AGENT_ADDRESS`); test AVAX organizatörden kullanıcının MetaMask adresine gelecek, kullanıcı 1 AVAX agent adresine aktaracak (faucet/kupon yok).
- OKX: `grail` profili bağlı (gerçek para; `dry_run` açık).
- Entegrasyon: `main` @ ilk commit (iskelet)
- Son doğrulanmış çalışan sürüm: yok (henüz ürün kodu yok)
- Aktif sözleşme: `contracts/VERSION` = 0.3
- Kaynak: Avalanche workshop slaytı (ERC-8004 boilerplate) ve ATK yapılandırması → D-006
- Sıradaki öncelik: T-001, T-002, T-003, T-004 ŞİMDİ paralel başlar. T-005 (UI) 15:00'te.

## Zaman kapıları
| Saat | Kapı | Ölçüt |
|---|---|---|
| 13:30 | Fuji deploy | `contracts/chain.json` içinde adresler + ABI + agentId, Snowtrace'te görünüyor |
| 14:00 | Engine testleri | `engine` test komutu geçer (golden değerler) |
| 14:00 | ATK veri + dry_run emir | bakiye + ticker + simüle emir çalışıyor |
| 15:00 | Uçtan uca ilk döngü | 1 commit tx + 1 ATK (dry_run) emri + 1 reveal tx; ardından kullanıcı onayıyla 1 küçük canlı emir |
| 15:00 | UI başlar | proje %80 olmasa bile; Antigravity kotası bu saate kadar kullanılmaz |
| 17:00 | Feature freeze | sadece hata düzeltme + UI güncelleme |
| 18:00 | Yedek demo videosu | kayıt hazır |
| 19:00 | Teslim | |

## Görev panosu
| Görev | Başlık | Sahip | Durum | Bağımlılık |
|---|---|---|---|---|
| T-001 | Quant engine çekirdeği + golden testler | engine (Claude Code · Max) | TODO | contracts 0.3 |
| T-002 | ATK veri çekme + emir katmanı (dry_run → küçük canlı) | agents (Codex · hesap 1) | TODO | contracts 0.3 |
| T-003 | ERC-8004 kimlik + GrailLedger + Fuji deploy | chain (Codex · hesap 2) | TODO | contracts 0.3 |
| T-004 | UI brifi (ekranlar, palet, alan eşlemesi) | docs (Claude · Pro) | TODO | contracts 0.3 |
| T-005 | UI inşası | web (Antigravity) | TODO (15:00) | T-004, state.example.json |
| T-006 | Agent döngüsü: veri → engine → commit → ATK → reveal → state.json | agents (Codex · hesap 1) | TODO | T-001, T-002, T-003 |
| R-* | Merge öncesi bağımsız inceleme (`coord/reviews/`) | reviewer (engine işini Codex · hesap 2; Codex işlerini Claude · Pro) | T-003 sonrası | READY_FOR_REVIEW dal |

## Kanıtlar (tx hash, emir kimliği, test çıktıları)
- (boş)

## Bekleyen merge'ler
- (yok)

## Engeller
- (yok)
