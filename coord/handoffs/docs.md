# Handoff — docs (sadece bu rol yazar)

- Güncelleme zamanı: 17.10 15:20
- Aktif görev / durum: T-011 (sunum .pptx) / READY_FOR_REVIEW — kart main'de henüz yok; kullanıcı talimatıyla yapıldı
- Oturum: Claude Code · Max (Opus 5.5), durdu
- Worktree / branch / son commit: `Agentic Hack-wt/docs` / `role/docs` / bu handoff'u içeren commit (`git log -1`); origin/main@4f03d02 merge edildi
- contracts okunan sürüm: v0.6
- Tamamlanan somut davranış:
  - `docs/pitch/GRAIL-pitch.pptx`: 10 slayt, 16:9, koyu tema (ui-brief paleti), her slaytta konuşmacı notu (EN).
    Sade dil: sealed envelope = commit-reveal, independent bets = n_eff, fingerprint = hash, practice mode = dry_run, emergency stop = kill switch.
  - `docs/pitch/build-deck.cjs`: deck üreticisi; gerçek değerler dosyanın başındaki `V` nesnesinde.
- Kullanılan gerçek değerler (kaynak): agentId 1, GrailLedger 0x1B5fcf6DeFf2F9375338A2C35932224522118851 (STATE r14 + chain.json);
  limitler $10 / $50 / %5 ve döngü 90 sn (config.example.json v0.6); testler 84 / 78 / 25 (STATE r14, 14:43).
  `<TBD>`: canlı independent bets (3 yer), togetherness (ρ̄), bugünkü döngü sayısı, yedek video linki.
- Çalıştırılan kontroller: pptx skill `validate.py` → All validations PASSED; PowerPoint COM ile 10 slayt PNG'ye çevrilip görsel kontrol
  (taşma/çakışma düzeltildi); 10/10 slaytta not var.
- Yeniden üretme: `npm i pptxgenjs@3.12.0` (herhangi bir klasörde) → `NODE_PATH=<o klasör>/node_modules node docs/pitch/build-deck.cjs`.
- Commit edilmemiş / izlenmeyen dosyalar: yok · Devam eden süreçler: yok · Dış eylemler: yok
- SIRADAKİ İLK ADIM: canlı state gelince `build-deck.cjs` içindeki `V.liveBets`, `V.liveCorr`, `V.cyclesToday`, `V.backupVideo` doldur, testler değiştiyse
  sayıları güncelle → yeniden üret → commit. Kullanıcı .pptx'i Google Drive'a yükleyip Slides linkini SUBMISSION'a verir.
