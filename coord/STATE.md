# PROJECT STATE — tek yetkili durum (yazarı: integrator)

- Durum revizyonu: r9 · 2026-10-17 14:10 (Europe/Istanbul)
- Ürün: `coord/BRIEF.md` (kesinleşti). Fuji test cüzdanı `.env` içinde hazır (`AGENT_ADDRESS`); 13:05 organizatörden 1 test AVAX kullanıcının MetaMask'ına (0x3b8b2…3C537, Fuji) GELDİ → kullanıcı ~0.9 AVAX agent adresine aktaracak (gas için ~0.1 MetaMask'ta kalır).
- OKX: `grail` profili bağlı (gerçek para; `dry_run` açık).
- Entegrasyon: T-001 (`e06987b`), T-004 (`a630cb6`), T-007 (`3181848`), T-005 v1 (`67a5e4a`), T-002 (`main@04c5c3d`); R-002 (`role/review@bad30c3`, bu kayıtla aynı merge commit'i).
- Son doğrulanmış parçalar: agents dalda 78 test (0.19s), main + contracts 0.5 ile 78 test (0.38s, 14:08); önceki engine/analyst 84 test + web build (13:56). Uçtan uca döngü / gerçek state / Fuji UI henüz doğrulanmadı.
- Aktif sözleşme: `contracts/VERSION` = 0.5 (D-011: LLM alanları hash'e, SELL exempt, state limit/kimlik alanları; ledger[] RED; dry_run açık)
- Kaynak: Avalanche workshop slaytı (ERC-8004 boilerplate) ve ATK yapılandırması → D-006
- Sıradaki öncelik: T-003 deploy → T-006 (analist + R-002 koşulları) → UI gerçek state/Fuji. R-002-1 düzeltilmeden canlıya geçilmez. Roller temiz worktree'de `git merge main` ile 0.5'i almalı.

## Zaman kapıları
| Saat | Kapı | Ölçüt |
|---|---|---|
| 13:30 | Fuji deploy — KAÇTI | Chain (Codex · hesap 2) 13:48'de başladı; 14:05 hâlâ push yok (kullanıcı), 14:08 fetch: origin/role/chain hâlâ 987d7e4; deploy kanıtı yok |
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
| T-001 | Quant engine çekirdeği + golden testler | engine (Claude Code · Max) | INTEGRATED | contracts 0.5 uyumu doğrulandı |
| T-002 | ATK veri çekme + emir katmanı (dry_run; canlı öncesi R-002-1) | agents (Codex · hesap 1) | INTEGRATED | contracts 0.4; 0.5 ile 78 test |
| T-003 | ERC-8004 kimlik + GrailLedger + Fuji deploy | chain (Codex · hesap 2) | IN_PROGRESS (13:48 başlangıç) | contracts 0.3 |
| T-004 | UI brifi (ekranlar, palet, alan eşlemesi) | docs (Claude · Pro) | INTEGRATED | contracts 0.3 |
| T-005 | UI v1 (mock/demo); gerçek state/Fuji doğrulaması bekliyor | web (Claude Code · Max) · QA: Antigravity | INTEGRATED (v1; gerçek state/Fuji açık) | T-004; gerçek veri T-003/T-006 |
| T-006 | Agent döngüsü: decide → analyst review_payload → commit → ATK → reveal → state | agents (Codex · hesap 1) | TODO | T-001, T-002, T-003, T-007; contracts 0.5 |
| T-007 | LLM analist (yalnız BUY riskini azaltır; SELL exempt) | analyst (Claude Code · Max) | INTEGRATED | T-001; contracts 0.5 |
| R-002 | T-002 incelemesi: APPROVE koşullu, BLOCKER yok | Claude Code · Max (Opus 5.5) | DONE | bad30c3; R-002-1/2 T-006 kabulünde |
| R-* | Merge öncesi bağımsız inceleme (`coord/reviews/`) | reviewer (engine işini Codex · hesap 2; Codex işlerini Claude · Pro) | T-003 sonrası | READY_FOR_REVIEW dal |

## Kanıtlar (tx hash, emir kimliği, test çıktıları)
- T-001: `role/engine@f8a7dc9` uzak dalla aynı; sınır kontrolü yalnızca `engine/` + `coord/handoffs/engine.md` (13 dosya).
- T-001: `cd engine && uv run pytest -q` → merge öncesi 49 passed (2.84s); main + contracts 0.4 / lookback 48 ile 49 passed (3.57s).
- Config kontrolü: v0.4 VERSION/config/state eşleşiyor; validate_config hatasız; 49 sentetik kapanışla 48 bar, deterministik payload ve dry_run=true doğrulandı. Dış emir/tx yok.
- T-004: `1b61651` uzak dalda; sınır docs/ + kendi handoff'u. Brif kabul/formül kontrolü geçti (n_eff=1.437, SR_p=0.599); `git diff --check` geçti.
- T-007: `98ae2ba` uzak dalda; analyst/ + engine/pyproject.toml test bağlantısı + kendi handoff'u (kullanıcının doğruladığı teslim). `cd engine && uv run pytest -q` → merge öncesi ve main üzerinde 84 passed (1.51s).
- T-005 v1: `3cce8c2` uzak dalda; sınır web/ + kendi handoff'u. `cd web && npm run build` dalda ve main'de geçti (main: 45 modül, 523ms). Gerçek state/Fuji doğrulaması yapılmadı.
- v0.5 son kontrol: `cd engine && uv run pytest -q` → 84 passed (1.99s); `cd web && npm run build` → geçti (45 modül, 612ms). VERSION/config/state, üç limit, null kimlik, ledger yok; gerçek engine payload'ında analist skip/veto + SELL exempt + kanonik LLM alanları doğrulandı (ağsız).
- T-002: `1e36e99` uzak dalda; sınır sadece agents/ + kendi handoff'u. `cd agents; uv run pytest -q` dalda 78 passed (0.19s), main + v0.5 ile 78 passed (0.38s). ATK/smoke/canlı emir çalıştırılmadı.
- R-002: Claude Max `bad30c3` → APPROVE koşullu, BLOCKER yok; reviewer test çalıştırmadı (kod incelemesi), integrator yukarıdaki 78 testi bağımsız çalıştırdı. R-002-1 MAJOR ve R-002-2 T-006 kabulüne işlendi; ürün kodunda henüz düzeltilmedi.
- R-002 merge sınırı: yalnız coord/reviews/T-002.md + coord/handoffs/reviewer.md; `git diff --check` ve rapor/kart/STATE koşul tutarlılığı doğrulandı. Agents kaynakları 78 testin geçtiği ağaçla aynı.

## Bekleyen merge'ler
- (yok)

## Engeller
- Fuji deploy gecikti (13:30 kapısı kaçtı; chain 13:48'de başladı, 14:05 push yok). Gerçek state/Fuji UI kontrolü T-003/T-006 çıktısını bekliyor.
- Canlı mod kapısı: R-002-1 kesin red → kalıcı unknown kilidi agents sahibince düzeltilmeli; R-002-2 pending/partial rezerv uzlaştırması T-006'da doğrulanmalı. dry_run=true.
- Web v1 llm_note/llm_flag için ayrı satır göstermiyor (ham payload detayında bulunabilir); web sahibi 0.5 alanlarını UI'a yansıtmalı.
