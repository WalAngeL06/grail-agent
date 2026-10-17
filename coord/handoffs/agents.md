# Handoff — agents

- Güncelleme: 2026-10-17 13:47 Europe/Istanbul; Codex · hesap 1, oturum sürüyor.
- Aktif görev: T-002 / IN_PROGRESS; yalnız agents/ + bu handoff yazılır.
- Worktree/branch: Agentic Hack-wt/agents / role/agents; main e06987b ile senkron. Son teslim commit'i: bu handoff'u içeren commit (git log -1).
- contracts: v0.4; kartta v0.3 yazıyor; güncel örnekler v0.4 (48 lookback).
- Tamamlanan: Python ATK sorgu izin listesi, sabit grail/TR/live + TR API host; state dönüşümleri; spot guardrail, lot/minimum/tick; dry-run simülasyon; kalıcı SQLite client-ID journal (gönderimden önce commit); belirsiz emir kimliğiyle sorgulanır, tekrar gönderilmez.
- Kontrol: cd agents; uv run pytest -q --tb=short → 66 passed (0.17s). Yeni testler önce eksik modüller ve base_url override nedeniyle kırıldı. BTC-USDT public ticker başarıyla okundu; gerçek emir/tx yok.
- Yetki: kullanıcı bu chat'te CLI 1.4.8'de olmayan --read-only yerine sorgu izin listesini AÇIKÇA onayladı. Canlı emir yok.
- Eski handoff'taki OKX_DEMO=1 GEÇERSİZ; T-002 + D-007: gerçek grail profili ve dry_run=true. .env okunmadı/değişmedi; anahtar config içinde, loglanmadı.
- Commit edilmemişler: bu commit sonrası yok (git status ile doğrula). Süreç/port: yok.
- Açık konu: Task 3 salt okunur smoke + son sınır/sağlamlık incelemesi. CLI env ve TOML host override'ı sabit TR host ile kapatıldı.
- Çalıştırılmayan: canlı bakiye, tüm coin/mum sorguları ve dry-run smoke (Task 3); canlı emir kullanıcı onayı/config değişimi olmadan ASLA çalıştırılmaz.
- TEKRARLAMA: --read-only bayrağını deneme; OAuth/login/upgrade/transfer/emir komutu çalıştırma. Global siteye geçme.
- SIRADAKİ İLK ADIM: agents/PLAN-T-002.md Task 3: dry-run zorunlu smoke CLI + README; gerçek bakiye/tüm coin/mum sorguları ve simüle emri doğrula, test/sınır kontrolü, handoff + commit + push.
