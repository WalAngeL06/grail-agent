# GRAIL — teslim formu cevapları (kopyala-yapıştır)

Form: https://docs.google.com/forms/d/e/1FAIpQLSfSMYuEAv_RelL6JVXpvZHDyUkZAjtcVV0XHm9x6zsNGryCWg/viewform
Alanlar `coord/SUBMISSION.md` ile aynı sırada. Cevaplar İngilizce. Her kutunun içi olduğu gibi kopyalanır.
**Göndermeden önce** `<PAGES_URL>`, `<SLIDES_URL>` ve `<VIDEO_URL>` yer tutucularını doldur ve her linki gizli pencerede aç. Forma şifre ya da anahtar yazılmaz.

---

### 1. Builder Hub hesabına kayıtlı e-posta (zorunlu)
Kullanıcı kendisi yazar (Builder Hub'da kayıtlı adres). Burada tutulmuyor.

### 2. Projenin yayınlandığı website
```
<PAGES_URL>
```
Not: GitHub Pages'teki public demo build'i (`web/dist-public`). Agent durumu gerçek deneme-modu koşusunun dondurulmuş bir anlık görüntüsü; Ledger ve "Verify yourself" ise Avalanche Fuji'yi ziyaretçinin tarayıcısından canlı okur.

### 3. Takım / proje adı (zorunlu)
```
GRAIL
```

### 4. Proje açıklaması (zorunlu)
Tek cümle (kısa alan varsa):
```
GRAIL is an autonomous, correlation-aware trading agent that trades on OKX TR through the OKX Agent Trade Kit and seals every decision on Avalanche before it places the order, so anyone can verify the agent's track record.
```
Uzun açıklama (`docs/submission-description.md` ile birebir aynı):
```
If you hand your capital to an AI trading agent, you should be able to check its record. Today you can't: backtests are cherry-picked, screenshots get edited, decisions get "fixed" after the fact. On top of that, "diversified" crypto is often one bet: over the last 30 days our five coins behaved like 1.36 independent bets.

GRAIL runs an autonomous loop on OKX TR. It reads market data through the OKX Agent Trade Kit, and a deterministic quant engine (trend filter, HRP weights, volatility target, effective number of bets) decides BUY, SELL or HOLD for each coin. An optional LLM analyst can only shrink or veto a buy. Before any order, the agent commits keccak256(decision ‖ salt) to a GrailLedger contract on Avalanche Fuji, tied to its ERC-8004 identity (agent #1), then reveals it after the order. HOLDs are committed too, and unrevealed commits stay visible. Code enforces the limits: spot only, no leverage, no withdrawals, caps and a kill switch. Its first live order (BUY 2 USDT BTC, 17 Oct) is on chain. Anyone can re-check it: `npm run verify:cycle:1`.
```

### 5. GitHub linki (zorunlu)
```
https://github.com/WalAngeL06/grail-agent
```
Not: 18:30'da public yapılır; gizli pencerede açılıp README'nin göründüğü kontrol edilir.

### 6. Avalanche'da deploy edilen kontrat adresi (Bonus 2)
Tek adres istenirse:
```
0x1B5fcf6DeFf2F9375338A2C35932224522118851
```
Birden fazla satıra izin varsa:
```
Avalanche Fuji C-Chain (chain id 43113), source verified on Snowtrace:
GrailLedger (commit-reveal decision ledger): 0x1B5fcf6DeFf2F9375338A2C35932224522118851 - https://testnet.snowtrace.io/address/0x1B5fcf6DeFf2F9375338A2C35932224522118851#code
IdentityRegistry (ERC-8004, agent #1): 0x120A4E53A24ddd09991633b4Cb88c3feA6166721 - https://testnet.snowtrace.io/address/0x120A4E53A24ddd09991633b4Cb88c3feA6166721#code
ReputationRegistry (ERC-8004): 0x326671e1e2e80121C3Cd53a9b9fA5751a669596F - https://testnet.snowtrace.io/address/0x326671e1e2e80121C3Cd53a9b9fA5751a669596F#code
ValidationRegistry (ERC-8004): 0x1a9c67CA99391812D7b157748fB814F6c7dADf0C - https://testnet.snowtrace.io/address/0x1a9c67CA99391812D7b157748fB814F6c7dADf0C#code
First live order on chain: commit https://testnet.snowtrace.io/tx/0x16f2d1294cda0181cf94dd50f7cfccf90b449e2a7534b5eccb6aa5a1a96e9569 / reveal https://testnet.snowtrace.io/tx/0xae6537e9acc9e66accfe5d0fe61b2f9a858460d7c42cf3d25f0acafa378541f7
```

### 7. Proje sunumu (Google Slides / Canva linki) (zorunlu)
```
<SLIDES_URL>
```
Not: `docs/pitch/GRAIL-pitch.pptx` Google Drive'a yüklenir → "Google Slides olarak aç" → paylaşım "bağlantıya sahip herkes görüntüleyebilir".

### 8. Demo videosu (form sorarsa)
```
<VIDEO_URL>
```

---

## Formda ek soru çıkarsa

### Kullanılan teknolojiler
```
Agent & engine: Python 3.11+ (uv), NumPy, SciPy; deterministic quant engine (time-series momentum, HRP, volatility targeting, effective number of bets, Hurst-estimate and breakout-retest entry gates).
AI: Google Gemini Flash as an optional analyst that can only shrink or veto buys (code-enforced, hashed into the commitment).
Exchange: OKX Agent Trade Kit CLI (@okx_ai/okx-trade-cli 1.4.8), OKX TR spot.
Blockchain: Avalanche Fuji C-Chain; Solidity 0.8.20, Hardhat, OpenZeppelin 5, ethers v6; ERC-8004 registries (ava-labs/8004-boilerplate) + our GrailLedger commit-reveal contract; sources verified on Snowtrace.
Web: Vite, React 18, TypeScript, @noble/hashes (in-browser keccak256 verification), static GitHub Pages build.
```

### Avalanche'ı nasıl kullanıyorsunuz?
```
Avalanche is the agent's tamper-proof track record, not a log written after the fact. Before every order, the agent commits keccak256(canonical decision JSON ‖ random salt) to our GrailLedger contract on Fuji; after the order it reveals the decision, the salt and the OKX order id, and the contract rejects any reveal that doesn't match the commit. HOLD decisions and practice-mode cycles are committed too, and the practice/live flag is inside the hash. The contract allows one commit per cycle, counts commits and reveals separately, and only accepts writes from the agent registered in the ERC-8004 IdentityRegistry (agent #1). Anyone can verify any cycle without a wallet: the "Verify yourself" button in the dashboard (passed independent review), or `cd chain && npm run verify:cycle:1` from a terminal. A full-ledger audit (`npm run audit`) is also included; it requires an archive-capable RPC. On-chain counters at 16:47 (UTC+3): 42 committed, 42 revealed, 0 open.
```

### OKX Agent Trade Kit'i nasıl kullanıyorsunuz?
```
The OKX Agent Trade Kit CLI is the agent's only link to OKX TR. Data: confirmed 1H candles, tickers, instrument rules and the account balance, through a closed allowlist of read queries (profile "grail", site tr, JSON output). Orders: USDT spot market/limit orders only, in cash mode; market buys are quote-sized with banAmend so the exchange can't enlarge them; each order has a client id in a persistent journal, and an unclear result is queried by id, never resent. The API key has Read + Trade only (no withdraw), and the code has no withdrawal, transfer, leverage or account-settings calls. First live order: 17 Oct 2026 15:37 (UTC+3), BUY 2 USDT of BTC-USDT, filled, OKX order id 4017748393474314240.
```

### Agent kimliği
```
ERC-8004 agent #1 (GRAIL-01) on Avalanche Fuji, IdentityRegistry 0x120A4E53A24ddd09991633b4Cb88c3feA6166721
```

---
Kontrol listesi (göndermeden önce): yer tutucular dolu · GitHub public ve gizli pencerede açılıyor · sunum linki "bağlantıya sahip herkes" · video oynuyor · Snowtrace linkleri açılıyor · gönderim onayının ekran görüntüsü alındı.
