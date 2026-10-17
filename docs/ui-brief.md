# GRAIL — UI brifi (T-004 · contracts v0.3)

Okuyan: web (T-005 inşa), Claude Design (~14:00 tasarım), ui-qa (Antigravity test). Tek veri kaynağı `runtime/state.json`
(şema: `contracts/state.example.json`). UI **salt okunur**: emir vermez, config yazmaz, cüzdan istemez.
Ekran metni İngilizce (jüri/sponsor uluslararası olabilir); bu brif Türkçe.

## 0 · İskelet (her ekranda aynı)
- **Sol menü (220 px):** `Dashboard` · `Decisions` · `On-chain Ledger` · `Settings`. Altta küçük "Avalanche Fuji · OKX TR" etiketi.
- **Üst bar (56 px, sabit):** `agent.name` + durum noktası (`agent.status`: running=yeşil, diğer=amber) · **mod rozeti**
  (`dry_run: true` → amber `DRY RUN · simulated orders`; `false` → kırmızı `LIVE · real funds`) · `Cycle #agent.cycle_id` ·
  geri sayım `next_cycle_at_ms − now` ("next in 0:42") · zincir mini sayaç `commits / reveals / unrevealed` · hata rozeti
  (`errors.length`, >0 ise kırmızı, tıklanınca Settings › System) · "updated 3s ago" (`generated_at_ms`).
- **Yenileme:** state 3 sn'de bir okunur. Yeni karar satırı 1,5 sn altın renkte parlar. Bilinmeyen alanlar yok sayılır.
- **Ortak biçim:** para string → 2 ondalık (`"62.4"` → `$62.40`), fiyat olduğu gibi; `*_pct` → `24.9%`; zaman yerel `HH:mm:ss`
  + göreli; hash `0x9f3a…b21c` (mono, kopyala ikonu); tx linki `${chain.explorer}/tx/${hash}`, adres `${chain.explorer}/address/${addr}`.
- **Gruplama kuralı:** bir döngünün tüm kararları **tek payload / tek commit**'tir (`contracts/decision.md`). `decisions[]` satırları
  `cycle_id`'ye göre gruplanır; `commit_tx`, `reveal_tx`, `payload_utf8`, `salt_hex`, `commit_hash` grubun ilk satırından alınır.

## 1 · Ekranlar ve alan eşlemesi

### 1.1 Dashboard — "kaç bahsin var, agent ne durumda"
| Bölge | state alanı | Bileşen |
|---|---|---|
| Hero (sol üst, büyük) | `metrics.n_eff`, `metrics.n_assets`, `metrics.avg_corr` | 64 px altın sayı **"1.44"** + "effective bets out of 5 coins · ρ̄ = 0.62" |
| KPI şeridi (4 kart) | `portfolio.equity_usdt`, `portfolio.cash_usdt`, `metrics.sr_portfolio_est` vs `metrics.sr_single_assumed`, `metrics.portfolio_vol_pct` | Stat kartı; SR kartında "0.60 vs 0.50 single" |
| Holy Grail eğrisi (geniş) | `metrics.holy_grail_curve`, `avg_corr`, `n_assets`, `sr_single_assumed`, `sr_portfolio_est` | Çizgi grafiği + ρ slider — bkz. §2 |
| Pozisyonlar | `portfolio.positions[]` ⨝ `market[]` ⨝ `metrics.hrp_weights_pct` (anahtar `inst_id`) | Tablo: coin · `size_base` · `value_usdt` · `weight_pct` vs HRP hedef (çift çubuk) · `last` · `change_24h_pct` (yeşil/kırmızı) |
| Korelasyon | `metrics.corr_matrix.labels/values` | Isı haritası, hücrede değer (2 ondalık), köşegen soluk |
| Son döngü | `decisions[]` where `cycle_id == agent.cycle_id` | Coin başına aksiyon çipi (BUY/SELL/HOLD) + "→ Decisions" linki |
| PSR | `metrics.psr` | `null` ise "—  (needs history)" |

### 1.2 Decisions — "agent ne düşündü, ne yaptı"
Döngü kartları, yeni üstte. **Kart başlığı:** `Cycle #12 · 14:21:30 · 5 decisions` + yaşam döngüsü adımlayıcı (5 nokta):
`Decided` (`decided_at_ms`) → `Committed` (`commit_tx` var) → `Ordered` (BUY/SELL varsa `okx_order_id`; hepsi HOLD ise "no order" gri) →
`Revealed` (`reveal_tx` var) → `Verified` (`verified: true`). Eksik adım amber "pending", `commit_tx` yoksa kırmızı
**"commit failed → no order (fail-closed)"**.

| Kart içi satır (coin başına) | state alanı | Bileşen |
|---|---|---|
| Aksiyon | `action`, `size_usdt` | Çip: BUY yeşil, SELL kırmızı-turuncu, HOLD gri; "BUY $5.00" |
| Gerekçe | `reason` | Tek satır metin, tam genişlik (agent'ın "düşüncesi") |
| Fiyat | `ref_price` → `fill_price` | "ref 67,250.1 → fill 67,248.0" (mono) |
| Emir | `okx_order_id`, `order_status` | `filled` yeşil · `simulated` amber "SIMULATED" · diğer gri; HOLD'da gizli |
| Detay (açılır) | `payload_utf8` (JSON pretty, mono), `salt_hex`, `commit_hash`, `commit_tx`, `reveal_tx` | Kod bloğu + linkler + **Verify yourself** butonu (§1.3) |

### 1.3 On-chain Ledger — "sicil seçici gösterilemez"
| Bölge | state alanı | Bileşen |
|---|---|---|
| 3 büyük sayaç | `chain.commits`, `chain.reveals`, `chain.unrevealed` | Stat kartı; `unrevealed > 0` amber + "Open commits stay visible — no cherry-picking." |
| Kontrat kartı | `chain.network`, `chain.chain_id`, `chain.address`, `chain.explorer` | Avalanche logosu, "Fuji · 43113", adres + "View on Snowtrace ↗" |
| Sicil tablosu | `decisions[]` (döngü grubu) | Kolonlar: `cycle_id` · zaman · `commit_tx` ↗ · `reveal_tx` ↗ veya amber **OPEN** · dry_run (payload JSON'undan, `SIM`/`LIVE`) · aksiyon özeti ("2 BUY · 3 HOLD") · `verified` ✅/❌/— · Verify butonu |
| Agent kimliği | (state'te yok — bkz. istek) | ERC-8004 kartı; alan yoksa gizle |

**Verify yourself** (satırda ve Decisions detayında): `keccak256(concat(utf8(payload_utf8), bytes(salt_hex)))` tarayıcıda hesaplanır →
`commit_hash` ile karşılaştırılır; sonra `contracts/chain.json` ABI + Fuji RPC ile zincirdeki commit okunur. Sonuç paneli 3 satır:
`computed 0x…` / `stated 0x…` / `on-chain 0x…` + büyük ✅ "Match — you didn't have to trust us" ya da ❌ "Mismatch". Salt/payload
geçersizse (mock'taki `"0x5a..."`) gri "Mock data — cannot verify". Hesap 1 sn'den kısa sürse de 400 ms "computing…" göster (demo anı).

### 1.4 Settings — "limitler kodda, insan kontrolünde" (salt okunur)
| Bölge | state alanı | Bileşen |
|---|---|---|
| Mod | `mode`, `dry_run` | Büyük rozet + "Switching to live is a human action (config), not a UI button." |
| Config | `state.config` **içindeki tüm anahtarlar** | Anahtar-değer tablosu; bilinen anahtarlara etiket: `coins` → çipler, `risk_budget_pct`, `max_position_pct`, `cycle_seconds`; bilinmeyenler ham gösterilir |
| Guardrail'ler | statik metin (BRIEF) | ✔ listesi: Spot only · No leverage · Config coins only · Per-order & total caps · Drawdown kill switch · API key without withdraw |
| System › Errors | `errors[]` (yeni üstte) | Tablo: zaman · `code` (mono, kırmızı çip) · `message` · `where`; boşsa yeşil "No errors" |

## 2 · Holy Grail eğrisi (Dashboard'un yıldızı)
- Formül (istemci tarafı): `n_eff(N, ρ) = N / (1 + (N−1)·ρ)`, `SR_p(N, ρ) = SR₁ · √n_eff`, `SR₁ = metrics.sr_single_assumed`.
  Kontrol: N=5, ρ=0.62 → n_eff 1.44, SR_p 0.60 (örnek state ile tutar).
- X ekseni N = 1…20 ("number of assets"), Y ekseni SR_p ("portfolio Sharpe").
- Çizgiler: ρ ∈ {0, 0.2, 0.4, 0.8} soluk ince referans; **canlı ρ̄** (`avg_corr`) kalın altın çizgi. Engine'in `holy_grail_curve`
  noktaları aynı çizgi üzerinde küçük noktalar (formülle tutarlılık kanıtı). Kesikli yatay asimptot `SR₁/√ρ̄` etiket "correlation ceiling".
- **"You are here"** noktası: (`n_assets`, `sr_portfolio_est`), nabız animasyonlu altın halka + etiket "5 coins ≈ 1.44 bets".
- **ρ slider** (0–0.95, adım 0.01, grafiğin altında): kalın çizgi ve "you are here" etiketi sürüklenirken yeniden hesaplanır;
  slider değeri canlı ρ̄'dan farklıysa "what-if" etiketi + "Reset to live ρ̄ (0.62)" linki. Slider state'e yazmaz.
- Altında tek cümle: "Adding coins that move together adds almost nothing. GRAIL sizes positions by effective bets."

## 3 · Görsel dil
- **His (3 referans):** Bloomberg terminalinin yoğun ama okunur sayıları · Snowtrace/Etherscan'in "kanıt" dürüstlüğü (hash, link, ✅) ·
  Linear'ın sakin karanlığı ve boşluğu. Süs yok, gradyan yok; vurgu sadece altın ve durum renkleri.
- **Palet (koyu tema, tek tema):**

| Token | Hex | Kullanım |
|---|---|---|
| bg | `#0B0E14` | sayfa |
| surface / surface-2 | `#121722` / `#1A2130` | kart / tablo satırı hover, kod bloğu |
| border | `#263043` | 1 px kart ve tablo çizgileri |
| text / muted / dim | `#E6EAF2` / `#8A94A8` / `#5B6578` | metin hiyerarşisi |
| grail (vurgu) | `#E8B04B` | hero sayı, canlı eğri, "you are here", yeni satır parlaması |
| proof (zincir) | `#8B9CFF` | tx/adres linkleri, Committed/Revealed adımları |
| buy / verified | `#22C55E` | BUY çipi, ✅, filled |
| sell | `#F97066` | SELL çipi, negatif değişim |
| hold | `#8A94A8` | HOLD çipi |
| warn | `#F5A524` | DRY RUN, SIMULATED, OPEN commit, pending |
| danger | `#EF4444` | LIVE rozeti, ❌, hata, commit failed |
| avalanche | `#E84142` | sadece Avalanche logosu / ağ rozeti |
| ısı haritası | `#1A2130` (ρ=0) → `#E8B04B` (ρ=1); negatif → `#3B82F6` | korelasyon |

- **Tipografi:** Inter (UI; 14 px gövde, 12 px etiket büyük harf +0.04em, başlık 20/600, hero 64/700) · JetBrains Mono (hash, payload,
  fiyat, emir id; 13 px). Tüm sayılar `font-variant-numeric: tabular-nums`.
- **Boşluk:** 4 px ızgara (8/12/16/24/32). Kart: radius 12, padding 20, aralık 16. İçerik max 1440 px. Gölge yok; ayrım border ile.
- **Hareket:** sadece 3 yer — yeni satır parlaması, "you are here" nabzı, Verify sonucu. 150–250 ms.

## 4 · Boş / yükleniyor / hata durumları
| Durum | Tetik | Gösterim |
|---|---|---|
| Yükleniyor | ilk okuma bitmedi | Kart iskeletleri (surface-2 shimmer), üst barda "connecting…" |
| Mock | `runtime/state.json` yok → `state.example.json` | Üst barda mor-gri **MOCK DATA** rozeti, her ekranda görünür |
| Bayat veri | `now − generated_at_ms > 3 × config.cycle_seconds` | Amber şerit "Agent silent for 5m — last state shown" |
| Okuma hatası | fetch/JSON parse hatası | Son iyi state kalır; kırmızı şerit "Can't read state.json (retrying)"; asla beyaz ekran |
| Agent durdu | `agent.status != "running"` | Üst bar noktası amber + durum metni |
| Karar yok | `decisions` boş | Decisions/Ledger: "Waiting for first cycle — next in 0:42" (geri sayımla) |
| Pozisyon yok | `positions` boş | "All cash — trend filter is risk-off" (`cash_usdt` göster) |
| Eksik alan | ör. `psr: null`, `fill_price` yok, `reveal_tx` yok | "—" veya amber "pending"; bileşen çökmez |
| Hata kaydı | `errors[]` dolu | Üst bar rozeti + Settings › System; döngü atlandı mesajı olduğu gibi |

## 5 · 10 dakikalık demo — ekran sırası (BRIEF "Demo hikâyesi" ile hizalı)
| Dakika | Ekran | Gösterilen | Söz |
|---|---|---|---|
| 0:00–1:30 | Dashboard | Hero "1.44", Holy Grail eğrisi; ρ slider 0.62 → 0.1 → reset | "5 coin aldınız; efektif bahis sayınız ~1,4." |
| 1:30–2:30 | Ledger | Sayaçlar, OPEN satırı | "Agent sicili bugün doğrulanamıyor; burada her karar emirden önce mühürlü." |
| 2:30–6:00 | Decisions | Canlı döngü: adımlayıcı dolar → commit ↗ Snowtrace → OKX emir id → reveal → Verified; **Verify yourself** ✅ | "Bize güvenmeyin, kendiniz hesaplayın." |
| 6:00–8:30 | Settings | Mod rozeti, config limitleri, guardrail listesi, Errors tablosu | Jürinin 5 sorusu: yetki, limit, hata davranışı |
| 8:30–10:00 | Dashboard → Ledger | Güncel sayaçlar, kontrat adresi | "Backtest yalan söyleyebilir; Avalanche söylemez." |

Demo öncesi kontrol: sekmeler önceden açık, tarayıcı zoom 110%, `dry_run` rozeti jüriye açıkça söylenir.

## 6 · Sözleşme istekleri (integrator'a — UI bunlar olmadan da çalışır)
1. `state.config`'e para limitleri: `max_order_usdt`, `max_total_deploy_usdt`, `kill_switch_drawdown_pct`, `target_vol_pct` (Settings'in jüri anı).
2. `chain`'e ERC-8004 kimliği: `agent_id`, `identity_registry` (Ledger'da kimlik kartı; SUBMISSION'da da isteniyor).
3. Sicil tablosu için zincirdeki tüm döngüler (`decisions[]` kısaltılıyorsa ayrı `ledger[]`: `cycle_id, commit_tx, reveal_tx, decided_at_ms`).
