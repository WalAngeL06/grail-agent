# R-005 · Repo public öncesi güvenlik taraması

**SONUÇ: PUBLIC GO** — sadece taranan kapsam için geçerli: `origin/main@9acec55` ve aşağıda listelenen bütün uzak branch'ler, 2026-10-17 15:48 +03:00. BLOCKER yok. Public yapılmadan önce son HEAD değişirse, yeni commit'ler için §1–§2 tekrar çalıştırılmalı.

- İnceleyen: reviewer · Claude Code (Opus 5.5) · worktree `Agentic Hack-wt/review` · `role/review`. Gerçek emir, tx ya da dosya değişikliği yok. Gizli değer, değerin ön eki/son eki ya da uzunluğu hiçbir yere yazılmadı.

## Kapsam
- `git fetch origin` + `git merge origin/main` → HEAD = origin/main = **9acec55**.
- `git rev-list --all --count` = **100** commit (`--remotes` = 100). Tag yok.
- `git ls-remote origin` ile karşılaştırıldı: uzaktaki her ref yerelde var ve tarandı. Ref'ler: `main 9acec55`, `role/agents 7bde96d`, `role/chain 2e45f77`, `role/docs 586f3b6`, `role/engine b7e294b`, `role/review ac96902`, `role/web 57e2287`. `refs/pull/*` yok.
- Sadece yerelde olan `claude/planner-status-next-step-fb2fec` ve `claude/rol-engine-devam-84aed9` de tarandı (push edilmemeli; aşağıda MINOR-4).
- Sınır: yerel tarama GitHub tarafındaki silinmiş ref'leri, önbelleği ve fork'ları kapsamaz. Repo şu an private olduğu için public fork yok.

## Araç
- Kurulu gitleaks, trufflehog ya da detect-secrets yok. İndirme yapılmadı. Yerine iki tekrarlanabilir, maskeli yerel tarayıcı yazıldı ve çalıştırıldı (repo dışında, scratchpad'de; ham çıktı repo dışında kaldı ve silindi).
  1. **Desen taraması — her blob'un her sürümü.** `git rev-list --objects --all` → **535 blob / 233 farklı yol** + bütün commit mesajları + pptx/xlsx içindeki dosyalar (iç içe zip dahil). Aranan desenler: PEM private key, Google `AIza…`, `sk-`/`sk-ant-`/`sk-proj-`, GitHub/Slack/AWS token, Bearer, kimlik bilgili URL, `private_key=` + 64 hex, `api_key/secret/passphrase/password/token =` atamaları, UUID (OKX api key biçimi), 32 hex büyük harf (OKX secret biçimi), mnemonic anahtar kelimeleri, bütün 64-hex değerler. Çıktı: sadece tür, yol ve sayı.
  2. **Birebir sır karşılaştırması.** Gerçek `Agentic Hack/.env` ve `~/.okx/config.toml` değerleri sadece bellekte okundu ve 537 blob + commit mesajları + pptx içerikleri içinde birebir arandı (hex için `0x`'li/`0x`'siz, büyük/küçük harf). Çıktı: sadece değişken adı ve eşleşme sayısı.
- Desen taramasının kaçırabileceği sınıflar: bilinmeyen biçimde, görsele gömülü (JPG içindeki metin) ya da kodlanmış (base64 vb.) sırlar. Bu açık 2. tarama ile kapatıldı: bilinen bütün gerçek sırlar birebir arandı.

## Sonuçlar (maskeli)
| Kontrol | Sonuç |
|---|---|
| `.env:AGENT_PRIVATE_KEY` (EVM anahtarı) | **0 eşleşme** — tüm geçmiş, mesajlar, pptx |
| `.env:LLM_API_KEY` | **0** |
| `okx.toml [profiles.grail] api_key / secret_key / passphrase` | **0 / 0 / 0** |
| `.env:AGENT_ADDRESS`, `.env:AVAX_RPC_URL`, `okx.toml base_url` | 6 / 7 / 6 eşleşme. Hepsi zaten herkese açık değerler: agent cüzdan adresi, public Fuji RPC, `tr.okx.com`. Sır değil. |
| PEM, AIza, sk-, GitHub/Slack/AWS, Bearer, kimlik bilgili URL, `private_key=`/`api_key=`… atamaları, UUID, 32 hex büyük harf | **0** |
| mnemonic/seed anahtar kelimesi | 2 yol: `coord/tasks/R-005.md`, `coord/reviews/T-010.md` — sadece görev metninde kelime geçiyor, kelime dizisi yok |
| 64-hex değerler | 1872 farklı değer. 1817'si sadece `uv.lock`/`package-lock.json` paket hash'i. Kalan 55 değer şöyle sınıflandı (yerelde ethers ile, ağa anahtar gönderilmeden): bir kısmı Fuji'de var olan tx hash'i; geri kalanı commit hash, açıklanmış salt, demo fixture'ı, test vektörü. **Hiçbiri anahtar olarak kullanıldığında agent cüzdanına türemiyor.** Türeyen adresi Fuji'de aktif olan 2 değer de herkesin bildiği vektör: `contracts/chain.json` testVector salt'ı (tek tekrarlı bayt) ve `agents/tests/test_cycle_storage.py:14` keccak("") Ethereum referans vektörü → yanlış alarm. |
| Adresler (HEAD) | 5 farklı 0x40 adres: agent cüzdanı + IdentityRegistry, ReputationRegistry, ValidationRegistry, GrailLedger. Hepsi public. |
| pptx (`docs/pitch/GRAIL-pitch.pptx`, geçmişte 2 sürüm) | 78 iç dosya, 22 konuşmacı notu, gömülü `Microsoft_Excel_Worksheet1.xlsx` dahil iç içe tarandı → 0 sır. Metadata yazar alanları "GRAIL". |

## İzlenen dosyalar ve `.gitignore`
- **Geçmişte hiç izlenmemiş** (100 commit, bütün ref'ler, ekleme/silme/yeniden adlandırma): `.env`, `.env.*` (`.env.example` dışında), `*.sqlite3`, `runtime/`, `state.json`, `fuji-transactions.json`, `fuji-events.json`, `live-config.json`, `pending/`, `.venv/`, `node_modules/`, `*.pem`/`*.key`, `config.toml`, `*.log`. Yani 15:37 canlı emrinin runtime'ı (journal, salt, tx journal) git'te değil.
- Şu an izlenen riskli adaylar: sadece `.env.example` ve `web/.env.example` — ikisi de yer tutucu (`AGENT_PRIVATE_KEY=` ve `LLM_API_KEY=` boş; RPC/site değerleri public) — ve sentetik `web/fixtures/demo-state.json`.
- `git check-ignore -v --no-index`, sentetik yollarla:
  - Ignore ediliyor: `.env`, `agents/.env`, `chain/.env`, `web/.env.local`, `.env.production`, `.env.bak`, `agents/runtime/live/{orders.sqlite3, state.json, fuji-transactions.json, fuji-events.json, pending/1.json}`, `agents/runtime/live-config.json`, `runtime/x.json`, `debug.log`, `web/node_modules/…`, `agents/.venv/…`, `engine/.claude/worktrees/…`, `chain/artifacts/…`, `web/dist/…`.
  - Ignore edilmiyor (beklenen ters durum): `.env.example`, `web/.env.example` (`!.env.example` kuralı).
  - Ignore edilmiyor (sertleştirme önerisi, MINOR-1): `agents/orders.sqlite3`, `agents/state.json` (runtime dışında), `.envrc`, `secrets.json`, `env.backup`.
- Bütün worktree'lerde izlenmeyen ve ignore edilmeyen dosya: sadece `Agentic Hack-wt/web/.claude/launch.json` (MINOR-3).
- Geçmişte bir gitlink: `engine/.claude/worktrees/rol-engine-devam-84aed9` (mode 160000, `2af5190`'da eklendi, `495022b`'de silindi). Gitlink sadece commit SHA'sı tutar, dosya içeriği taşımaz → sızıntı yok.
- Büyük/ikili dosyalar: >300 KB blob sadece `agents/uv.lock` (0.6 MB, metin). İzlenen ikili dosyalar: `docs/pitch/GRAIL-pitch.pptx` (293 KB, tarandı) ve `web/docs/screenshots/v2-*.jpg` (6 adet, 41–60 KB, UI demo görüntüleri; örneklenen ayarlar ekranında sır yok). Yanlışlıkla eklenmiş ikili dosya yok.

## Kodda sır yazımı
- agents: zincir istisnaları `safe_chain` ile sadece tip adına indiriliyor; ATK hata çıktısı ham stdout/stderr içermiyor; ortamdaki OKX değişkenleri alt süreçten siliniyor; salt sadece reveal'den sonra state'e çıkıyor; runtime ignore'da (R-002/R-004 incelemeleri + bu tarama).
- analyst: `providers.py:31` anahtar sadece `x-goog-api-key` header'ında (URL'de değil); `__repr__` anahtarı gizliyor (`:19-20`); `review.py:129` istisna mesajı loglanmıyor ve `llm_note`'a (zincire) girmiyor.
- chain scripts: Hardhat `accounts: []`; deploy sadece adres/bakiye basıyor; hata çıktısı `shortMessage` (R-003).
- web: `vite.config.ts:14` `GRAIL_*` değişkenlerini sadece Node tarafındaki dev/preview middleware'de dosya yolu olarak kullanıyor; istemciye `define`/`VITE_*` aktarımı yok; `web/src` içinde `import.meta.env`/`process.env` kullanımı yok. İstemci sadece `/api/state`, `/api/chain`, public Fuji RPC ve Routescan çağırıyor.

## Bulgular
Hiçbiri public'i engellemiyor. Public'ten önce geçmiş yeniden yazımı ya da anahtar iptali **gerekmez** (gerçek hiçbir sır geçmişte yok).

- **MINOR-1 · `.gitignore` sertleştirmesi.** Yer: `.gitignore`. Tetikleme: biri `--runtime .` gibi runtime dışı bir yol kullanır ya da `.envrc`/`secrets.json` oluşturursa bunlar `git add .` ile girebilir. Öneri: `*.sqlite3`, `**/state.json` (fixtures istisnalı), `fuji-*.json`, `live-config*.json`, `.envrc`, `*secret*`, `*.pem`, `*.key` ekle. Sahip: integrator.
- **MINOR-2 · Kişisel bilgi: commit kimliği (bilgi notu).** 100 commit'in hepsinin yazarı/committer'ı kişisel bir Gmail adresi. Public olunca GitHub'da görünür. Değiştirmek history rewrite ister; kullanıcı kararı. Gerekirse ileriki commit'lerde GitHub noreply adresi. Sahip: kullanıcı.
- **MINOR-3 · Kişisel bilgi: yerel kullanıcı yolu.** `C:/Users/<ad>/Desktop/...` yolu (Windows kullanıcı adı = kişinin adı) şu dosyalarda geçiyor: `agents/ACCEPTANCE-T-006.md`, `agents/FUJI-GATE-T-006.json`, `agents/README.md`, `chain/README.md`, `coord/handoffs/agents.md`, `coord/handoffs/engine.md`, `coord/reviews/T-006.md`, `coord/tasks/T-003.md`. Sır değil. İstenirse göreli yola çevrilir (sahipler: agents, chain, engine, integrator, reviewer). Ayrıca `web/.claude/launch.json` web worktree'sinde izlenmiyor ve ignore edilmiyor; yanlışlıkla eklenmemeli (sahip: web; ya da integrator `.claude/` yerel dosyalarını ignore'a ekler).
- **MINOR-4 · Yerel `claude/*` branch'leri.** Sadece yerelde varlar; tarandılar, sır yok. Public'ten önce push edilmemeli ya da silinmeli. Sahip: kullanıcı/integrator.

## Kontroller (gerçek çıktı özeti)
- `git rev-list --all --count` → 100; `git ls-remote origin` → 8 ref, hepsi yerelde tarandı.
- Desen tarayıcısı → 535 blob, 233 yol; mnemonic kelimesi 2 (görev metni); diğer bütün sır sınıfları 0; 64-hex 1872 (1817 lockfile + 55 sınıflandırıldı).
- Birebir karşılaştırma → 537 blob; `AGENT_PRIVATE_KEY` 0, `LLM_API_KEY` 0, OKX `api_key`/`secret_key`/`passphrase` 0/0/0.
- `git check-ignore -v --no-index` → 19 sentetik yol ignore ediliyor; 2 `.env.example` beklendiği gibi açık; 5 sertleştirme yolu açık (MINOR-1).
- Tarihteki riskli dosya adları → sadece `.env.example`, `web/.env.example`, `web/fixtures/demo-state.json` ve silinmiş gitlink.

## Çalıştırılamayanlar / sınırlar
- gitleaks/trufflehog çalıştırılmadı (kurulu değil; indirme izni istenmedi). Yerine yukarıdaki iki yerel tarama kullanıldı.
- JPG ekran görüntülerinde OCR yapılmadı. Bir tanesi gözle kontrol edildi (demo verisi, sır yok).
- GitHub sunucu tarafı (silinmiş ref, önbellek) yerelden doğrulanamaz.
- GO bu SHA kümesi için geçerli. Public yapılmadan önce yeni commit gelirse, §1–§2 o SHA'lar için tekrar çalıştırılmalı.

SONUÇ: **PUBLIC GO** (origin/main@9acec55 + listelenen bütün uzak branch'ler; BLOCKER yok; MINOR-1..4 tavsiye).
