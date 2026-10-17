# Karar günlüğü (yazarı: integrator; yeni karar en alta)

## D-001 · Koordinasyon: dosya + kullanıcı rölesi, worktree başına bir rol
Araçlar birbirine mesaj atamaz. Her rol kendi worktree/branch'inde, kendi klasöründe yazar; `coord/STATE.md` tek yazarlı.
Yeniden değerlendir: iki rol aynı dosyaya ihtiyaç duyarsa → sahiplik integrator'da toplanır.

## D-002 · Stack
- engine + agents: Python 3.12 (uv ile; makinedeki 3.14 bazı bilimsel paketlerde wheel sorunu çıkarabilir). Her paket kendi `pyproject.toml`'u.
- engine sadece numpy / pandas / scipy kullanır (HRP için scipy kümeleme yeterli). Ağır optimizer (cvxpy vb.) yok.
- chain: Hardhat + TypeScript (Node 24 kurulu; Foundry bu makinede yok, Windows kurulumu zaman kaybı).
- web: Vite + React + TypeScript (web sahibi kütüphane seçimini kendi `web/package.json`'unda yapar). Veri kaynağı: `runtime/state.json` (sözleşme: `contracts/state.example.json`).
- Ağ: Avalanche Fuji (43113). Mainnet sadece vakit kalırsa.

## D-003 · Karar hash'i
`commitHash = keccak256(payloadBytes ‖ salt)`; payloadBytes = kanonik JSON (bkz. `contracts/decision.md`).
okxOrderId ve dolum fiyatı hash'e girmez; reveal'de ayrı alan. HOLD da commit edilir.
Commit başarısızsa emir verilmez (fail-closed).

## D-004 · Backtest motoru yok
Geçen hackathon dersi. Engine canlı/son veriden karar üretir; tarihsel kontrol gerekiyorsa küçük sabit veri ile basit vektörel tekrar.
