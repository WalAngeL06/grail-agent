# Handoff — docs (sadece bu rol yazar)

- Güncelleme zamanı: 17.10 17:58 (UTC+3)
- Aktif görev / durum: 3 dakikalık final (5 slayt) + runbook + FAQ soru-cevap + TUTORIAL + motto / READY_FOR_REVIEW
- Oturum: Claude Code · Max (Opus 5.5), durdu
- Worktree / branch / son commit: `Agentic Hack-wt/docs` / `role/docs` / bu handoff'u içeren commit; origin/main merge edildi (e0744bb)
- contracts okunan sürüm: v0.6.1
- Tamamlanan:
  - `docs/pitch/GRAIL-pitch-3min.pptx` (+ `build-deck-3min.cjs`): 5 slayt (0:00–0:30 kanca · 0:30–1:00 sorun · 1:00–1:45 nasıl · 1:45–2:40 canlı kanıt · 2:40–3:00 kapanış),
    notlar Türkçe, saniye aralıklı, slayt başına 2 cümle. Motto slayt 1 ve 5'te. validate PASSED, 5 slayt render temiz.
  - 11 slaytlık yedek (`GRAIL-pitch.pptx`): motto (slayt 1 + 11), `t017: true`, replay T-017 sayıları (+%1,6 / %4,5 / 382 → 295), audit 80.
  - `docs/live-demo-runbook.md`: 3:00 akış (Türkçe menü adları), audit'i sunumdan ~5 dk önce başlat, B planı, 6 ekran görüntüsü.
  - `docs/jury-faq.md`: en üstte "2 dakikalık soru-cevap" 6 soru × tek cümle (Grinold/IC dahil); alt bölüm sayıları 80/80, T-017 açık.
  - `docs/TUTORIAL.md`: Guide.tsx (origin/main) metni birebir, önce TR sonra EN, 6 adım + "3 dakikada dene".
  - README-draft: başlık "GRAIL: Proof before profit.", T-017 maddesi (çözüm #3), audit 80/80 (agent çalışırken güvenli), sonuç tablosu T-017 (+1.6% / 4.5% / 295),
    Grinold paragrafı, sınırlar (IC ≈ 0). Form: motto + tek cümle başında motto, Avalanche cevabında 80/80.
- Kaynaklar: role/engine@aa77641 (grinold-30d.md, replay.json T-017: 1.63 / 4.54 / 149+146=295 / kill 0), engine README T-017 kuralı (z ≤ −1.5, kol ≤ %25, limitler aynı),
  web/src/screens/Guide.tsx + App.tsx + VerifySheet.tsx (origin/main), chain faf65cb audit 80/80 (kullanıcı bildirimi).
- Bağımlılık: grinold-30d.md ve T-017 replay.json role/engine'de; README/FAQ onlara atıf yapıyor → main'e girmeli. Chain testleri artık 54 olabilir (README 48 yazıyor) — integrator teyit etsin.
- Kalan yer tutucular: `<PAGES_URL>`, `<VIDEO_URL>`, `<SLIDES_URL>`, Team `<TBD>`.
- Çalıştırılmayan: audit'i kendim koşmadım (80/80 bildirim); siteyi açıp Try to cheat akışını tıklamadım.
- SIRADAKİ İLK ADIM: linkler + takım gelince doldur; final öncesi audit sayısını güncelle (3min deck V.audit, README, form, FAQ, runbook).
