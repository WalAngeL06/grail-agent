# GRAIL — 3 dakikalık final sunumu runbook'u (+ 2 dk soru-cevap)

Sunucu için, Türkçe. Deck: `docs/pitch/GRAIL-pitch-3min.pptx` (5 slayt; 11 slaytlık `GRAIL-pitch.pptx` yedek).
Site Türkçe; menü: **Panel · Kararlar · Zincir Kaydı · Güvenlik limitleri · Rehber · Nasıl çalışır**.
Düğme adları İngilizce: **"Verify yourself"** (kendin doğrula), **"Try to cheat"** (hile yapmayı dene).
Motto: **"GRAIL — Proof before profit."** · "Önce kanıt, sonra kâr."
Demo sırasında yeni canlı emir ya da runner başlatılmaz; mevcut kanıt gösterilir.

## T-10 dk · Hazırlık
- [ ] **Terminal A (audit):** `cd chain && npm run audit` → **sunumdan ~5 dk önce başlat**. 80 döngüde ~1–2 dk sürüyor, agent çalışırken de güvenli. Bitince özet satırını (`Total … | MATCH … | Mismatch 0`) ekranda bırak, fontu büyüt (≥ 20 pt).
- [ ] **Tarayıcı sekme 1:** site (canlı demo `<PAGES_URL>` ya da yerel `npm run dev`) → **Kararlar** açık, check-in #2 kartı (BTC 2 USDT, FILLED, OKX `4017748393474314240`) görünür. Üstte MOCK DATA rozeti yok.
- [ ] **Tarayıcı sekme 2:** Snowtrace GrailLedger `#code` (yedek kanıt): https://testnet.snowtrace.io/address/0x1B5fcf6DeFf2F9375338A2C35932224522118851#code
- [ ] **Deck:** 3 dakikalık sürüm sunum modunda, slayt 1'de. Konuşmacı notları açık.
- [ ] **B planı hazır:** yedek video `<VIDEO_URL>` ve `docs/demo-backup/` ekran görüntüleri (Verify yeşil, Try to cheat kırmızı, audit özeti).
- [ ] Zoom 110%, bildirimler kapalı; `.env`, cüzdan ve OKX pencereleri ekranda değil.

## Akış (3:00)
| Saniye | Ekran | Yap | Söyle (en fazla 2 cümle) |
|---|---|---|---|
| 0:00–0:30 | Slayt 1 (kanca) | — | "5 coin aldınız ama birlikte hareket ettikleri için aslında 1,4 bağımsız bahis tutuyorsunuz. GRAIL bunu ölçen ve her kararını işlemden önce mühürleyen bir ajan: Proof before profit, önce kanıt sonra kâr." |
| 0:30–1:00 | Slayt 2 (sorun) | — | "Parasını bir AI ajanına emanet eden biri bugün sadece iddia görüyor: seçilmiş testler, düzenlenebilir ekran görüntüleri. Ajanın sicilini kimse bağımsız doğrulayamıyor." |
| 1:00–1:45 | Slayt 3 (nasıl) | — | "Ajan her 90 saniyede kararı önce Avalanche'a mühürlüyor, sonra OKX'te emri veriyor, sonra açıyor; trendde momentum, yatayda ortalamaya dönüş seçiyor. Limitler kodda: sadece spot, kaldıraç ve para çekme yok, gerçek moda geçişi insan açıyor." |
| 1:45–2:00 | Site → **Kararlar** | check-in #2 kartında **Verify yourself**'e bas → "computing…" → yeşil | "Bu, bugün 15:37'deki ilk gerçek emrimiz; tarayıcı parmak izini kendisi hesaplayıp Avalanche'taki mühürle karşılaştırdı: yeşil." |
| 2:00–2:15 | Aynı panel | **Try to cheat** → "Bir sayıyı değiştir" → kırmızı | "Tek bir sayıyı değiştirince mühür tutmuyor: kırmızı. Sonradan düzeltme mümkün değil." |
| 2:15–2:25 | Site → **Zincir Kaydı** | Açılmamış zarf sayısı: 0 | "Her mühür açılmış; açılmamış zarf olsaydı burada herkes görürdü." |
| 2:25–2:40 | Terminal A | Biten `npm run audit` özet satırını göster | "Bütün sicili terminalden de denetledik: 80 döngünün 80'i eşleşiyor, sıfır uyuşmazlık." |
| 2:40–3:00 | Slayt 5 (kapanış) | — | "GRAIL kârı vaat etmiyor, kanıtı veriyor. Proof before profit: bize güvenmeyin, doğrulayın." |

Notlar:
- Slayt 4 (canlı kanıt) siteye geçmeden önce 2–3 saniye gösterilir; site çalışmazsa onun yerine konuşulur.
- Zaman daralırsa Zincir Kaydı adımını (2:15–2:25) atla.
- Jüri getiriyi ya da isabeti sorarsa: `docs/jury-faq.md` → "2 dakikalık soru-cevap".

## B planı · bir şey bozulursa
| Belirti | Hemen yap | Söyle |
|---|---|---|
| Site açılmıyor / beyaz ekran | Slayt 4'ü göster, ardından yedek videonun Verify anını (`<VIDEO_URL>`) | "Aynı kontrolün bugünkü kaydını gösteriyorum." |
| Üstte MOCK DATA | Düzeltmeye uğraşma; ekran görüntülerine geç (Verify yeşil / Try to cheat kırmızı) | — |
| Verify'da zincir okunamadı ("could not read" / gri) | Yeşil iddia etme; Snowtrace sekmesine geç | "Herkese açık RPC şu an yoğun; aynı mühür Snowtrace'te." |
| `npm run audit` bitmedi / `INCOMPLETE` / 429 | `npm run verify:cycle:1` (birkaç saniye) ya da ekran görüntüsündeki audit özeti | "Tek döngüyü gösteriyorum, kontrol aynı." |
| Wi-Fi yok | Tamamen slayt 4 + video + ekran görüntüleri | — |

**Önceden alınacak ekran görüntüleri** → `docs/demo-backup/` (kullanıcı alır; sır içermediğini kontrol et):
1. Kararlar, check-in #2 kartı (FILLED + OKX id)
2. Verify yourself → yeşil sonuç
3. Try to cheat → kırmızı sonuç
4. Zincir Kaydı (açılmamış 0)
5. Terminal: `npm run audit` özet satırı
6. Snowtrace GrailLedger `#code` "verified"

## Demo sonrası
- Runner/emir yok; açık kalan bir şey olmamalı. `runtime/live` klasörüne dokunma (journal ve pending korunur).
