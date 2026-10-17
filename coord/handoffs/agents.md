# Handoff — agents

- Güncelleme: 2026-10-17 13:46 Europe/Istanbul; Codex · hesap 1, teslim sonrası oturum durur.
- Aktif görev: T-002 / READY_FOR_REVIEW; yalnız agents/ + bu handoff yazılır.
- Worktree/branch: Agentic Hack-wt/agents / role/agents; main e06987b ile senkron. Son teslim commit'i: bu handoff'u içeren commit (git log -1).
- contracts: v0.4; kartta v0.3 yazıyor; güncel örnekler v0.4 (48 lookback).
- Tamamlanan: Python ATK sorgu izin listesi, sabit grail/TR/live + TR API host; state dönüşümleri; spot guardrail, lot/minimum/tick; dry-run simülasyon; kalıcı SQLite client-ID journal; belirsiz emir kimliğiyle sorgulanır, tekrar gönderilmez. Bakiye yenileme + rezerv atomik; dış açık emir canlı gönderimi engeller.
- Kontrol: cd agents; uv run pytest -q --tb=short → 78 passed (0.20s). Aynı klasörde uv run python -m grail_agents smoke --config ../contracts/config.example.json → exit 0, ok=true; beş coin aktif spot, her coin 49 kapalı mum, nakit 29.40294764 USDT, BTC BUY 2 USDT simulated / okx_order_id=null. Gerçek emir/tx yok.
- Yetki: kullanıcı bu chat'te CLI 1.4.8'de olmayan --read-only yerine sorgu izin listesini AÇIKÇA onayladı. Canlı emir yok.
- Eski handoff'taki OKX_DEMO=1 GEÇERSİZ; T-002 + D-007: gerçek grail profili ve dry_run=true. .env okunmadı/değişmedi; anahtar config içinde, loglanmadı.
- Commit edilmemişler: bu commit sonrası yok (git status ile doğrula). Süreç/port: yok.
- Açık konu: bağımsız Claude Pro incelemesi + integrator merge. Kartın --read-only koşulu kullanıcı onayıyla izin listesine uyarlanmalı; karttaki v0.3 yerine v0.4 okundu. TRY artığı USDT-TRY ters kuruyla, tradable=false sentetik TRY-USDT pozisyonunda değerlendi (eklemeli alanlar).
- Çalıştırılmayan: ilk canlı emir (dry_run hâlâ true, kullanıcı canlıyı açmadı/onaylamadı); engine/zincir döngüsü T-006 kapsamında. Canlı kod sadece sahte borsayla test edildi.
- TEKRARLAMA: --read-only bayrağını deneme; OAuth/login/upgrade/transfer/emir komutu çalıştırma. Global siteye geçme.
- Kanıt ve API: agents/ACCEPTANCE-T-002.md ve agents/README.md. Test geçici klasörü agents/runtime/pytest; ortak Windows temp ACL hatası nedeniyle worktree içinde tutuluyor.
- T-006'ya devir: tek kalıcı runtime/orders.sqlite3 journal, kalıcı peak_equity_usdt, başarılı Avalanche commit önkoşulu ve GrailError yakalama döngünün sorumluluğu. HOLD için emir çağrılmaz.
- SIRADAKİ İLK ADIM: integrator'a son RAPOR'u taşı; Claude Pro role/agents diff'ini incelesin ve cd agents; uv run pytest -q çalıştırsın. Merge sonrası T-006 için YENİ CHAT aç; T-002 chat'inde döngü entegrasyonuna başlama.
