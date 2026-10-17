# Handoff — agents

- Güncelleme: 2026-10-17 14:27 Europe/Istanbul; Codex · hesap 1, bu faz teslim edildi, süreç yok.
- Görev/durum: T-006 / READY_FOR_REVIEW (sahte zincir fazı). Worktree Agentic Hack-wt/agents, branch role/agents; son commit bu handoff'u içeren commit (git log -1), push zorunlu.
- contracts v0.5; origin/main 76e0724 merge 9c67988. chain.json bu worktree'de yok; gerçek Fuji adaptörü/tx kapısı henüz tamamlanmadı.
- Push'lanmış adımlar: ef5aecd R-002-1/R-002-2; 16fe909 kanonik payload/Keccak + kalıcı storage/chain Protocol; 2a521d0 kurtarılabilir engine→analyst→commit→execute→reveal döngüsü. Bu commit CLI/son test/belgeleri ekler.
- R-002-1: iyi biçimli nonzero sCode + boş ordId terminal rejected/rejection_code; ret journal'ı kilitlemez. Metin hata/timeout/bozuk yanıt unknown. R-002-2: yeni canlı execute öncesi unknown/pending/partial otomatik sorgulanır. R-002-3/4 bu fazda kapsam dışı; R-002-5 placement null koruması eklenmişti.
- Review kaynağı: review worktree/coord/reviews/T-002.md (origin/role/review'da da mevcut, bu dosyaya yazılmadı).
- Davranış: final analist payload'ı + 32-byte salt fsync/atomik pending'e yazılır, sonra confirmed commit, sonra guardrail/simülasyon, sonra aynı bytes/salt reveal. HOLD da commit edilir. Payload karar alanları değişmez; execution_size_* ayrı.
- Kurtarma: zincirde cycle lookup; aynı cycle recommit/emir/analist yok. Eksik/unknown/pending live kimliği aynı client ID ile sorgulanır; reveal kayıtlı bytes/salt ile. Gerçek subprocess os._exit(23) ile commit sonrası öldürülüp yeni adaptörle başarıyla kurtarıldı (sahte ledger).
- Kalıcılık: control.json cycle/peak, pending/*.json, orders.sqlite3 (gelecek live), simulated-chain.json; tek runner kilidi döngüler arasında da tutulur, crash'te OS bırakır. State reveal sonrası payload/salt yayınlar; 500 karar/100 hata sınırı var. Bozuk pending süreci çökertmez, yeni etkiyi durdurur.
- Kontrol: cd agents; uv run pytest -q --tb=short → 121 passed, 1 skipped (3.38s); uv run pytest -q ../engine/tests ../analyst/tests --tb=short → 84 passed (1.13s). Skip: chain.json testVector yok. CLI --help exit 0. git diff --check geçti.
- Gerçek ATK okuma smoke: uv run python -m grail_agents run --config ../contracts/config.example.json --chain simulated --cycles 1 --runtime runtime/t006-smoke → exit 0, cycle=1, 1 simüle commit + 5 simulated BUY + 1 simüle reveal, errors=0. State v0.5/stopped; pending boş. Gerçek emir/tx YOK.
- State dosyası: agents/runtime/t006-smoke/state.json (ignored). Web GRAIL_STATE_PATH ile bu mutlak dosyaya bakabilir; web/ veya contracts/ yazılmadı.
- Belgeler/API: agents/README.md, agents/ACCEPTANCE-T-006.md, agents/PLAN-T-006.md. SimulatedChain kimlik/adres null, tx simulated:, verified=false. CLI dry_run=false reddeder; gerçek zincir seçeneği yok.
- Sırlar: .env kopyası/yazımı yok. İsteğe bağlı GRAIL_ENV'den sadece üç LLM ayarı çıkarılır; wallet key sağlayıcıya aktarılmaz. Kullanıcının sorgu izin listesi onayı geçerli, config dry_run=true.
- Açık not: bir test koşusunda STORAGE_WRITE görülüp tekil tekrar geçti; özgün neden kanıtlanmadı. Güvenli exception-type tanısı + tek 20ms PermissionError atomik dosya retry testi eklendi; son paketler ve smoke geçti. Ağ/tx/emir otomatik tekrarı YOK.
- Commit edilmemişler: bu commit/push sonrası yok; süreç/port yok. Gerçek bakiye/getiri değil, simülasyon ve kayıt doğrulandı.
- SIRADAKİ İLK ADIM: temiz dalda git fetch origin; git merge origin/main. chain.json gelmişse testVector doğrula, gerçek confirmed ChainAdapter'ı ABI/kimlik verisiyle yaz ve dry_run=true ile Fuji commit/reveal test et. Gelmediyse sahte-faz diff'ini bağımsız incelemeye ver; gerçek tx kapısını tamamlandı sayma. Başka rol alanına yazma, gerçek emir verme.
