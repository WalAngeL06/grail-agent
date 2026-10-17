# Handoff — web (sadece bu rol yazar)

- Güncelleme zamanı: 2026-10-17 ~18:40
- Aktif görev / durum: TR arayüz + motto + Rehber (main ab6e2d5) → T-017 OU çipi + public snapshot 18:09 / READY_FOR_REVIEW
- Oturum: Claude Code · Max (Opus 5.5) "GRAIL web - 2", durdu
- Worktree / branch / son commit: `Agentic Hack-wt/web` / `role/web` / bu dosyayı içeren son commit (`git log -1`); origin/main (81356a1) merge edildi
- contracts okunan sürüm: v0.6.2

- Bu tur (TR dil desteği):
  - `web/src/i18n.ts`: `T(en, tr)` satır içi çift, `P()` çoğul, `tx()` sözlük (verifyLogic/chain.ts'in İngilizce sebep cümleleri → TR; bilinmeyen metin olduğu gibi).
    Dil `localStorage["grail.lang"]` (try/catch), varsayılan **tr**, `<html lang>` güncellenir. App kökü `key={lang}` ile yeniden çizilir (açık Verify paneli kapanır, veri akışı korunur).
  - Üst barda EN | TR düğmesi (`.lang`, v2.css); ≤760 px'te üst barın ilk öğesi (kaydırınca kaybolmaz).
  - `format.ts` TR modunda: tr-TR sayı (ondalık virgül, nokta binlik), yüzde önde (%5, +%1,8), `price()` kesir ayırıcı virgül, `ago()` "sn/dk/sa/gün önce", pencere "son 48 saat", tarih tr-TR. EN modunda eski çıktı birebir.
  - Çevrilen: menü, ekran başlıkları, canlı özetler, Term açıklamaları ve ipuçları, boş/bekleme/hata şeritleri, intro, How it works 6 kart + replay + sözlük, Verify satırları ve sonuçları ("Eşleşti — bize güvenmek zorunda değilsin", "Uyuşmadı", "Avalanche'a ulaşılamadı"), Settings/limitler/kurallar, grafik etiketleri.
  - İngilizce kalan: terim/yöntem adları (n_eff, Hurst, HRP, PSR, Sharpe, commit/reveal, hash, keccak256, salt, dry run, kill switch, ERC-8004, breakout, retest), marka adları, BUY/SELL/HOLD (+ "Buy/Sell/Hold" çipleri), PRACTICE MODE/LIVE/OPEN rozetleri, "Verify yourself" (TR'de title "kendin doğrula").
  - Engine `reason` metni çevrilmez (hash'e dahil); TR'de her check-in kartında bir kez "Gerekçeler engine'in mühürlü orijinal metnidir…" notu.
  - `verifyLogic.ts`, `verify.ts`, `chain.ts` DEĞİŞMEDİ (çeviri yalnız görüntüde `tx()` ile).
- Kontroller: `npm test` 22/22; `npm run build` + `npm run build:public` geçti; `--mode real` (cycle #70–72) tarayıcıda TR/EN 5 ekran;
  Verify #70 TR → Eşleşti, "Bir sayıyı değiştir" → Uyuşmadı + 4 TR sebep; 375 px'te 5 ekranda yatay taşma yok (scrollWidth 375), dil düğmesi x=12.
  Görüntüler: `web/docs/screenshots/v4-tr-{dashboard,decisions,ledger,verify,how,mobile-dashboard}.jpg`, `v4-en-{dashboard,decisions,ledger,verify,how}.jpg`.
- Ek iş (planner, jüri önerisi):
  - Motto: `<title>` "GRAIL — Proof before profit"; sidebar logosunun altında "Proof before profit." (+ TR'de "Önce kanıt, sonra kâr."), ≤760 px'te gizli;
    Panel başlığının üstünde ince satır "GRAIL — Proof before profit." (+ TR alt cümle).
  - Rehber / Tutorial sayfası `web/src/screens/Guide.tsx`, route `#/guide`, menüde How it works'ün üstünde (TR "Rehber", EN "Tutorial"); 6 adım kartı + "3 dakikada dene" kutusu;
    intro şeridinde "Rehber" düğmesi How it works'ün yanında. TR metinde ekran adları menüdeki TR adlarla (Panel/Kararlar/Zincir Kaydı/Güvenlik limitleri) ve akış şeridi TR etiketleriyle eşitlendi.
    Verify'da "Try to cheat" başlığı TR'de "Try to cheat · hile yapmayı dene" (Rehber bu adı kullanıyor). docs/TUTORIAL.md gelince metin farkı eşitlenecek.
  - Kontrol: npm test 22/22, build + build:public geçti; 375 px'te guide/dashboard/decisions scrollWidth 375, alt menü 6 öğe sığıyor (en uzun "Kararlar" 42/63 px).
    Görüntüler: v4-tr-tutorial.jpg, v4-tr-tutorial-try.jpg, v4-tr-tutorial-mobile.jpg, v4-en-tutorial.jpg, v4-tr-dashboard-motto.jpg.
- Son iş (planner, 18:13):
  - T-017 (v0.6.2): `state.ts` `signals[inst].ou` = {half_life_h, z, significant, sleeve} ayrıştırılır (sleeve enum dışıysa yok sayılır); Kararlar'da çip:
    mean_reversion → "Ortalamaya dönüş · z −1,7 · yarı ömür 5 sa" / "Mean reversion · z −1.7 · half-life 5h"; momentum → "Momentum"; none/alan yok → çip yok.
    Nasıl çalışır "Smart entry" kartına OU cümlesi (TR/EN). Rehber değişmedi. Test state'iyle (scratch, mean_reversion örneği) ve gerçek state'te (cycle #90) doğrulandı.
  - Public snapshot tazelendi: 18:10'da `npm run snapshot` → state 18:09:25, check-in #93'e kadar 455 karar, 0 açılmamış salt, `ou` dahil; sır kelimesi/yerel yol taraması 0.
    `preview:public`: 6 ekran hata yok (TR varsayılan), üst bar "Kopya: 17 Eki 18:09 · zincir kontrolü canlı", Verify #2 (LIVE, zincirden) → Eşleşti + "OKX emir 4017748393474314240";
    ağ: yalnız Fuji RPC + Routescan (yerel /api yok).
- Pages hazırlığı (18:40): main merge; snapshot 18:33:49 (check-in #108'e kadar 500 karar, 0 açılmamış salt, tarama 0); `chain.ts readLedgerHistory`
  Routescan getLogs'u sayfalıyor (page/offset 1000) — önce 100 kayıtta kesiliyordu ("kontrat 108, event 100" uyarısı). preview:public: Panel #108, Zincir Kaydı 108/108 uyarısız,
  Verify #2 Eşleşti + OKX emir 4017748393474314240. README'de 3 adımlı Pages talimatı. gh-pages'e push YAPILMADI (integrator).
- "bahis" kaldırıldı (kullanıcı isteği, 18:40): TR'de "Bağımsız varlık", "etkin varlık sayısı (n_eff)", "X bağımsız varlık", "tek varlık gibi", Holy Grail "etkin varlık".
  EN "independent bets" değişmedi. `grep -rni bahis web/src` boş; build:public yeniden alındı (snapshot 18:33 aynı).
- Bilinen / küçük: masaüstünde (1280 px) üst bar hem TR hem EN'de iki satıra sarıyor (dil düğmesi 2. satırda) — önceden de flex-wrap tasarımı; taşma yok.
  Pozisyon tablosu "Miktar" (size_base) agent'ın ham string'i, biçimlenmiyor.
- Devam eden süreçler / portlar: önizleme 5175 (`grail-web-real`) açık olabilir; kapatmak serbest.
- Dış eylemler: yok.
- TEKRARLANMAMASI gereken işlem: vite.config'te `new URL(...).pathname` (boşluklu yol → 404) — `fileURLToPath` kullan.
- SIRADAKİ İLK ADIM: integrator merge'ünden sonra 18:25 `npm run build:public` (varsayılan dil TR; ziyaretçi EN'e geçebilir). Yeni metin eklenirse `T("en", "tr")` ile ekle; terimleri çevirme.
