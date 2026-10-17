# GRAIL — Rehber / Tutorial

Bu metin sitedeki **Rehber** sayfasıyla (`web/src/screens/Guide.tsx`, origin/main) birebir aynıdır. Yöntem ve ürün adları iki dilde de İngilizce kalır.
This text mirrors the site's **Tutorial** page (`web/src/screens/Guide.tsx`, origin/main) word for word. Method and product names stay English in both languages.

---

## Türkçe

### Altı kısa adımda GRAIL.
Önce sade anlatım; teknik adlar İngilizce kalır.

**1. Bu site ne?**
GRAIL, kendi kendine kripto alım-satım kararı veren bir AI agent. Her kararını işlemden ÖNCE Avalanche'a mühürler; sonradan değiştiremez, saklayamaz.
→ Nasıl çalışır

**2. Agent şu an ne yapıyor?**
Panel'in en üstünde tek cümlelik bir özet ve 5 adımlı akış şeridi var: Piyasa → Karar → Mühür → Emir → Açılış.
→ Göster (Panel)

**3. Neden aldı, neden beklemedi?**
Kararlar ekranında her coin için gerekçe, "Piyasa yatay mı? (Hurst)" çipi ve AI ikinci görüş rozeti var.
→ Göster (Kararlar)

**4. Kendin doğrula**
Kararlar'da bir kartta "Verify yourself" düğmesine bas: tarayıcın kararın parmak izini (hash) kendisi hesaplar ve Avalanche'taki mühürle karşılaştırır. Yeşil = birebir aynı; "Try to cheat" ile tek bir sayıyı değiştir, kırmızıya döndüğünü gör.
→ Göster (Kararlar)

**5. Sicil seçilemez**
Zincir Kaydı her mührün açılıp açılmadığını gösterir; açılmamış zarf sayısı herkese görünür. İlk gerçek emir: check-in #2.
→ Göster (Zincir Kaydı)

**6. Parana ne yapabilir, ne yapamaz?**
Güvenlik limitleri: sadece spot, kaldıraç yok, para çekemez; emir başı ve toplam limit, acil durdurma (kill switch). Gerçek moda geçişi sadece insan yapar.
→ Göster (Güvenlik limitleri)

### 3 dakikada dene
1. Kararlar'ı aç
2. "Verify yourself"e bas
3. "Try to cheat" bölümünde "Bir sayıyı değiştir"e bas

---

## English

### GRAIL in six short steps.
Plain words first; the technical names stay in English.

**1. What is this site?**
GRAIL is an AI agent that makes its own crypto buy and sell decisions. It seals every decision on Avalanche BEFORE the trade, so it can't change or hide it later.
→ How it works

**2. What is the agent doing right now?**
The Dashboard starts with a one-sentence summary and a 5-step strip: Market → Decision → Sealed → Order → Opened.
→ Show (Dashboard)

**3. Why did it buy, why did it wait?**
Decisions shows the reason for every coin, "Is the market ranging? (Hurst)" and the AI second-opinion badge.
→ Show (Decisions)

**4. Verify it yourself**
Press "Verify yourself" on a card in Decisions: your browser computes the decision's fingerprint (hash) itself and compares it with the seal on Avalanche. Green = identical; press "Try to cheat" to change one number and watch it turn red.
→ Show (Decisions)

**5. No cherry-picking**
The On-chain Ledger shows whether every seal was opened; the number of unopened envelopes is visible to everyone. The first real order: check-in #2.
→ Show (On-chain Ledger)

**6. What can it do with your money, and what can't it?**
Safety limits: spot only, no leverage, it can't withdraw money, per-order and total limits, and an emergency stop (kill switch). Only a human can switch it to real money.
→ Show (Safety limits)

### Try it in 3 minutes
1. Open Decisions
2. Press "Verify yourself"
3. Under "Try to cheat", press "Change one number"
