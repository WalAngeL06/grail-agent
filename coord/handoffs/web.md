# Handoff — web (sadece bu rol yazar)

- Güncelleme zamanı: 2026-10-17 ~17:35
- Aktif görev / durum: Türkçe dil desteği (planner "Orkestra Şefi - 2" görevi, kullanıcı onaylı) / READY_FOR_REVIEW
- Oturum: Claude Code · Max (Opus 5.5) "GRAIL web - 2", durdu
- Worktree / branch / son commit: `Agentic Hack-wt/web` / `role/web` / bu dosyayı içeren son commit (`git log -1`); origin/main (81356a1) merge edildi
- contracts okunan sürüm: v0.6.1

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
- Bilinen / küçük: masaüstünde (1280 px) üst bar hem TR hem EN'de iki satıra sarıyor (dil düğmesi 2. satırda) — önceden de flex-wrap tasarımı; taşma yok.
  Pozisyon tablosu "Miktar" (size_base) agent'ın ham string'i, biçimlenmiyor.
- Devam eden süreçler / portlar: önizleme 5175 (`grail-web-real`) açık olabilir; kapatmak serbest.
- Dış eylemler: yok.
- TEKRARLANMAMASI gereken işlem: vite.config'te `new URL(...).pathname` (boşluklu yol → 404) — `fileURLToPath` kullan.
- SIRADAKİ İLK ADIM: integrator merge'ünden sonra 18:25 `npm run build:public` (varsayılan dil TR; ziyaretçi EN'e geçebilir). Yeni metin eklenirse `T("en", "tr")` ile ekle; terimleri çevirme.
