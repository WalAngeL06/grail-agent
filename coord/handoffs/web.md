# Handoff — web (sadece bu rol yazar)

- Güncelleme zamanı: 2026-10-17 ~16:35
- Aktif görev / durum: UI-QA bulguları (planner "Orkestra Şefi - 2", Antigravity raporu, güncel kodla süzülmüş) / READY_FOR_REVIEW
- Oturum: Claude Code · Max (Opus 5.5), durdu
- Worktree / branch / son commit: `Agentic Hack-wt/web` / `role/web` / bu dosyayı içeren son commit (`git log -1`)
- contracts okunan sürüm: v0.6
- Bu tur:
  - P0: ≤600 px'te what-if slider tek sütun (input tam genişlik). Anchor: hash değişince + aynı linke tekrar tıklanınca `scrollToAnchor` (anlık kaydırma; smooth testte güvenilmezdi), `scroll-margin-top`.
  - P1: Verify'dan "(R-003-4)" kalktı; Settings dry_run → "OKX TR · prices & balance only, orders simulated"; ≤760 px üst bar tek satır yatay kaydırma, ikincil öğeler (`.tb-opt`, `.sep`) gizli (48 px);
    Holy Grail <520 px kart genişliğinde kompakt viewBox 400×280 + 13 px yazı (375 px'te ~9.8 px, önce 4.6), ilk ölçüm mount'ta senkron; Ledger ≤760 px kart düzeni + tam genişlik buton.
  - P2: tekil/çoğul (price/prices, hold/holds); buton adı her yerde "Verify yourself" (ui-copy); stepper "on-chain" + nowrap.
- Kontroller: build + build:public geçti; public preview 375 px: üst bar 48 px, slider 301 px, grafik yazısı 9.8 px, 5 ekranda yatay taşma yok, Ledger Verify butonu 37–338 px (görünür), stepper satırları 17 px (tek satır); anchor'lar positions top=72, system sayfa sonuna.
  Not: Claude tarayıcı panelindeki emülasyon görüntüleri sağdan kırpık çıkıyor (panel ölçekleme artefaktı; DOM ölçümleri temiz). Görüntüler web/docs/screenshots/v5-*.

- Önceki tur:
  1. "Last 30 days" başlığı replay.json oranından üretiliyor (`drawdownHeadline`): 7.48/14.51 → "Half the worst drop", T-014 sonrası 4.34/14.51 → "Less than a third of the worst drop". replay.json import edildiği için main'e T-014 girince sayılar kendiliğinden güncellenir (yeniden build).
     Verify'da "Fingerprint the agent reported" satırına ✓/✕ (zincirdeki mühürle, yoksa tarayıcı hash'iyle karşılaştırma).
  2. Public demo: `npm run build:public` → `web/dist-public/` (gitignore), base `/grail-agent/` (GRAIL_BASE ile değişir). State = `web/fixtures/public-snapshot.json`
     (`npm run snapshot -- <state.json>`; beyaz liste, reveal edilmemiş salt/payload silinir, sır kelimesi görürse yazmaz). chain.json import edilir.
     Ledger/Verify tarayıcıdan canlı Fuji okur. Üst barda "Snapshot of <saat> · live chain checks", geri sayımlar gizli. Yayın YAPILMADI; talimat web/README.md.
     Kontrol: `npm run preview:public` → 5 ekran hata yok, /api çağrısı 0, Ledger zincirden 22 mühür (3'ü "from chain"), Verify #2 (ilk canlı emir) ✅ + OKX order 4017748393474314240.
     Paket taraması: yerel yol / kullanıcı adı / api-key/secret/private kelimesi yok.
  3. T-014: main'de henüz yok; origin/role/engine@6e8abad kaynağıyla doğrulandı: metrics.signals[c] = {hurst (_clean, null olabilir), regime trending|unclear|ranging, setup none|breakout|retest},
     eşikler 0.45/0.55 tooltip ile aynı; kart/tooltip boyut kuralları (ranging → alım yok, breakout → bekle, none → yarım, retest → tam) engine ile aynı. Gerçek engine state çıktısıyla çalıştırılmadı.

- Bu turun somut davranışı:
  1. R-007 (origin/role/engine:coord/reviews/R-007-ui-math.md) — formül değişmedi, etiket/alan düzeltildi:
     PSR → "Chance the coin basket's recent trend is real" (+ "> 99%"/"< 1%"); Sharpe KPI → "Diversification boost (illustration)" ×√n_eff, SR₁ 0.5 "assumed, not measured";
     Positions hedefi = target_weights_pct (yoksa son karar target_weight_pct) × min(equity, max_total_deploy) ÷ equity; başlık "coin list offers", cap "(last 48h, equal weights)";
     Show the math payda 4 ondalık; emergency stop "pauses new orders… does not sell"; target vol "at most"; vol ipucu "target mix (est.)"; HRP ipucu trend filtresi; pencere etiketi config'ten; diyagram ≈1.5.
     Fixture: HRP trendi düşen coinlerde 0, gerekçeler engine'in İngilizce biçiminde (gerçek Fuji cycle 1 payload'ı değişmedi).
  2. docs/ui-copy.md ile eşitleme: eyebrow + başlık + canlı özet (Dashboard/Decisions/On-chain record/Settings), Togetherness, Check-in, Seal/Open, Random code, On-chain ID card, MOCK DATA, hata metinleri.
     ui-copy ile R-007 çelişen 2 yerde R-007 uygulandı: PSR ("Skill confidence… not luck" değil), emergency stop ("halts after a set loss" değil).
     How it works: ui-copy 5 kartı + "Last 30 days" kartı (engine/out/replay.json; GRAIL vs eşit ağırlıklı al-tut çizgi grafiği, "Half the worst drop 7.5% vs 14.5%", getiri +1.8% vs +8.8% dürüstçe).
  3. Gerçek dry-run state (agents/runtime/dryrun-5coin-20261017-1545/state.json, `npm --prefix web run dev -- --mode real` + web/.env.real [gitignore]):
     5 ekran hata yok, AI rozeti "approved"; Verify cycle #15 → computed = state = on-chain, reveal calldata'sından.
     Ledger artık GrailLedger event'lerinden (Routescan logs API, deploy bloğu 59595834) TÜM döngüleri okuyor; state'te olmayanlar "from chain" etiketiyle: canlı cycle #2 (LIVE, 1 buy) görünüyor,
     Verify ✅ ve OKX order 4017748393474314240 reveal'den gösteriliyor. Simüle emirler "Order" adımını tamamlıyor (önce "pending" görünüyordu).
  4. T-014 metrics.signals[inst] = {hurst, regime, setup}: yoksa hiçbir şey; varsa son check-in kartında coin başına sade çipler ("Trend is clear / Trend is unclear / Market is ranging",
     "Breakout confirmed by retest / Waiting for retest / No breakout yet", H değeri gri) + How it works'te "6 · Smart entry" kartı (yalnız sinyal varsa). Demo fixture'da örnek sinyaller.
- Kontroller: `npm run build` her adımda geçti; demo (5174), mock, real (5175) tarayıcıda; ekran görüntüleri web/docs/screenshots/v3-*.
- Bilinen: replay.json bundle'a import ediliyor (+~125 KB). Engine fixture'ı (T-014) gelince sinyal alan adlarını doğrula.

- v0.5 eklemeleri (bu tur):
  - Decisions: her satırda analist rozeti `AI approved|reduced|vetoed|exempt|skipped` (renkli; title = açıklama + llm_note) ve llm_note metni; bilinmeyen flag gri gösterilir.
  - Settings: "Spend limits" kartı (state.config.max_order_usdt, max_total_deploy_usdt, kill_switch_drawdown_pct; yoksa "—" + "not reported"), salt okunur; Config tablosunda tekrar edilmez.
  - Ledger: ERC-8004 kartı v0.5 alanı varsa her zaman görünür; agent_id null → "NOT REGISTERED", registry null → "not registered"; dolu ise #id + registry Snowtrace linki.
  - Demo fixture v0.5: review.py davranışı (BUY approved/reduced/vetoed, SELL exempt, BUY yoksa "skipped: no_buys", HOLD skipped); llm alanları payload'da ve hash'te; agent_id "7" (string).
- Tamamlanan somut davranış (brife göre):
  - Arayüz İngilizce. Sol menü: Dashboard · Decisions · On-chain Ledger · Settings; altta "Avalanche Fuji · OKX TR".
  - Üst bar (56 px, sabit): agent + durum noktası, DRY RUN/LIVE rozeti, MOCK DATA / DEMO DATA rozeti, Cycle #, "next in m:ss", zincir sayaçları c/r/u, hata rozeti (→ #/settings/system), "updated Xs ago".
  - Palet + Inter / JetBrains Mono brifteki token'larla (`src/styles.css` :root).
  - Dashboard: 64 px altın n_eff hero, son döngü çipleri, PSR ("— (needs history)"), 4 KPI kartı, Holy Grail (Y = portföy Sharpe, X = 1..20, referans ρ 0/0.2/0.4/0.8, canlı ρ̄ kalın altın, engine noktaları, tavan SR₁/√ρ, nabızlı "You are here", ρ slider 0–0.95 + what-if + reset), pozisyonlar (ağırlık vs HRP çift çubuk, last, 24h), ısı haritası (köşegen soluk), coin sinyalleri (metrics.trend_pct varsa).
  - Decisions: döngü kartları (yeni üstte), 5 adımlı akış göstergesi (Decided→Committed→Ordered→Revealed→Verified; commit yoksa kırmızı "commit failed → no order (fail-closed)"), satırlar (aksiyon çipi, gerekçe, ref → fill, SIMULATED/filled + OKX id), yeni satır 1,5 sn altın parlama, "Payload & proof" detay, döngü başına "Verify yourself".
  - Verify: 400 ms "computing…", sonra computed / stated / on-chain satırları + "✅ Match — you didn't have to trust us" / "❌ Mismatch"; mock → gri "Mock data — cannot verify"; reveal edilmemiş → "Not revealed yet"; demo verisinde zincir okunmaz (tx'ler uydurma); "Try tampering" textarea.
  - Ledger: 3 büyük sayaç (unrevealed amber + "no cherry-picking"), kontrat kartı (Avalanche logosu, Snowtrace), ERC-8004 kartı sadece agent_id varsa, sicil tablosu (OPEN, SIM/LIVE, "1 BUY · 4 HOLD", ✅/❌/—, satır içi Verify).
  - Settings salt okunur: mod rozeti + "Switching to live is a human action", config'te OLAN bütün anahtarlar (bilinenler etiketli, bilinmeyenler ham; olmayan limit gizli), guardrail listesi, System › Errors tablosu / "No errors".
  - Durumlar: iskelet + "connecting…", bayat veri (> 3 × cycle_seconds, sadece canlı kaynakta), okuma hatası şeridi (son iyi state kalır), boş karar "Waiting for first cycle — next in …", pozisyon yok "All cash — trend filter is risk-off".
- Commit edilmemiş / izlenmeyen dosyalar: worktree kökünde `.claude/launch.json` (sadece önizleme aracı için; web/ dışı, commit edilmez).
- Çalıştırılan kontroller (komut → sonuç):
  - (v0.5) `cd web && npm run build` → geçti; demo döngü #9 (llm alanlı payload) Verify ✅; mock: 4 ekran hata yok, kimlik "NOT REGISTERED", limitler $10/$50/5%; fixture payload'ları Python json.dumps(sort_keys, ensure_ascii) ile birebir.
  - `cd web && npm run build` → geçti.
  - `npm run dev:demo` (5174) → 4 ekran açıldı; döngü #11 Verify → ✅ Match, "all 5 decisions match the sealed payload".
  - `npm run dev` (mock, 5173) → 4 ekran açıldı, hata bandı yok, yatay taşma yok; mock Verify → "Mock data — cannot verify".
  - Mobil 375 px → menü/üst bar yatay kayar, içerik tek sütun.
  - Ekran görüntüleri: `web/docs/screenshots/` (1-dashboard, 2-decisions, 2b-verify-match, 3-ledger, 4-settings, mobile-decisions).
  - Önceki turdan: normalize() 7 bozuk girdi → hata fırlatmadı; GRAIL_STATE_PATH var → live, yok → mock + uyarı; Fuji RPC tarayıcıdan erişilebilir.
- Çalıştırılmayan kontroller ve nedeni: gerçek runtime/state.json yok (T-006); gerçek Fuji commit tx'iyle zincir kontrolü (T-003 chain.json bekleniyor).
- Devam eden süreçler / portlar: önizleme sunucuları 5173 (mock), 5174 (demo) açık olabilir; kapatmak serbest.
- Dış eylemler (emir id, tx hash) ve durumu: yok.
- Açık sorun / denenenler:
  - Engine `reason` metinleri Türkçe ("-> nakit", "hedef"); UI İngilizce. Engine'e istek: reason'ı İngilizce yaz (UI metni olduğu gibi gösterir).
  - Brifte istenen "on-chain 0x…" satırı ABI ile kontrattan okunmuyor; commit tx calldata'sında hash aranıyor (ABI'siz). chain.json gelince `chainHints()` + gerekirse ABI okuması eklenecek.
- TEKRARLANMAMASI gereken işlem: vite.config'te `new URL(...).pathname` (boşluklu yol → 404) — `fileURLToPath` kullan.
- SIRADAKİ İLK ADIM: `git merge origin/main` (T-014 + yeni replay.json gelince); `npm run build:public` yeniden; agents T-014'lü state yazınca sinyal çiplerini gerçek veride gör; canlı state için `GRAIL_STATE_PATH=.../runtime/live/state.json`; chain.json gelince src/verify.ts `chainHints()` anahtarlarını gerçek şekle göre düzelt; T-006 state yazınca `GRAIL_STATE_PATH="../../../Agentic Hack/runtime/state.json" npm run dev` ile gerçek veriden ekran görüntüsü al; Claude Design çıktısı gelirse farkları uygula.
