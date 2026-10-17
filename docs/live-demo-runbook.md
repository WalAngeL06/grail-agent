# GRAIL — 3 dakikalık canlı demo runbook'u

Sunucu için. Talimatlar Türkçe, **söylenecek cümleler İngilizce** (deck ile aynı dil). Ekran sırası: `docs/ui-brief.md` §5.
Demo sırasında **yeni canlı emir ya da runner başlatılmaz.** D-016'ya göre yeni canlı koşu yetkisi yok; demo mevcut kanıtı gösterir.

## T-30 dk · Hazırlık kontrol listesi
- [ ] **Web gerçek state ile açık:** `cd web && GRAIL_STATE_PATH="C:/Users/Serdar Arif/Desktop/Agentic Hack-wt/agents/agents/runtime/live/state.json" npm run dev`.
      Üstte **MOCK DATA** rozeti yok; mod rozeti **LIVE · real funds** (cycle 2, `dry_run=false`).
- [ ] **Cycle 2 kartı görünüyor:** Decisions'ta BUY BTC $2.00, `FILLED`, OKX `4017748393474314240`, adımlayıcı Decided → … → Verified.
- [ ] **Terminal hazır:** ana klasörde `cd chain && npm ci` bir kez çalışmış. `npm run verify:cycle:1` önceden bir kez denenip MATCH görülmüş.
      Font büyük (≥ 20 pt), pencere temiz.
- [ ] **Tarayıcı sekmeleri sırayla açık:**
  1. GRAIL Dashboard
  2. Snowtrace cycle 2 commit: https://testnet.snowtrace.io/tx/0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569
  3. Snowtrace GrailLedger kaynak kodu: https://testnet.snowtrace.io/address/0x1B5fcf6DeFf2F9375338A2C35932224522118851#code
- [ ] **B planı açık ama gizli:** yedek video (`<TBD: link/dosya>`) ve `docs/demo-backup/` ekran görüntüleri (aşağıdaki listeye göre önceden alınmış).
- [ ] **Ekran ayarları:** tarayıcı zoom 110%, bildirimler kapalı, `.env` / cüzdan / OKX penceresi ekranda değil.

## Akış (3:00)
| Süre | Ekran | Yap | Söyle |
|---|---|---|---|
| 0:00–0:25 | Dashboard | Hero sayıyı ve Holy Grail eğrisini göster; ρ slider'ı aşağı çek, sonra "Back to today" | "Five coins, but they move together. GRAIL counts real bets, not coins, and sizes every position by them." |
| 0:25–0:45 | On-chain Ledger | Sayaçlar: commits / reveals / unrevealed; agent #1 kimlik kartı | "Every decision is sealed on Avalanche before the order. Open envelopes stay visible, so nothing can be hidden." |
| 0:45–1:20 | Decisions | Cycle 2'yi aç: BUY BTC $2, FILLED, OKX order id; adımlayıcıyı soldan sağa göster | "This is our first live order, at 15:37 today. Two dollars of BTC on OKX TR, sealed first, traded, then opened." |
| 1:20–1:50 | Decisions → Verify | **Verify yourself**'e tıkla → "computing…" → üç satır ✓ → "Match" | "Your browser just rebuilt the fingerprint and compared it with Avalanche. You didn't have to trust us." |
| 1:50–2:15 | Snowtrace (sekme 2, sonra 3) | Commit tx'in zamanını göster; sonra GrailLedger #code'da "verified" | "Here's the seal on Snowtrace, written before the order. The contract source is verified, so anyone can read the rules." |
| 2:15–2:40 | Terminal | `npm run verify:cycle:1` çalıştır; MATCH satırını göster | "Same check from a terminal: no wallet, no keys. It decodes the reveal, re-hashes and compares. MATCH." |
| 2:40–3:00 | Settings | Limitler + guardrail listesi; mod rozeti | "Spot only, no withdrawals, hard caps, and going live is a human decision. Backtests can lie. Avalanche can't." |

Notlar:
- Cycle 2'nin `reason` metninde Türkçe bir kelime ("hedef") var: T-009'dan önceki bir döngü. Sorulursa: "older cycle, before we switched reasons to English".
- Jüri AI'ı sorarsa: canlı emirde analist `skipped`; dürüstçe söyle (`docs/jury-faq.md` #5).
- `verify:cycle:1` cycle 1'i (practice mode) doğrular. Cycle 2 için komut:
  `npm run verify:cycle -- --cycle 2 --commit-tx 0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569 --reveal-tx 0xae6537e9acc9e66accfe5d0fe61b2f9a858460d7c42cf3d25f0acafa378541f7`
  Bunu provada mutlaka bir kez dene; ben çalıştırmadım.

## B planı · bir şey bozulursa
| Belirti | Hemen yap | Söyle |
|---|---|---|
| Web açılmıyor / beyaz ekran | Yedek videoya geç (`<TBD>`), 1:20'deki Verify anından başlat | "Let me show the recording from this afternoon — same data." |
| Üstte **MOCK DATA** çıkıyor | `GRAIL_STATE_PATH` yanlış; düzeltmeye uğraşma, ekran görüntüleri setine geç | — |
| Verify'da on-chain satırı "could not read Fuji" | Tarayıcı hesabı (computed = stated ✓) yine de geçerli; Snowtrace sekmesine geç | "The public RPC is busy; here is the same transaction on Snowtrace." |
| `verify:cycle:1` → "Too Many Requests" (RPC 429) | 10 sn bekleyip bir kez tekrar dene; olmazsa aşağıdaki kayıtlı çıktıyı göster | "Public RPC rate limit — here's the output from our run." |
| Snowtrace yavaş / 403 | Ekran görüntüsü 4–5 | — |
| Wi-Fi yok | Tamamen video + ekran görüntüleri; Verify'ın tarayıcı satırı ağ olmadan da çalışır | — |

**Kayıtlı terminal çıktısı** (R-006 incelemesinde gerçekten alındı, 17.10, exit 0):
```
MATCH agent=1 cycle=1
payload dry_run=true (SIMULATED)
commitHash=0xd9064ac4000cae4637a50cd3f25b4ae7c9612e9c9600772f7468533371785a83
keccak(payload||salt)=0xd9064ac4000cae4637a50cd3f25b4ae7c9612e9c9600772f7468533371785a83
salt(calldata)=0x22afaf21ed2e74a9da64b8fce4450a37e8a20519478c3d0888e037fc11bbce58
https://testnet.snowtrace.io/tx/0x7b47c4f313ffa5630d1acfff6411f11c6d13c321bbc69649ec8c90976995f728
https://testnet.snowtrace.io/tx/0x541cb8ff88aac0248fbf79d7997915b62bb08fb873e226bbefc35cbcec77cf45
```

**Önceden alınacak ekran görüntüleri** → `docs/demo-backup/` (kullanıcı alır; repoya girmeden önce sır içermediğini kontrol et):
1. Dashboard (hero + eğri)
2. Ledger (sayaçlar + agent #1)
3. Decisions, cycle 2 açık (FILLED + OKX id)
4. Verify sheet, üç ✓ + "Match"
5. Snowtrace commit tx (cycle 2)
6. Snowtrace GrailLedger #code "verified"
7. Terminal MATCH çıktısı
8. Settings (limitler + guardrail'ler)

## Demo sonrası
- Runner/emir yok; açık kalan bir şey olmamalı. `runtime/live` klasörüne dokunma (journal ve pending korunur).
