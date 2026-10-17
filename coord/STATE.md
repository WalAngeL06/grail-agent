# PROJECT STATE — tek yetkili durum (yazarı: integrator)

- Durum revizyonu: r1 · 2026-10-17 (Europe/Istanbul)
- Entegrasyon: `main` @ ilk commit (iskelet)
- Son doğrulanmış çalışan sürüm: yok (henüz ürün kodu yok)
- Aktif sözleşme: `contracts/VERSION` = 0.1
- Sıradaki öncelik: T-001, T-002, T-003 paralel başlar; T-004 (UI brifi) paralel; T-005 (UI) 15:00'te.

## Zaman kapıları
| Saat | Kapı | Ölçüt |
|---|---|---|
| 13:00 | Fuji deploy | `contracts/chain.json` içinde adres + ABI, Snowtrace'te görünüyor |
| 13:00 | Engine testleri | `engine` test komutu geçer (golden değerler) |
| 13:00 | ATK demo emri | demo emir kimliği loglandı |
| 14:00 | Uçtan uca ilk döngü | 1 commit tx + 1 ATK demo emri + 1 reveal tx, kimlikleri burada |
| 15:00 | UI başlar | proje %80 olmasa bile; Antigravity kotası bu saate kadar kullanılmaz |
| 17:00 | Feature freeze | sadece hata düzeltme + UI güncelleme |
| 18:00 | Yedek demo videosu | kayıt hazır |
| 19:00 | Teslim | |

## Görev panosu
| Görev | Başlık | Sahip | Durum | Bağımlılık |
|---|---|---|---|---|
| T-001 | Quant engine çekirdeği + golden testler | engine (Claude Max) | TODO | contracts 0.1 |
| T-002 | ATK veri çekme + ilk demo emri | agents (Codex) | TODO | contracts 0.1 |
| T-003 | GrailLedger kontratı + Fuji deploy | chain (GPT Plus 2) | TODO | contracts 0.1 |
| T-004 | UI brifi (ekranlar, palet, alan eşlemesi) | docs (Claude Pro) | TODO | contracts 0.1 |
| T-005 | UI inşası | web (Antigravity) | TODO (15:00) | T-004, state.example.json |
| T-006 | Agent döngüsü: veri → engine → commit → ATK → reveal → state.json | agents (Codex) | TODO | T-001, T-002, T-003 |
| R-* | Merge öncesi bağımsız inceleme (`coord/reviews/`) | reviewer (GPT Plus 2; GPT işlerini Claude Pro) | T-003 sonrası | READY_FOR_REVIEW dal |

## Kanıtlar (tx hash, emir kimliği, test çıktıları)
- (boş)

## Bekleyen merge'ler
- (yok)

## Engeller
- (yok)
