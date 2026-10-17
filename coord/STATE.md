# PROJECT STATE — tek yetkili durum (yazarı: integrator)

- Durum revizyonu: r13 · 2026-10-17 14:43 (Europe/Istanbul)
- Ürün: `coord/BRIEF.md` kesinleşti; Fuji 43113'te dört kontrat + ERC-8004 agentId 1 deploy/kayıt doğrulandı. `contracts/chain.json` adres/ABI/testVector hazır.
- OKX: `grail` profili bağlı (gerçek para; `dry_run` açık).
- Entegrasyon: T-001/002/003/004/005(v0.5 UI)/007/008(taslaklar), R-002/R-003 main'de. R-003 (`role/review@a6044d7`) APPROVE koşullu; iki merge koşulu D-013 ile işlendi, yeniden deploy gerekmez.
- Son doğrulama: birleşmiş main + v0.6: chain 25, agents 78, engine+analyst 84 test ve web build geçti (14:43). Fuji salt okunur RPC + çapraz hash 14:36 kanıtı aynı; uçtan uca döngü / gerçek state-Fuji UI henüz doğrulanmadı.
- Aktif sözleşme: `contracts/VERSION` = 0.6 (D-013: reveal sonuç eşlemesi; T-006 kalıcı/monoton cycle_id kabulü). D-011 payload/hash ve state alanları aynı; chain.json deploy sürümü 0.5, dry_run açık.
- Kaynak: Avalanche workshop slaytı (ERC-8004 boilerplate) ve ATK yapılandırması → D-006
- Sıradaki öncelik: agents temiz worktree'de `git merge main` ile v0.6'yı alıp T-006'yı (analist + R-002-1/2 + R-003-2/3) tamamlasın → UI gerçek state/Fuji. README taşıma kapısı D-012; R-002-1 çözülmeden canlı yok.

## Zaman kapıları
| Saat | Kapı | Ölçüt |
|---|---|---|
| 13:30 | Fuji deploy — GEÇ TAMAMLANDI | Kapı kaçtı; chain 13:48 başladı. fdd4bf0 push'lu; 14:36 dört deploy + kayıt RPC receipt/bytecode ile doğrulandı |
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
| T-003 | ERC-8004 kimlik + GrailLedger + Fuji deploy | chain (Codex · hesap 2) | INTEGRATED (R-003 koşulları işlendi) | deploy contracts 0.5; v0.6 ile ABI/hash uyumlu |
| T-004 | UI brifi (ekranlar, palet, alan eşlemesi) | docs (Claude · Pro) | INTEGRATED | contracts 0.3 |
| T-005 | UI v0.5 (LLM not/rozet, limitler, ERC-8004 kimlik) | web (Claude Code · Max) · QA: Antigravity | INTEGRATED (gerçek state/Fuji açık) | T-004; gerçek veri T-003/T-006 |
| T-006 | Agent döngüsü: decide → analyst review_payload → commit → ATK → reveal → state | agents (Codex · hesap 1) | TODO | T-001, T-002, T-003, T-007; contracts 0.6; R-002-1/2 + R-003-2/3 |
| T-007 | LLM analist (yalnız BUY riskini azaltır; SELL exempt) | analyst (Claude Code · Max) | INTEGRATED | T-001; contracts 0.5 |
| T-008 | Teslim metinleri: form açıklaması, README taslağı, pitch, demo | docs (Claude Code · Max) | INTEGRATED (taslaklar; freeze sonrası doğrulama açık) | T-003/T-006 gerçek değerleri; D-012 |
| R-002 | T-002 incelemesi: APPROVE koşullu, BLOCKER yok | Claude Code · Max (Opus 5.5) | DONE | bad30c3; R-002-1/2 T-006 kabulünde |
| R-003 | T-003 incelemesi: APPROVE koşullu, yeniden deploy yok | reviewer (Claude Code · Opus 5.5) | DONE | a6044d7; R-003-2 decision.md v0.6, R-003-3 T-006 kabulünde |
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
- T-005 v0.5: `9eb1b52` uzak dalda; sınır web/ + kendi handoff'u (10 dosya). `cd web && npm run build` dalda ve main'de geçti (45 modül; main 526ms). LLM alanları, üç limit ve null/dolu kimlik gösterimleri kaynakta doğrulandı; gerçek state/Fuji henüz denenmedi.
- T-008: `d1e8ea0` uzak dalda; sınır docs/ + kendi handoff'u (5 dosya). Açıklama 179 kelime, pitch 10 slayt, demo 2:00, README bölümleri/yer tutucuları ve formül örneği doğrulandı; `git diff --check` geçti. T-008 kartı açıldı; kök README aynı.
- T-003: `fdd4bf0` uzak dalda; sınır chain/ + contracts/chain.json + kendi handoff'u. `cd chain && npx hardhat test` dalda ve main'de 25 passing (1s); main 28 Solidity dosyası derlendi.
- Fuji: `npm run verify:fuji` salt okunur → dört receipt/ABI/bytecode, owner/metadata/kayıt event'i/registry bağlantıları/hash geçti. AgentId=1; ledger=0x1B5fcf6DeFf2F9375338A2C35932224522118851; IdentityRegistry=0x120A4E53A24ddd09991633b4Cb88c3feA6166721; sayaçlar 0/0.
- Ledger deploy tx: 0xde680409c053d535f55f7ab963bbb1a7dabee8b7e229a1ec819e34da17c730dd; agent kayıt tx: 0xfa98129b1bd4c67a4549f6cb994a3697d826a6d0d8b6832aaece20f3b9e4ee93; ikisi de status=1.
- Hash: Python kanonik JSON birebir; tarayıcı keccak kütüphanesi chain.json testVector ile 0x6828363cc1b98703c227c13258bdaa654db4e1f6e870b27f2795a866cfe98776 eşleşti. Bu oturum yeni dış tx/emir göndermedi; Snowtrace tarayıcı görünümü doğrulanmadı.
- R-003: `a6044d7` = origin/role/review; sınır yalnız coord/reviews/T-003.md + coord/handoffs/reviewer.md. R-003-2 kanonik okxOrderId eşlemesi ve R-003-3 kalıcı/monoton cycle_id kabulü işlendi; T-006 uygulama/test kanıtı henüz yok.
- v0.6 birleşmiş ağaç: `cd chain && npx hardhat test` → 25 passing (1s); `cd engine && uv run pytest -q` → 84 passed (1.70s); `cd agents && uv run pytest -q` → 78 passed (0.22s); `cd web && npm run build` → geçti (45 modül, 644ms).
- v0.6 config/state/VERSION eşleşmesi, validate_config, dry_run=true ve kanonik sonuç örnekleri doğrulandı; chain.json v0.5/golden payload korundu. chain/agents/engine/analyst/web ürün kaynakları 9bc78e3 ile aynı; yeni dış tx/emir yok.

## Bekleyen merge'ler
- (yok)

## Engeller
- Fuji deploy doğrulandı; R-003 merge koşulları kapandı. Gerçek state/Fuji UI ve R-003-3 uygulama kanıtı T-006 döngüsünü bekliyor.
- Canlı mod kapısı: R-002-1 kesin red → kalıcı unknown kilidi agents sahibince düzeltilmeli; R-002-2 pending/partial rezerv uzlaştırması T-006'da doğrulanmalı. dry_run=true.
