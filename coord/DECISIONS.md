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

## D-005 · Kimlik = rol + worktree; iki Codex hesabı
"GPT Plus 2" ayrı bir araç değil, ikinci hesapla açılan Codex'tir. Roller araç adıyla değil rol + worktree + branch ile ayrılır.
İki Codex hesabı aynı anda çalışacaksa her biri ayrı `CODEX_HOME` ile oturum açar. Integrator yedeği önce Codex · hesap 2.

## D-006 · Zincir tabanı ERC-8004 boilerplate; ATK yapılandırması (workshop slaytı, 17.10)
- Avalanche workshop'u ERC-8004 tabanlı agent'ı Fuji'de çalıştırmayı gösterdi (github.com/ava-labs/8004-boilerplate, Hardhat).
  Önerilen 1. proje yönü bizimkiyle aynı: "ATK demo'da işlem yapan agent'ı ERC-8004 ile kaydet, karar ve sonuçlarını zincire yaz".
- Karar: chain = boilerplate registry'leri (Identity/Reputation/Validation) + bizim GrailLedger (commit-reveal). Agent IdentityRegistry'de kayıtlı;
  GrailLedger sadece kayıtlı agent'ı kabul eder. Boilerplate'in frontend/backend'i kullanılmaz.
- Farkımız: diğer takımlar "sonucu zincire yaz" yapacak; biz kararı emirden ÖNCE commit ediyoruz (sonradan değiştirilemez) + quant engine.
- Uzatma (vakit kalırsa): ikinci bir "risk bekçisi" agent (slayttaki 2. yön) kararları ValidationRegistry'de doğrular.
- ATK: `@okx_ai/okx-trade-cli` / `okx-trade-mcp`; site `tr`; anahtarlar `~/.okx/config.toml` profilinde (`demo = true`), `.env`'de değil.
- Jüri sorusu listesi (slayt 16): canlı mı çalışıyor; yetki/limitler; kimlik ve geçmiş doğrulanabilir mi; hata/beklenmedik girdide ne yapıyor;
  problem ve hedef kullanıcı. Demo ve UI bu beş soruya cevap verecek şekilde kurulur.

## D-007 · Gerçek para (OKX TR hackathon bakiyesi) · contracts 0.2
OKX TR katılımcılara gerçek bakiye verdi; emirler canlı hesapta. Demo profili yok, erişim `okx auth login` (site tr).
- Kod yazan AI araçları emir veremez (MCP sadece `market`). Emri sadece agent kodu verir.
- `dry_run` bayrağı (varsayılan true): karar + zincir commit/reveal çalışır, emir simüle edilir. Canlıya kullanıcı geçirir; ilk canlı emri kullanıcı izler.
- Kod tarafında zorunlu guardrail: sadece spot, kaldıraç yok, sadece config coinleri, `max_order_usdt`, `max_total_deploy_usdt`, kill switch.
- Çekim/transfer/kaldıraç/hesap ayarı çağrısı yok. Bu, slayt 10'daki "yetkiyi daralt, harcamayı sınırla, izi tut, insan onayı" ilkesinin karşılığı ve sunumda gösterilir.
