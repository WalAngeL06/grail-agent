# PROJECT STATE — tek yetkili durum (yazarı: integrator)

- Revizyon: r46 · 2026-10-17 17:45 Europe/Istanbul. Önceki ayrıntı: coord/archive/STATE-r40-20261017.md (daha eski r26/r17 arşivleri korunur).
- İlk CANLI:15:37 cycle2 BUY BTC2USDT filled, OKX4017748393474314240. Sürekli döngü dry_run=true; gerçek Fuji commit/reveal. Integrator runner/emir/tx başlatmaz.
- Sözleşme: VERSION0.6.2; yalnız opsiyonel/hash dışı metrics.signals[inst].ou eklendi. Config/payload/state contract_version0.6,chain deploy0.5/ABI/hash aynı. sleeve kullanıcının kesinleştirdiği momentum|mean_reversion|none metin enumudur; %25 tavan engine kodunda/testte, ek bütçe alanı yok.
- Bu teslim: kullanıcı web95d9eda→review1feb9ed→engine88f00f3 sıralı merge/push istedi. Başlangıçmainfd0d200 temiz/origin ile aynı; üç exact hedef uzak dallardan erişilebilir. Web bu adımda alınıyor; review/engine sonraki iki ayrı merge. Önceki dört merge kanıtı D-022'de.
- Verify R-010 GO yalnız webc1c2361/chain23a81aa. **R-011 KAPANDI, audit jüriye GO**: kullanıcı/planner public RPC48/48 MATCH,Unopened0,Mismatch0,LIVE1,exit0; integrator54 test/typecheck PASS. Kendi audit tekrarı61→62 yeni cycle nedeniyle INCOMPLETE/exit1; beklenen fail-closed, tam rapor yazılmadı. Bunlar ayrı snapshot/kanıtlardır.
- **T-017 kullanıcı kararıyla AÇIK merge GO:** R-012/review1feb9ed tam88f00f3 için APPROVE koşullu,18:10merge+AÇIK GO. R-012-1 kabul edilen bilinen davranış: ranging+anlamlı coinde MR çıkışı momentumdan gelen pozisyonu da satabilir (risk azaltıcı); R-012-2 MINOR tutma bandı düşüş SELL'ini bastırabilir. İnceleyen kullanıcı/planner kararıyla role/review oldu (chain meşgul); aynı model ailesinde bağımsız oturum sınırı raporda açık. Merge sonrası restart agents sahibinde.
- Public kapısı: R-005 GO yalnız taranmış main9acec55/ref kümesi; son yayın SHA fark taraması hâlâ açık. Public ayarı/yayın/form/slides/video yüklemesi yapılmadı.

## Zaman kapıları
| Saat | Kapı | Durum/ölçüt |
|---|---|---|
| 13:30 | Fuji deploy | GEÇ:14:36 dört deploy+kimlik doğrulandı |
| 15:00 | Uçtan uca dry_run | GEÇTİ14:50; gerçek ATK+Fuji,5simulatedBUY |
| 16:50 | T-014 merge üst sınırı | GEÇTİ16:29 main6729fbb; önceki167/157/build ve merge sonrası157 |
| 17:00 | Feature freeze | yalnız T-017 kullanıcı istisnası; diğerleri hata düzeltme+UI |
| 17:50 | T-017 engine push | test+handoff+exact commit+push; yetişmezse dışarıda |
| 18:00 | Yedek demo videosu | kayıt hazır olmalı; kanıt/link açık |
| 18:10 | T-017 merge üst sınırı | chain bağımsız GO+integrator kontrolleri; yetişmezse dışarıda |
| 18:45 | Teslim formu | GitHub/sunum/BuilderHub e-postası ve gönderim kanıtı |
| 19:00 | Teslim kapanır | |

## Görev panosu
| Görev | Başlık | Sahip | Durum | Kanıt/bağımlılık |
|---|---|---|---|---|
| T-001 | Quant engine+golden testler | engine | INTEGRATED | önceki sözleşme/test kanıtı r40 arşivi |
| T-002 | ATK veri+guarded emir | agents | INTEGRATED | R-002/R-004b kapıları işlendi |
| T-003 | ERC-8004+GrailLedger+Fuji deploy | chain | INTEGRATED | deploy0.5/ABI/hash aynı |
| T-004 | UI brifi | docs | INTEGRATED | docs/ui-brief.md |
| T-005 | TR/EN UI+Motto+Rehber+Verify | web/QA | INTEGRATED95d9eda; Verify GO | integrator22test/build/public PASS; varsayılanTR,EN/TRkalıcı seçim |
| T-006 | Agent döngüsü+ilk canlı | agents | INTEGRATED | ilk canlıcycle2; sürekli çalışma dry_run |
| T-007 | LLM BUY azaltma analisti | analyst/agents | INTEGRATED; Gemini3.7 kanıtı alındı | agentsaf4106d cycle45/46ETHapproved; PID48008 salt okunur kontrolle çalışıyor |
| T-008 | README/form taslakları | docs | INTEGRATED9a0fb7f | link/team/ilk canlı cycle yönlendirmesi ve yeni R-011GO son hazırlık |
| T-009 | Engine İngilizce reason | engine | INTEGRATED | b7e294b |
| T-010 | Explorer kaynak+tek cycle doğrulama | chain | INTEGRATED; R-006 GO | dört verified/önceki gerçek MATCH |
| T-011 | Türkçe11 slayt | docs | INTEGRATED9a0fb7f |11slayt/11not; yalnız6/10değişti,PowerPoint render/görsel PASS |
| T-012 |30gün replay | engine | INTEGRATED | +2.03%,düşüş4.33%,220simulated; al-tut+8.81%/14.51% |
| T-013 | Sade UI metinleri | docs/web | INTEGRATED | R-007 ile eşleşti |
| T-014 | Hurst+entry gate | engine/agents | INTEGRATED; restart/sonuç kanıtı alındı |4a83bd8 rapor+af4106d cycle34/35/45/46; aynı barlarda5→1BUY/19.02→2.64USDT |
| T-015 | Sicil audit | chain | INTEGRATED; R-011 GO |6f19510;54test/typecheck; kullanıcı bağımsız48MATCH |
| T-016 | Türkçe FAQ+3dk runbook | docs | INTEGRATED9a0fb7f |12+1 soru; yeni R-011GO/video/link/prova son hazırlık |
| T-017 | O-U ortalamaya dönüş kolu | engine; R-012role/review | GO/AÇIK; merge sırada |88f00f3 kullanıcı talimatı; R-012-1bilinen davranış/-2MINOR;<=18:10 |
| R-002/R-003 | İlk adapter/chain incelemeleri | bağımsız reviewer | DONE; koşullar işlendi | r40 arşivi/kararlar |
| R-004/R-004b | Döngü/canlı kapı | bağımsız reviewer | DONE / APPROVE | ac96902; gerçek ilk canlı kullanıcı yaptı |
| R-005 | Public sır taraması | reviewer | GO (taranan kapsam) | son yayın SHA tekrar taraması açık |
| R-006 | T-010 inceleme | docs/reviewer | DONE / APPROVE | e77eaed; MINOR/INFO korunur |
| R-007 | UI matematik | engine/reviewer | DONE / INTEGRATED | c2a731b |
| R-009 | T-014 inceleme | reviewerClaudeMax | DONE / GO koşullu |8ef0449+87539f8 kullanıcıGO; Hurst tahmin sınırı korunur |
| R-010 | Web Verify | chain/reviewer | DONE / GO | c1c2361/23a81aa |
| R-011 | Audit RPC düzeltmesi | chain | DONE / GO; INTEGRATED |6f19510→main81356a1 push; planner48MATCH,integrator54test; moving-ledger fail-closed |
| R-012 | T-017 bağımsız inceleme | reviewer/ClaudeOpus, ayrı oturum | APPROVE koşullu; rapor merge sırada |1feb9ed;88f00f3,210/157test+400fuzz inceleyen kanıtı; kullanıcı AÇIK |

## Bu tur kanıtları
- Chain birleşik ağacı6f19510 ile birebir; staged fark yalnız chain/+kendi handoff'u.54test(6s)/typecheck PASS; diff --check temiz; diğer ürünler başlangıç1f57076 ile aynı. Yeni audit latest state ve fresh before/after sayaç kontrolüyle çalışır; canonical scan-head/event/hash/receipt kontrolleri korunur.
- Audit RPC seçimi CLI>GRAIL_AUDIT_RPC_URL>FUJI_RPC_URL>PublicNode; .env/signer yüklenmez. Canlı rapor chain/runtime/audit-latest.md(ignore); tracked deployments raporu16:06/16cycle örnektir. okxOrderId hash dışı ve fill kanıtı olmadığı açık.
- Kullanıcı bağımsız planner48/48MATCH/0açık/0mismatch/1LIVE/exit0 bildirdi. Integrator gerçek tekrarında before61/61→after62/62,scanned61/61; INCOMPLETE/exit1 ve rapor yok. Çalışan agent'ın yeni cycle'ı beklenen tamlık reddini tetikler; GO için başarılı snapshot ile karıştırılmaz.
- Önceki R-010 gerçekcycle1/2/3 ve38history inceleyen kanıtıdır; web helper CLI canonical blockHash/event-data kapsamının tamamını taşımaz. Son web22test/iki build önceki turdadır. Bu tur tarayıcı/sır taraması yok.
- Docs9a0fb7f actual merge farkı yalnız docs/+kendi handoff7dosya; çoklu merge-base nedeniyle üç-nokta diff'teki eski main kayıtları yeni yabancı yazım değil. Exact docs ağaç/diff--check PASS; diğer ürünlerchain81356a1 ile aynı. PPTX11slayt11not;8103126'ya göre yalnızslide6/10XML değişmiş; ikisi PowerPoint'te1280x720 render/görsel PASS.
- Engine4a83bd8 actual farkı engine/out/live-gates-today.md+.json ve kendi handoff'u; ürün kaynakları/test/ayarlar aynı. JSON/cohort/tutar/toplam kontrolleri PASS:22eski/17yeni aynıbar döngüsü,110/17BUY,418.44/44.88USDT. Cycle3–50 toplam48commit+48reveal/240karar sahibin dosya kanıtıdır; yeni bağımsız RPC kanıtı değil. PID48008python17:22 salt okunur süreç kontrolünde çalışıyor.
- Agentsaf4106d actual farkı3kanıtJSON+kendi handoff; kaynak/test/ayarlar değişmedi. ÜçJSON parse ve Gemini45/46koşul kontrolleri PASS; ikisinde4HOLD+1ETHsimulatedBUY/approved/errors0,modelgemini-3.7-flash,fallbackfalse. Anahtar okunmadı. Main'de uv run --frozen pytest -q --tb=short→157passed(15.45s). Receipt/hash doğrulaması sahip kanıtıdır, integrator RPC/fill tekrarı yapmadı.
- Bu tur web95d9eda birleşik ağacı exact/sınır/diff--check PASS; npm test22/22,normal/public build56modül708/754ms PASS. Yalnız web/+handoff değişti; diğer ürünlerfd0d200 ile aynı. DefaultTR/EN|TR/localStorage/motto/guide kaynakta doğrulandı; verifyLogic/verify/chain çekirdeği aynı. Tarayıcı/görsel QA sahip kanıtıdır; integrator bu tur tekrarlamadı.

## Bekleyenler / sınırlar
- Docs9a0fb7f R-011 NO-GO zamanındaki archive-RPC metnini içerir; exact hedef alınır, R-011 kapandıktan sonra README/FAQ/form/runbook metni docs sahibince güncellenmeli. İlk canlıcycle2; verify:cycle:1 simülasyoncycle1. Kök README D-012/link/doğrulama kapısında.
- Engine4a83bd8 ve agentsaf4106d rapor/kanıt teslimleri alındı; yeni ürün kodu veya yeni canlı fill yok. Yeni modelde cycle48timeout raporlanmıştır;45/46başarılı kanıt tüm çağrılar başarılı demek değildir. Tarihli dosya kanıtı ile mevcut PID durumu ayrılır.
- T-017 review1feb9ed ve engine88f00f3 sıradaki ayrı merge/push; main engine210/agents157 ve yeni replay'le web build doğrulanacak. R-012-1opsiyonel düzeltme bu exact hedefe eklenmez. Kullanıcı AÇIK kararı motor kolu içindir; dry_run/canlı kapısını değiştirmez. Agents merge sonrası döngüyü kendi yetkisiyle yeniden başlatır; integrator runner'a dokunmaz.
- Runtime/journal/pending/.env/anahtarlar ve worker korunur; integrator yeni runner başlatmaz/durdurmaz, OKX/tx göndermez. R-004/R-002 MINOR/NIT ve R-006 INFO'lar korunur.
