# GRAIL — jüri SSS (12 zor soru + 1 ek, kısa ve dürüst cevaplar)

Sunucu için. Final sunum Türkçe. Önce **kalın cümleyi** söyle; alttakiler jüri üstelerse yedek.
Buradaki her sayının kaynağı repo: `coord/STATE.md` r31, `contracts/chain.json`, `engine/out/replay.json` (T-014 sonrası, role/engine@87539f8),
`chain/deployments/audit-latest.md` (`npm run audit`), Fuji `commitCount/revealCount(1)` ve agents canlı runtime state'i. Sayıyı yuvarlayıp büyütme, yenisini uydurma.
Ekran/UI adları İngilizce kalır (site İngilizce): "Verify yourself" (kendin doğrula).

---

### 1. Ajan hiç açmazsa (reveal etmezse) ne olur?
**Herkes görür. Mühür Avalanche'ta kalır ve kontrat mühürleri ve açılışları ayrı ayrı sayar.**
- Sicil her (ajan, döngü) için tek bir mühür tutar ve açılışları sayar; "Unrevealed" (açılmamış) hem panelde hem zincirde görünür. Şu an zincirde 25+ döngü var, hepsi açılmış (16:29'da 31 mühür / 31 açılış).
- Rastgele değer (salt) olmadan zarfı kimse açamaz. Ajan da başka bir kararla değiştiremez: kontrat parmak iziyle (hash) eşleşmeyen her içeriği reddeder (`HashMismatch`).
- Çökme güvenliği: içerik ve salt mühürden *önce* diske yazılır; yeniden başlayınca ajan önce açık zarfı açar.
- Dürüst sınır: açılmamış mühür için zincirde bir ceza (slashing) henüz yok. Bedeli itibar kaybı, ama bu kayıp herkese açık ve kalıcı.

### 2. Mühürlü zarf (commit-reveal) neden şart, normal log yetmez mi?
**Log düzenlenebilir ve sadece işine gelen kısmı gösterilebilir. Avalanche'taki mühür emirden önce zaman damgası alır ve sonradan değiştirilemez.**
- Parmak izi, kararı piyasa cevap vermeden kilitler. Kötü bir karar sonradan "düzeltilemez".
- Kararı işlemden önce açıkça yayınlamak başkalarının öne geçmesine (front-running) ya da kopyalamasına izin verir. Salt, mühürlü kararı işlem bitene kadar okunmaz tutar. 5 coin için sadece al/sat/bekle seçenekleri var; salt olmasa karar parmak izinden tahmin edilebilirdi.
- Dürüst sınır: mühürlü zarf, *mühürlenen* kararların değişmediğini kanıtlar. Ajanın sicil dışında hiç işlem yapmadığını tek başına kanıtlayamaz. Her açılış OKX emir kimliğini taşıdığı için sicil borsa hesabıyla karşılaştırılabilir; bu karşılaştırmayı otomatik hale getirmedik.

### 3. Neden ana ağ değil de Fuji?
**Bu bir hackathon yapımı ve kontratlar denetlenmedi; test AVAX'ı organizatörler verdi. Tasarımda Fuji'ye özgü hiçbir şey yok.**
- Aynı kontratlar ve aynı kurulum betiği C-Chain ana ağında da çalışır; sadece ağ ayarı değişir.
- Önce bir güvenlik denetimi, sonra da ajanın gaz ücretini kimin ödeyeceğine dair bir karar isteriz.
- İşlemler zaten gerçek: ilk canlı emir gerçek parayla OKX TR'ye gitti. Sadece *sicil* test ağında.

### 4. Getiri al-tuttan düşük. Bu neden iyi?
**Getiride daha iyi değil ve öyle olduğunu iddia etmiyoruz. GRAIL riski kontrol etmek ve doğrulanabilir olmak için yapıldı.**
- 30 günlük tekrar oynatma (gerçek OKX saatlik fiyatları, 17 Eylül → 17 Ekim, 50 USDT, emir gönderilmeden): GRAIL getirisi +%2,0, en kötü düşüşü %4,3. Aynı 5 coinin eşit ağırlıklı al-tut stratejisi: getiri +%8,8, en kötü düşüş %14,5.
- Akıllı giriş kapılarıyla işlem sayısı 382'den 220'ye indi. Acil durdurma (kill switch) bu 30 günde hiç tetiklenmedi.
- Varsayımlar: emir bar kapanışında dolar, %0,1 ücret, kayma yok, yapay zekâ analisti yok. 30 gün bir stratejiyi yargılamak için çok kısa.
- Ürünün özü *doğrulanabilir sicil*. Daha iyi ya da daha kötü her strateji aynı mühürle-işle-aç döngüsüne takılabilir.

### 5. Yapay zekâ analisti ne zaman veto eder?
**Sadece alımlara bakar. Bir alımı aynen bırakabilir, küçültebilir ya da beklemeye çevirebilir. Asla risk ekleyemez, satışlara hiç dokunmaz.**
- Modelin ne dediğinden bağımsız olarak bunu kod zorlar: ters yön beklemeye döner, daha büyük tutar geri kırpılır, minimum emrin altına düşen her şey beklemeye döner.
- Anahtar yoksa, zaman aşımı olursa (en fazla 8 sn) ya da cevap bozuksa karar değişmeden geçer ve `skipped` olarak işaretlenir.
- Yapay zekânın notu ve kararı *parmak izinin içine* girer; görüşü de mühürlenir.
- Dürüst: ilk canlı emirde (cycle 2) analist çalışmadı (`skipped: no_provider`); anahtar sonradan eklendi. Sonraki deneme döngüsünde (cycle 3) analist 5 alımı onayladı (kullanıcı bildirimi, STATE r31). Canlı bir alımı veto ettiği bir döngüyü henüz göstermedik.

### 6. Zincirdeki kimlik kartı (ERC-8004) ne katıyor?
**Ajana herkese açık, taşınabilir bir kimlik. Sicil anonim bir cüzdana değil, kayıtlı bir kimliğe (1 numaralı ajan) ait.**
- GrailLedger mühür ve açılışları sadece kayıtlı ajanın sahibinden ya da onaylı operatöründen kabul eder; başka herkesin çağrısı reddedilir.
- Ajan yeni bir cüzdana ya da bir ajan pazarına taşınırsa kimliği ve sicili onunla birlikte gider.
- Dürüst: Reputation ve Validation kayıtları kurulu ama henüz onlara yazılmıyor. Sonraki adım, oraya doğrulama yazan ikinci bir "risk bekçisi" ajanı.

### 7. Gerçek para riskini nasıl sınırladınız?
**Dar yetki, kodda kontrol edilen kesin sınırlar, varsayılan deneme modu (dry run) ve canlıya geçişi açıkça başlatması gereken bir insan.**
- OKX API anahtarında sadece Okuma + İşlem yetkisi var, para çekme yetkisi yok. Sadece spot, kaldıraç yok, sadece ayarlardaki coinler. Kodda para çekme, transfer, kaldıraç ya da hesap ayarı çağrısı yok.
- Her emirden önce sınırlar kontrol edilir: emir başına en fazla, toplamda en fazla, düşüşte acil durdurma.
- Canlı mod üç şeyi birlikte ister: `dry_run: false` olan bir ayar dosyası, `--live --confirm-live GRAIL-LIVE-SPOT` bayrakları ve gerçek Fuji zinciri.
- İlk canlı emir bilerek çok küçüktü: tek coin (BTC), 2 USDT, tek döngü, bir insanın gözü önünde. Doldu (OKX emri 4017748393474314240).
- Bu projeyi yazan yapay zekâ kod araçları sadece piyasa verisi okuyabiliyordu; emri sadece ajanın kendi kodu verebilir.

### 8. Korelasyon farkındalığı somut olarak neyi değiştirdi?
**Pozisyon büyüklüklerini. Birlikte hareket eden coinler her biri ayrı bütçe almak yerine tek bir risk bütçesini paylaşır.**
- HRP benzer coinleri ailelere ayırır; riski önce aileler arasında, sonra aile içinde böler.
- Volatilite hedefi, korelasyonu zaten içeren portföy volatilitesini kullanır. Coinler birlikte hareket ettiğinde portföy daha risklidir, bu yüzden toplam pozisyon küçültülür.
- Kullanıcıya gerçeği de söyler: son 30 günde 5 coin ortalama 1,36 bağımsız bahis (n_eff) gibi davrandı.
- Dürüst: korelasyonlu/korelasyonsuz bir karşılaştırma (ablation) yapmadık; getiriye etkisi için bir sayı iddia etmiyoruz.

### 9. Gerçekten otonom mu?
**Evet. Her döngü kendi kendine işler: piyasayı oku → karar ver → yapay zekâ kontrolü → mühürle → emri ver → aç → güncelle. Kimse "onayla"ya basmaz.**
- İnsan kuralları (ayarları) koyar ve canlı modun açık olup olmadığına karar verir. Ajan ikisini de değiştirmez.
- Dürüst: canlı modda bilerek, güvenlik için tam bir döngü çalıştırdık. Sürekli döngü deneme modunda gerçek piyasa verisi ve gerçek Fuji mühürleriyle çalıştı; zincirde 25+ döngü var.

### 10. OKX ya da Avalanche döngünün ortasında çökerse?
**Güvenle durur. Mühür başarısız olursa emir gönderilmez. Emir sonucu belirsizse emri kimliğiyle sorgular, asla iki kez göndermez.**
- Başarısız her adım döngüyü atlatır, hatayı kaydeder; ajan bir sonraki döngüyle devam eder.
- Fiyat verisi eksik ya da bozuksa o coinde bekler ve nedenini yazar.
- Her emrin kalıcı bir günlükte istemci kimliği vardır; sonucu bilinmeyen bir emir çözülene kadar yeni canlı emirleri engeller.

### 11. Ajan çok sayıda karar mühürleyip sadece iyisini açabilir mi?
**Hayır. Kontrat bu ajan için döngü başına tam bir mühüre izin verir. Aynı döngüye ikinci mühür reddedilir (`AlreadyCommitted`).**
- Döngü numaraları kalıcıdır ve sadece artar; yeniden başlatma onları tekrar kullanmaz.
- Dürüst: kontrat döngü numaralarının ardışık olmasını zorlamaz. Atlanan bir numara sicilde görünür bir boşluk olarak kalır, ama zincirde onu engelleyen bir şey yok. `npm run audit` ardışıklık varsaymadan bütün döngüleri okur.

### 12. Size güvenmeden kendim nasıl doğrularım?
**Üç yol: paneldeki "Verify yourself" (kendin doğrula) düğmesi, terminal komutu ve Snowtrace.**
- Panel: tarayıcın `keccak256(içerik ‖ salt)` değerini yeniden hesaplar ve Fuji'deki mühür işlemiyle karşılaştırır.
- Terminal: `cd chain && npm run audit` bütün sicili okur; her açılmış döngü için içeriği ve salt'ı açılış işleminden çözer, parmak izini yeniden hesaplar, zincirdeki mühürle karşılaştırır → `MATCH`. Tek döngü için hızlı yol: `npm run verify:cycle:1`. Cüzdan ya da anahtar gerekmez.
- Snowtrace: 4 kontratın kaynak kodu doğrulanmış; örnek GrailLedger https://testnet.snowtrace.io/address/0x1B5fcf6DeFf2F9375338A2C35932224522118851#code

### 13 (ek). Hurst piyasanın yatay olduğunu gerçekten tespit ediyor mu?
**Hayır, tahmin ediyor. 48 saatlik veride bu tahmin gürültülü; biz onu kesin bir tespit değil, bir temkin sinyali olarak kullanıyoruz.**
- Kapı sadece azaltır: yatay görünen bir piyasada momentum alımını bekletir; asla alım üretmez, asla satışa dokunmaz. Yanlış alarm en kötü ihtimalle bir alımı kaçırtır.
- İnceleme (R-009-5) aynı şeyi söylüyor: kısa pencerede rastgele veride bile "yatay" etiketi sık çıkabiliyor. Daha uzun geçmiş ya da daha geniş ölü bant, freeze sonrası iş.

---

### Söyleme
- "Piyasayı yeniyor" / "kârlı": tekrar oynatma daha düşük getiri gösteriyor.
- "Canlı işlemi yapay zekâ onayladı": cycle 2'de `skipped` idi.
- "Acil durdurma zararı %5'te keser": yeni emirleri durdurur, pozisyon kapatmaz. (30 günlük tekrar oynatmada hiç tetiklenmedi.)
- "Hurst piyasa rejimini tespit ediyor": tahmin ediyor.
- "Tamamen denetlendi" ya da "üretime hazır".
