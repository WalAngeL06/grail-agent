# Handoff — docs (sadece bu rol yazar)

- Güncelleme zamanı: 17.10 16:35
- Aktif görev / durum: T-016 (jüri FAQ + canlı demo runbook) / READY_FOR_REVIEW — kart integrator'da
- Oturum: Claude Code · Max (Opus 5.5), durdu
- Worktree / branch / son commit: `Agentic Hack-wt/docs` / `role/docs` / bu handoff'u içeren commit; origin/main merge edildi (a050a9a)
- contracts okunan sürüm: v0.6
- Tamamlanan:
  - `docs/jury-faq.md` (EN): 12 soru + kalın tek cümle cevap + yedek maddeler + "Don't say" listesi. Dürüst sınırlar açık:
    reveal etmemenin cezası yok; ledger dışı işlem kanıtlanamaz (OKX id ile uzlaştırma otomatik değil); getiri al-tuttan düşük;
    canlı emirde analist `skipped: no_provider`; Reputation/Validation registry'lerine yazılmıyor; ablation yok; cycle id ardışıklığı zincirde zorlanmıyor.
  - `docs/live-demo-runbook.md` (TR talimat + EN konuşma): T-30 kontrol listesi, 3:00 akış (Dashboard → Ledger → Decisions cycle 2 → Verify → Snowtrace → terminal → Settings),
    B planı tablosu, R-006'da gerçekten alınmış verify:cycle:1 çıktısı, 8 yedek ekran görüntüsü listesi.
- Kaynaklar: STATE r26, D-013/015/016, reviews T-003/T-006/T-010, GrailLedger.sol (AlreadyCommitted/HashMismatch/commitCount), agents README,
  agents runtime/live/state.json (salt okunur: llm_flag skipped, errors 0), engine/out/replay.json; UI etiketleri web/src ile eşlendi.
- Çalıştırılmayan: cycle 2 verify-cycle komutu (runbook'ta "provada dene" notu var); web'i gerçek state ile açıp tıklamadım.
- Kalan <TBD>: yedek video linki. `docs/demo-backup/` ekran görüntülerini kullanıcı alır.
- SIRADAKİ İLK ADIM: video/slides linki gelince deck + runbook + submission'ı doldur; demo-script'i cycle 2'ye göre güncelle.
