# PROJECT STATE — tek yetkili durum (yazarı: integrator)

- Durum revizyonu: r4 · 2026-10-17 13:51 (Europe/Istanbul)
- Ürün: `coord/BRIEF.md` (kesinleşti). Fuji test cüzdanı `.env` içinde hazır (`AGENT_ADDRESS`); 13:05 organizatörden 1 test AVAX kullanıcının MetaMask'ına (0x3b8b2…3C537, Fuji) GELDİ → kullanıcı ~0.9 AVAX agent adresine aktaracak (gas için ~0.1 MetaMask'ta kalır).
- OKX: `grail` profili bağlı (gerçek para; `dry_run` açık).
- Entegrasyon: T-001 (`main@e06987b`) + T-004 (`role/docs@1b61651`, bu kayıtla aynı merge commit'i).
- Son doğrulanmış parçalar: engine 49 test (13:19); T-004 brif kabul kontrolü + formül sayıları (13:51). Uçtan uca döngü henüz doğrulanmadı.
- Aktif sözleşme: `contracts/VERSION` = 0.4 (D-010: risk bütçesi yorumu kabul; lookback 168 → 48; dry_run açık)
- Kaynak: Avalanche workshop slaytı (ERC-8004 boilerplate) ve ATK yapılandırması → D-006
- Sıradaki öncelik: kullanıcı sırasıyla T-007 ve T-005 v1 merge istedi; ardından contracts 0.5 ve T-002/T-006 kartları. T-002 R-002 APPROVE gelene kadar bekler.

## Zaman kapıları
| Saat | Kapı | Ölçüt |
|---|---|---|
| 13:30 | Fuji deploy — KAÇTI | Chain (Codex · hesap 2) 13:48'de başladı; deploy kanıtı henüz yok |
| 14:00 | Engine testleri | `engine` test komutu geçer (golden değerler) |
| 14:00 | ATK veri + dry_run emir | bakiye + ticker + simüle emir çalışıyor |
| 15:00 | Uçtan uca ilk döngü | 1 commit tx + 1 ATK (dry_run) emri + 1 reveal tx; ardından kullanıcı onayıyla 1 küçük canlı emir |
| 15:00 | UI inşası başlar | proje %80 olmasa bile; tasarım ~14:00 Claude Design; Antigravity UI testi + yedek |
| 17:00 | Feature freeze | sadece hata düzeltme + UI güncelleme |
| 18:00 | Yedek demo videosu | kayıt hazır |
| 18:45 | Teslim formu | `coord/SUBMISSION.md` kontrol listesi tamam, form gönderildi (zorunlu: Builder Hub e-postası, GitHub, sunum linki) |
| 19:00 | Teslim kapanır | |

## Görev panosu
| Görev | Başlık | Sahip | Durum | Bağımlılık |
|---|---|---|---|---|
| T-001 | Quant engine çekirdeği + golden testler | engine (Claude Code · Max) | INTEGRATED | contracts 0.3; 0.4 uyumu doğrulandı |
| T-002 | ATK veri çekme + emir katmanı (dry_run → küçük canlı) | agents (Codex · hesap 1) | READY_FOR_REVIEW — R-002 sürüyor, MERGE BEKLER | contracts 0.4 |
| T-003 | ERC-8004 kimlik + GrailLedger + Fuji deploy | chain (Codex · hesap 2) | IN_PROGRESS (13:48 başlangıç) | contracts 0.3 |
| T-004 | UI brifi (ekranlar, palet, alan eşlemesi) | docs (Claude · Pro) | INTEGRATED | contracts 0.3 |
| T-005 | UI v1 (mock/demo); gerçek state/Fuji doğrulaması bekliyor | web (Claude Code · Max) · QA: Antigravity | READY_FOR_REVIEW | T-004, state.example.json |
| T-006 | Agent döngüsü: veri → engine → commit → ATK → reveal → state.json | agents (Codex · hesap 1) | TODO | T-001, T-002, T-003 |
| T-007 | LLM analist (sadece riski azaltır, gerekçe zincire) | analyst (Claude Code · Max) | READY_FOR_REVIEW | T-001 |
| R-* | Merge öncesi bağımsız inceleme (`coord/reviews/`) | reviewer (engine işini Codex · hesap 2; Codex işlerini Claude · Pro) | T-003 sonrası | READY_FOR_REVIEW dal |

## Kanıtlar (tx hash, emir kimliği, test çıktıları)
- T-001: `role/engine@f8a7dc9` uzak dalla aynı; sınır kontrolü yalnızca `engine/` + `coord/handoffs/engine.md` (13 dosya).
- T-001: `cd engine && uv run pytest -q` → merge öncesi 49 passed (2.84s); main + contracts 0.4 / lookback 48 ile 49 passed (3.57s).
- Config kontrolü: v0.4 VERSION/config/state eşleşiyor; validate_config hatasız; 49 sentetik kapanışla 48 bar, deterministik payload ve dry_run=true doğrulandı. Dış emir/tx yok.
- T-004: `1b61651` uzak dalda; sınır docs/ + kendi handoff'u. Brif kabul/formül kontrolü geçti (n_eff=1.437, SR_p=0.599); `git diff --check` geçti.

## Bekleyen merge'ler
- T-007 `role/engine@98ae2ba`, sonra T-005 v1 `role/web@3cce8c2`: kullanıcı merge istedi; kontroller çalıştırılacak.
- T-002 `role/agents@1e36e99`: Claude R-002 incelemesi sürüyor; APPROVE gelmeden merge YOK.

## Engeller
- Fuji deploy gecikti (13:30 kapısı kaçtı; chain 13:48'de başladı). Gerçek state/Fuji UI kontrolü T-003/T-006 çıktısını bekliyor.
