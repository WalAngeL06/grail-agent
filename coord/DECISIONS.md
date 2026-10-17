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
OKX TR katılımcılara gerçek bakiye verdi; emirler canlı hesapta. Erişim: `~/.okx/config.toml` → `grail` profili (alt hesap API key, Read+Trade, Withdraw yok).
- Kod yazan AI araçları emir veremez (MCP sadece `market`). Emri sadece agent kodu verir.
- `dry_run` bayrağı (varsayılan true): karar + zincir commit/reveal çalışır, emir simüle edilir. Canlıya kullanıcı geçirir; ilk canlı emri kullanıcı izler.
- Kod tarafında zorunlu guardrail: sadece spot, kaldıraç yok, sadece config coinleri, `max_order_usdt`, `max_total_deploy_usdt`, kill switch.
- Çekim/transfer/kaldıraç/hesap ayarı çağrısı yok. Bu, slayt 10'daki "yetkiyi daralt, harcamayı sınırla, izi tut, insan onayı" ilkesinin karşılığı ve sunumda gösterilir.

## D-008 · Yön sinyali, çökme-güvenli reveal, "Kendin Doğrula" (contracts 0.3)
- Engine yön sinyali: trend filtresi (time-series momentum) + HRP/vol hedefi ile hedef ağırlık; karar = hedef ile mevcut farkı
  (`min_order_usdt` bandı, `max_order_usdt` tavanı). Yeni config alanı yok. Z-skoru/kırılım vetosu gibi ek sinyaller bugün kapsam dışı.
- Salt + payload commit'ten ÖNCE `runtime/pending/`'e yazılır; açılışta açıkta kalan commit'ler reveal edilir.
- state.decisions[]'e `commit_hash`, `payload_utf8`, `salt_hex` eklendi (eklemeli değişiklik; okuyucular bilinmeyen alanda çökmez).
- UI'da "Kendin Doğrula": tarayıcı keccak256(payload‖salt) hesaplar, zincirdeki commit'le karşılaştırır.
- Kaynak: Gemini eleştirisinden alınan 3 fikir; "4. jüri sorusu brief'te yok" iddiası yanlıştı (BRIEF'te vardı).

## D-009 · Claude Max'i ana kas yap; Antigravity QA/yedek; bulut kredisi; LLM analist
- Claude Max en bol kota: engine (Opus 5.5, high) + web (Sonnet 5.5, medium) + T-007 analyst (Opus). UI tasarımı Claude Design ile (~14:00).
- Antigravity UI sahibi değil: tarayıcı testi (`coord/reviews/ui-*.md`) ve Claude limiti biterse web'in yedek sahibi.
- 250$ "bulut oturumu kredisi" (son: 5 Kasım) = Claude Code bulut oturumları; API kredisi DEĞİL. Sırsız işler için ek işçi:
  inceleme, test yazma, README, mock state ile UI varyantı. Branch `cloud/<görev>`; `.env`/OKX/cüzdan erişimi yok.
- Agent içindeki LLM (T-007) için ücretsiz katmanlı API (varsayılan Gemini Flash, `LLM_API_KEY`); yoksa analist atlanır, döngü etkilenmez.
- Model/efor: kritik (engine, kontrat, guardrail) high; UI/dokümantasyon medium. Takılınca önce efor, sonra model.
- Bağlam: 1 görev = 1 chat; görev ortasında şişerse `/compact <neyi koru>`.

## D-010 · T-001 kullanıcı onayları: risk bütçesi ve 48 bar pencere (contracts 0.4)
- Kullanıcı `risk_budget_pct` yorumunu kabul etti: coin başına yıllık volatilite katkısı tavanı. Hedef ağırlık `w_i` (0–1), yıllık coin volatilitesi yüzde cinsinden `vol_i_pct` olmak üzere `w_i * vol_i_pct <= risk_budget_pct`; örnek config'te tavan %10.
- Kullanıcı varsayılan `lookback_bars` değerinin 168 → 48 olmasını onayladı. `candle_bar = "1H"` ile 48 saatlik trend için 49 kapanış istenir. Engine'in 13:10 veri kontrolünde 168 bar bütün coinlerde HOLD üretmişti; pencere değişikliği sonraki veride BUY garantisi vermez.
- `contracts/VERSION` 0.3 → 0.4; config ve state örneklerinin `contract_version` alanları 0.4. Alan biçimleri ve karar/hash sözleşmesi aynı; etkilenen agents, engine ve web rolleri sonraki başlangıçta `git merge main` ile alır.
- T-001 engine uygulaması `role/engine@f8a7dc9` üzerinden main'e alınır. `dry_run: true` korunur; canlı emir yetkisi verilmedi.

## D-011 · Analist payload'ı ve UI alanları; onaylı ATK sorgu sınırı (contracts 0.5)
- Kullanıcı T-004 `role/docs@1b61651`, T-007 `role/engine@98ae2ba`, T-005 v1 `role/web@3cce8c2` teslimlerinin bu sırayla, kontrol komutları çalıştırılarak merge edilmesini istedi. T-007'nin `engine/pyproject.toml` test bağlantısı bu teslimin parçası olarak kabul edildi. T-002 `role/agents@1e36e99` yalnız Claude R-002 APPROVE sonrasında merge edilecek.
- KABUL: karar başına opsiyonel `llm_note` (ASCII, tek satır, ≤160) ve `llm_flag` (`skipped|approved|reduced|vetoed|exempt`). Varsa ikisi de payload/hash'e girer. LLM sadece BUY'ı aynı tutar, küçültür veya HOLD'a çevirir; SELL miktar/yön değişmeden `exempt` geçer. Sağlayıcı yok/hatalıysa BUY/HOLD `skipped`, SELL yine `exempt`.
- T-006 sırası: `decide → analyst.review_payload → son payload + salt kalıcı kayıt → commit → ATK emir → reveal`. Commit/reveal ve emirler aynı analist çıktısını kullanır; kurtarmada LLM yeniden çalıştırılmaz. `grail-analyst` yerel paket bağımlılığı T-006'da agents sahibi tarafından eklenir.
- KABUL: `state.config.max_order_usdt`, `max_total_deploy_usdt`, `kill_switch_drawdown_pct`; `state.chain.agent_id`, `identity_registry`. Kimlik deploy doğrulanana kadar null; agent_id ondalık string, registry adres string. Kaynak etkin config + chain deploy çıktısıdır.
- RED: ayrı `ledger[]`. Sicil `decisions[]` içinden cycle_id'ye göre gruplanır; chain sayaçları korunur.
- Kullanıcı onaylı T-002 istisnası kartına işlendi: kurulu CLI 1.4.8'de `--read-only` yok; yerine kapalı sorgu izin listesi (`market ticker/candles/instruments`, `account balance`, `spot get/orders`) kullanılır. `grail` profili, TR site/host ve JSON çıktı sabit; izin dışı sorgu reddedilir. T-002'nin okuduğu sürüm 0.4 olarak düzeltilir; 0.5 döngü entegrasyonunda alınır. Canlı emir onayı verilmedi.
- `contracts/VERSION` ile config/state sürüm alanları 0.5. Engine/analyst/agents/web bir sonraki başlangıçta `git merge main` ile alır. T-005 v1'in gerçek state/Fuji doğrulaması bekliyor; 13:30 deploy kapısı kaçtı, chain Codex hesap 2 13:48'de başladı.

## D-012 · T-008 teslim taslakları; README köke taşıma kapısı
- Kullanıcı `role/web@9eb1b52` (v0.5 UI alanları) ve ardından `role/docs@d1e8ea0` (T-008 teslim metinleri) merge + push istedi. T-008 kartı bu teslimde açılır; contracts sürümü 0.5 kalır.
- T-008 ilk teslimi docs/ altında dört İngilizce taslaktır: form açıklaması, README-draft, 10 slayt pitch, 2:00 demo senaryosu. Adresler ve henüz doğrulanmamış çalışma/ölçüm/komutlar açık yer tutucuyla kalır.
- **README-draft.md köke taşıma kararı: 17:00 freeze SONRASI ve gerçek adresler doldurulup doğrulandığında.** Docs sahibi taslağı günceller ve RAPOR eder; köke taşıma integrator tarafından yapılır. Bu merge'de kök README değiştirilmez.

## D-013 · R-003 koşullu onay; çok emirli reveal ve kalıcı cycle_id (contracts 0.6)
- Kullanıcı `role/review@a6044d7` R-003 incelemesinin merge + push'unu istedi. T-003 APPROVE koşullu; BLOCKER/MAJOR yok, yeniden deploy gerekmez. İnceleme yalnız `coord/reviews/T-003.md` + reviewer handoff'u değiştirir.
- R-003-2: `decision.md` reveal `okxOrderId` alanı kanonik JSON `{"BTC-USDT":"<ordId>|simulated|unknown"}` olarak tanımlandı; `|` alternatifleri gösterir. Çok coin alfabetik/boşluksuz eşleme, emir yoksa `""`; normal/kurtarma aynı biçim. Emir durumu sorgulandıktan sonra reveal; sonuç hash'e girmez. Kullanıcı bu biçimi agents'a verdi.
- R-003-3: T-006 kabulü kalıcı ve monoton cycle_id ister; restart, tamamlanmış pending kayıtlarının silinmesi ve dry_run/canlı geçişi aynı agent için kimlikleri yeniden kullanmaz. Uygulama ve ağsız test kanıtı agents sahibinin T-006 tesliminde aranır.
- `contracts/VERSION` ve config/state örnekleri 0.5 → 0.6. ABI, payload/hash kuralı ve golden testVector değişmedi. `chain.json.contractVersion=0.5` deploy anının kaydı olarak korunur; adres/kimlik/bytecode değişmez. Etkilenen agents/web rolleri `git merge main` ile alır; ürün kodlarına bu teslimde yazılmaz.
- R-003-1/4 UI bağımsız doğrulama önerileri, R-003-5/6 opsiyonel metadata/deployBlock notları inceleme dosyasında korunur; bu merge'in koşulu değildir. Canlı mod için R-002-1 kapısı açık, dry_run=true.
