# GRAIL — ürün özeti (kesinleşti 17.10 12:20; yazarı: integrator)

## Tek cümle
**Parasını bir AI agent'a emanet edecek kişi, agent'ın sicilini görebilmeli.** GRAIL; OKX TR'de gerçek parayla, kodla sınırlanmış
yetkilerle işlem yapan, her kararını emirden ÖNCE Avalanche'a mühürleyen ve ERC-8004 kimliğiyle sicili doğrulanabilen otonom bir trading agent'ıdır.

## Problem ve hedef kullanıcı (jüri sorusu 5)
- Kullanıcı: sermayesini bir trading agent'ına (ya da agent pazarındaki bir agent'a) devretmek isteyen kişi/küçük fon.
- Problem: agent'ların geçmiş performansı doğrulanamaz — backtest seçilir, ekran görüntüsü düzenlenir, kararlar sonradan "düzeltilir".
  Ayrıca çoğu "çeşitlendirilmiş" kripto portföy aslında tek bahistir (yüksek korelasyon).

## Ürünün dört parçası
1. **Algı (OKX ATK):** OKX TR'den mum, ticker, bakiye (`grail` profili, `--read-only`); emirler ayrı ve guardrail'li.
2. **Beyin (quant engine, deterministik):** korelasyon → ortalama ρ, **Holy Grail / efektif N**, HRP ağırlıkları, volatilite hedefi,
   pozisyon limitleri. Her döngü coin başına BUY/SELL/HOLD üretir. LLM parayı yönetmez.
3. **Hesap verebilirlik (Avalanche Fuji):** agent ERC-8004 IdentityRegistry'de kayıtlı; her döngü kararı `commit` (emirden önce) →
   ATK emri → `reveal` (payload + salt + OKX emir id). `dry_run` hash'in içinde: simüle ve gerçek karar zincirde ayırt edilir.
   Açıkta kalan (reveal edilmemiş) commit'ler görünür → seçici gösterim yapılamaz.
4. **Arayüz:** Dashboard · Karar akışı · On-chain sicil · Ayarlar/limitler. Holy Grail eğrisi ve "efektif bahis sayısı".

## Yetki ve limitler (jüri sorusu 2 — slayt 10 "yetkiyi daralt, harcamayı sınırla, izi tut, insan onayı")
- API key: Read + Trade, Withdraw YOK. Sadece spot, kaldıraç yok, sadece config'teki coinler.
- Emir başı `max_order_usdt`, toplam `max_total_deploy_usdt`, drawdown kill switch. Kod emirden önce zorlar.
- `dry_run` varsayılan açık; canlıya geçişi insan yapar.

## Hata davranışı (jüri sorusu 4)
- Herhangi bir adım hata → döngü atlanır, hata state'e yazılır, agent durmaz. Commit başarısız → emir yok (fail-closed).
- Belirsiz emir/tx → önce kimlikle sorgu, tekrar gönderme yok.

## Demo hikâyesi (10 dk)
1. Hook: "5 coin aldınız; efektif bahis sayınız ~1,4." (Holy Grail, canlı ρ ile)
2. Problem: agent sicili doğrulanamıyor.
3. Canlı: agent döngüsü → Snowtrace'te commit → OKX TR emri → reveal → UI'da "verified".
4. Limitler ve hata davranışı (5 jüri sorusu tek tek).
5. Kapanış: "Backtest yalan söyleyebilir; Avalanche söylemez."

## Kapsam dışı (bugün)
Backtest motoru, kaldıraç/türev, x402 ödemesi, çoklu borsa. Uzatma (vakit kalırsa): ikinci "risk bekçisi" agent'ın ValidationRegistry'ye
doğrulama yazması; LLM ile karar açıklaması (`reason` alanı).
