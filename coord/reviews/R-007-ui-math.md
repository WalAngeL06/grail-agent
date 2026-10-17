# R-007 · UI matematiği incelemesi (web/src ↔ engine)

- İnceleyen: engine rolü (Claude Code · Opus 5.5), salt inceleme; ürün koduna yazılmadı.
- İncelenen: `origin/main@9acec55` → `web/src/` (UI v2 57e2287 + T-013 kopya), `web/fixtures/demo-state.json`, `contracts/state.example.json`;
  karşılaştırma kaynağı `engine/src/grail_engine/{stats,decision}.py` (contracts 0.6).
- Tarih: 17.10 ~15:50 (Europe/Istanbul)
- **Karar: formüller DOĞRU, 4 MAJOR etiket/taban hatası.** Çekirdek matematik (n_eff, ρ̄, Holy Grail eğrisi, tavan) engine ile
  4 ondalık düzeyinde aynı. Sorunlar: ekrandaki metrikler var olmayan bir şeyi iddia ediyor (PSR, Sharpe, "held"), Positions
  tablosundaki "target" yanlış alandan geliyor ve tabanı farklı.

## Nasıl kontrol edildi
- UI formülleri (HolyGrail.tsx `nEff`/`srP`/tavan, `format.ts n()` = `Intl.NumberFormat` halfExpand, Dashboard "Show the math") Python'a
  birebir taşındı; engine `decide()` kayıtlı 30 günlük OKX verisinde (`engine/data/okx-candles-1H.json`, T-012 ile aynı, 720 kapanmış 1H bar,
  `contracts/config.example.json`) her barda çalıştırıldı ve çıktıyla karşılaştırıldı. Ağ yok, emir/tx yok.
- Komut: `uv run --project engine python r007_check.py <repo>` (betik scratchpad'de; yöntem aşağıdaki sayılarla yeniden üretilebilir).

## Doğrulanan (sorun yok)
| Ekran öğesi | UI formülü (dosya:satır) | Engine | Sonuç |
|---|---|---|---|
| Independent bets | `N/(1+(N−1)ρ)` HolyGrail.tsx:5-8 | `1/(1/N+(1−1/N)ρ)` stats.py:16-19 | Cebirsel olarak aynı; 720 barda max fark 2.3e-4 (engine 4 ondalık yuvarlaması) |
| Holy Grail eğrisi | `SR₁·√n_eff` HolyGrail.tsx:9 | `sr_i/√(1/N+(1−1/N)ρ)` stats.py:10-13 | Aynı; max fark 6.9e-5 |
| Tavan | `SR₁/√ρ` HolyGrail.tsx:41 | lim N→∞ | Doğru; ρ≤0'da gizleniyor (doğru) |
| ρ̄ "move together" | `metrics.avg_corr` Dashboard.tsx:39 | köşegen dışı ortalama stats.py:48-54 | Aynı; demo fixture'ında matris ortalaması = 0.639 ✓ |
| Eğri noktaları / çizgi | `round2(ρ)` ile çizgi, engine `holy_grail_curve` noktaları HolyGrail.tsx:20,123-127 | decision.py:187 | Max kayma 0.67 px (görünmez) |
| ρ clamp [0, 0.95] | HolyGrail.tsx:20 | — | 30 günde ρ̄ 0.261…0.850; clamp hiç devreye girmedi |
| Volatilite "yearly" | `vol_pct` | `sd·√(525600/60)·100` = √8760 decision.py:144,199 | Etiket doğru (7/24 yıllıklama) |
| Risk allowance ipucu | Settings.tsx:17 "share × yearly swing ≤ this" | `w ≤ risk_budget/σ%` decision.py:200 | Doğru |
| Cash payı, trend yönü (>0 = up) | Dashboard.tsx:142-146, 306 | decision.py:191, 223 | Tutarlı |

## Bulgular

### R-007-1 · MAJOR · PSR "edge is real / skill rather than luck" değil
- **Yer:** `web/src/screens/Dashboard.tsx:42` (etiket + ipucu), `HowItWorks.tsx:100-101` (sözlük).
- **Engine ne hesaplıyor:** `decision.py:256-258` → PSR, **trend filtresi olmayan, bütün geçerli coinlerin HRP sepetinin** son 48 saatlik
  (in-sample) bar getirileri üzerinde, eşik SR*=0. `psr_basis: "hrp_all_valid_in_sample"`. GRAIL'in tuttuğu portföy veya gerçekleşen getirisi değil;
  "beceri vs şans" testi de değil (48 saatte piyasa yükseldiyse ~1 çıkar).
- **Kanıt:** 672 barda engine PSR ile GRAIL'in gerçekleşen 48 saatlik PSR'si 0.5 eşiğinde **107 barda zıt** yorum veriyor
  (ort. 0.515 vs 0.431).
- **Doğru metin:** plain: "Chance the coin basket's recent trend is real" · tech: "PSR(SR>0), risk-balanced basket of all coins, last 48h (in-sample)" ·
  tip: "Probability that the basket's true Sharpe over the last 48 hours is above zero. It is not GRAIL's own track record."

### R-007-2 · MAJOR · "Return per unit of risk 0.59" ölçülmüş değil, varsayım
- **Yer:** `Dashboard.tsx:62-66` (KPI kartı, alt satır "one coin alone: 0.50"), `HolyGrail.tsx:105` (y ekseni), `:153` (tooltip "return/risk"), `:188`.
- **Engine:** `decision.py:17,186` → `sr_portfolio_est = 0.5 (SR_SINGLE, "sadece gösterim") × √n_eff`. Hiçbir getiri ölçülmüyor; değer yalnız
  n_eff'in fonksiyonu (30 günde 0.533…0.782).
- **Kanıt:** Aynı 30 günde GRAIL'in gerçekleşen yıllık Sharpe'ı 1.26; ekranda ortalama 0.58 gösterilirdi → ikisi ilgisiz büyüklükler.
- **Doğru metin:** KPI başlığı "Diversification boost (illustration)" · değer `√n_eff` (ör. "×1.19") ya da mevcut değer + alt satır
  "if each coin alone scored 0.50 (assumed, not measured)". Grafik y ekseni: "return per unit of risk, if one coin = 0.5 (assumed)".
  Tech satırına `SR₁ = 0.5 assumed` eklenmeli.

### R-007-3 · MAJOR · Positions "Share now / target" sütunundaki target = HRP (limit öncesi), üstelik taban farklı
- **Yer:** `Dashboard.tsx:150-160` (lejant "risk-balanced target"), `:176` başlık, `:183` `const t = hrp[p.inst_id]`, `:194,197`.
- **Sorun 1 (yanlış alan):** Agent'ın gerçekten gittiği hedef `metrics.target_weights_pct` (vol hedefi + pozisyon/risk tavanı sonrası,
  decision.py:201,221). HRP limit öncesidir. Demo verisinde BTC: ekranda "9.95% / **31.4%**", engine hedefi 26.18%.
- **Sorun 2 (taban):** `weight_pct` (now) = değer/**equity** (`agents/src/grail_agents/market.py:50`); `target_weight_pct` = hedef/
  **deploy_base = min(equity, max_total_deploy_usdt)** (decision.py:206,231). Equity > max_total_deploy olduğunda ikisi kıyaslanamaz.
  Demo: equity 100, max_deploy 50 → BTC hedefi 26.18% × 50 = 13.09 USDT = equity'nin **%13.09**'u. Engine çıktısı equity 50/100/200 için
  aynı `target_weight_pct` veriyor (kanıt: AVAX 6.4, BTC 10.1, ETH 10.41…). İlk canlı config'te (max_total_deploy 10) fark daha da büyük.
- **Doğru:** hedef sütunu `target_weights_pct` olsun ve aynı tabana çevrilsin:
  `target_pct_of_equity = target_weight_pct × min(equity, max_total_deploy_usdt) / equity`; HRP istenirse ayrı ince işaret ("before limits").
  Signals tablosundaki "Target share" (`Dashboard.tsx:296,311`) için de aynı dönüşüm ya da etiket "share of the $50 trading budget".

### R-007-4 · MAJOR · Başlık "How many real bets GRAIL **holds**" — n_eff tutulan portföyün değil, coin listesinin
- **Yer:** `Dashboard.tsx:18` (sayfa başlığı), `:31` ("5 coins, but they move like 1.4"), `HowItWorks.tsx:24` ("GRAIL's 5 coins").
- **Engine:** n_eff = geçerli bütün coinlerin **eşit ağırlıklı** sepeti için (decision.py:178-185; `n_assets` = geçerli coin sayısı).
  GRAIL tamamen nakitte iken de (replay'de barların %15.3'ü) ekranda "holds 1.4 bets" yazar.
- **Doğru metin:** "How many independent bets GRAIL's coin list really offers" · cap: "{N} coins on the list, but they move like {n_eff}
  (last 48h, equal weights)".

### R-007-5 · MINOR · "Show the math" kendi içinde tutarsız (yuvarlama)
- **Yer:** `Dashboard.tsx:48`. Payda 2 ondalığa yuvarlanıyor, sonuç engine'in yuvarlanmamış n_eff'i.
- **Tetikleme:** 720 barın **71'inde** görünür aritmetik hata, ör. ρ̄=0.7234 → "5 / 3.89 = 1.28" (5/3.89 = 1.29).
- **Doğru:** paydayı 4 ondalık göster (`n(1 + (N - 1) * m.avg_corr, 4, 4)` → "5 / 3.8936 = 1.28") ya da sonucu gösterilen paydadan hesapla.

### R-007-6 · MINOR · PSR %0 ondalıkla "100%" / "0%" gösteriyor
- **Yer:** `Dashboard.tsx:43` `pct(m.psr * 100, 0)`. 720 barın 38'inde "100%", 6'sında "0%" — kesinlik iddiası.
- **Doğru:** `psr ≥ 0.995 → "> 99%"`, `psr < 0.005 → "< 1%"`, aksi `pct(psr*100, 0)`.

### R-007-7 · MINOR · Acil durdurma metni: "after a 5% loss" / "Trading stops"
- **Yer:** `Settings.tsx:14` ipucu, `:51` özet, `HowItWorks.tsx:57`.
- **Engine:** `dd = (1 − equity/peak)·100`, peak = en yüksek equity (decision.py:173-175); tetiklenince bütün coinler HOLD — **satmaz**,
  equity toparlanınca tekrar işler. Replay: 5% stop varken max düşüş **7.48%**, 166 bar kilitli. "Stops after a 5% loss" zarar tavanı gibi okunuyor.
- **Doğru metin:** "Pauses new orders while the account is 5% or more below its highest value. It does not sell, so losses can go past 5%."

### R-007-8 · MINOR · Hedef volatilite "about this much" → "at most"
- **Yer:** `Settings.tsx:18`. Engine yalnız küçültür: `scale = min(1, target_vol / raw_vol)` (decision.py:198).
- **Doğru:** "Positions are scaled down so the portfolio swings at most about this much per year."

### R-007-9 · MINOR · "How much it swings" = hedef karışımın tahmini, mevcut portföy değil
- **Yer:** `Dashboard.tsx:67-71`. `portfolio_vol_pct` = hedef ağırlıkların (deploy bütçesi üzerinden, nakit dahil) 48 saatlik kovaryansla
  yıllıklanmış tahmini (decision.py:202). "whole portfolio" ifadesi mevcut tutuluşu ima ediyor.
- **Doğru tip:** "Estimated yearly swing of the target mix, from the last 48 hours of prices."

### R-007-10 · MINOR · HRP ipucu trend filtresini söylemiyor
- **Yer:** `Dashboard.tsx:160`, `:293`. Engine HRP'yi yalnız trendi pozitif coinlerde hesaplar, diğerleri 0 (decision.py:191-195).
- **Doğru tip:** "Risk-balanced share among the coins that are trending up; coins trending down get 0."

### R-007-11 · MINOR · Demo fixture engine'in üretemeyeceği sayılar/metinler içeriyor (web sahibi)
- `web/fixtures/demo-state.json:160` `hrp_weights_pct` SOL 13.2 / OKB 21 → ama aynı dosyada trend SOL −0.8, OKB −1.9; engine bunlara **0** verir.
- `demo-state.json:204,227,250…` reason'lar eski Türkçe biçim (`vol 48%->hedef 20%`, `-> nakit`); 25/25 karar. Cycle 1 gerçek Fuji payload'ı
  (değişmez, kalsın), ama `demo_synthetic` turlar (9–12) T-009 sonrası engine çıktısıyla yeniden üretilmeli
  ("Price trending up (+2.4%), target 26.18% of funds (1.4 independent bets)").
- `contracts/state.example.json:25` (integrator) `corr_matrix` 2×2 (BTC/ETH 0.80) ama `n_assets 5`, `avg_corr 0.62` → ısı haritası altında
  "average 0.62" ile görünen tek hücre 0.80 çelişiyor.

### R-007-12 · NIT
- `Dashboard.tsx:287` "48h momentum" ve `:54` "last N hours" sabit; config `lookback_bars × candle_bar`'dan türetilmeli (şu an 48×1H → doğru).
- `HowItWorks.tsx:145` "≈1.4": 4 özdeş + 1 bağımsız coin eşit ağırlıkta n_eff = 5/(1+4·0.6) = **1.47 → "≈1.5"**; altyazı "1 bet + apart"
  sezgisel olarak 2 ettiğinden bir cümle açıklama ekle ("the cluster holds 4/5 of the money").
- Hero `n(ne,1,1)` (4 ondalıktan halfExpand) ile engine reason `f"{ne:.1f}"` 720 barın 1'inde farklı (1.5 vs 1.4, n_eff≈1.45; çift yuvarlama).
  Engine tarafında reason'ı `_clean(ne)` üzerinden biçimlemek çözer (ayrı kart, payload metnini değiştirir).
- `HolyGrail.tsx:20` ρ̄ < 0 olursa çizgi ρ=0'da, "You are here" noktası engine değerinde → nokta eğrinin üstünde kalır (30 günde hiç olmadı).

## Engine tarafı not (bu rol, ayrı kart gerektirir)
- `target_weight_pct` iki farklı tabanda: normal yolda deploy_base (decision.py:221,231), HOLD/kill/geçersiz-veri yolunda equity
  (`tw = cur_w`, decision.py:212-213). Hash'lenen payload'da olduğu için davranış değiştirilmeden önce `contracts/decision.md`'de taban
  tanımlanmalı. Öneri: metrics'e (hash dışı) `deploy_base_usdt` eklemek; UI R-007-3 dönüşümünü buna dayandırır.

## İstek / sözleşme
- web (R-007-1…10, 11'in fixture kısmı): metin/alan düzeltmeleri; formül değişikliği yok.
- integrator: `contracts/state.example.json` corr_matrix'i 5×5 yap (R-007-11); `decision.md`'de `target_weight_pct` tabanını tanımla.
- engine (opsiyonel kart): metrics'e `deploy_base_usdt`; reason'da n_eff'i yuvarlanmış metrikten biçimle.
