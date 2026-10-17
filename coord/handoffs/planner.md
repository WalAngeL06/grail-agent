# Handoff — planner (Claude, ana klasörde planlama/danışma chat'i; ürün kodu yazmaz)

- Güncelleme: 2026-10-17 ~13:00 · Önceki planlama chat'i bağlamı doldu; yenisi bu notla başlar.
- Kurulum TAMAM: git + 6 rol worktree'si, GitHub private repo (WalAngeL06/grail-agent), AGENTS.md, coord/, contracts 0.3,
  BRIEF (ürün kesin), SUBMISSION (form kontrol listesi), Fuji test cüzdanı `.env`'de (adres 0x0660f43f5307Ea7C5Dbb6685FEEB648eD9620fcf).
- OKX: `grail` profili (gerçek para, dry_run açık). Claude'daki tam yetkili OKX MCP kaldırıldı; sadece salt okunur market MCP var.
- Fuji gas: 13:05 1 test AVAX MetaMask'a (0x3b8b2…3C537) GELDİ. Kullanıcı ~0.9 AVAX'ı agent adresine aktaracak → bakiyeyi doğrula → chain rolüne "deploy et".
  Kullanıcı "gönderdim" derse: `eth_getBalance` ile https://api.avax-test.network/ext/bc/C/rpc üzerinden doğrula.
- Bundan sonra `main`'e SADECE integrator (Codex · hesap 1, ana klasör) yazar. Planner sadece danışır; değişiklik önerisini integrator'a RAPOR "istek" olarak verdirir.
- Kullanıcının bekleyen işleri: 4 AI'ı başlatmak (engine Claude Max ayrı proje grubunda `Agentic Hack-wt\engine`, "Çalışma ağacı" KAPALI),
  ikinci Codex hesabı için `CODEX_HOME=%USERPROFILE%\.codex-hesap2` + `codex login`, AVAX transferi, (ops.) LLM_API_KEY.
- Hafıza: `~/.claude/projects/.../memory/` (geçmiş hackathon dersleri, etkinlik bilgileri, teslim formu linki).
- SIRADAKİ İLK ADIM: kullanıcının durumunu sor; gelen RAPOR'ları STATE'e göre değerlendir; saat kapılarını (13:30 Fuji, 14:00 engine/ATK, 15:00 uçtan uca + UI) takip et.
