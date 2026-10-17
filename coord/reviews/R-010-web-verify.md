# R-010 — Web zincir doğrulama incelemesi

> **Güncel karar — c1c2361: Verify jüriye gösterilebilir: GO.** Aşağıdaki ilk inceleme 0197fe9 için tarihsel NO-GO kaydıdır; güncel sonuç en sondaki **Tekrar inceleme** bölümündedir.

**Verify butonu jüriye güvenle gösterilebilir: NO-GO.**

Karar: **REQUEST_CHANGES — 3 MAJOR, 2 MINOR.** Gerçek cycle 1/2/3 için ABI ve hash doğru; hata ve olumsuz doğrulama sonuçları son yeşil karara doğru taşınmıyor. Kriptografik hash uyuşmazlığı bulunmadı.

- İnceleyen: chain / Codex hesap 2, kullanıcının bu tur verdiği inceleyici yetkisiyle; branch `role/chain`.
- Son fetch hedefi: `origin/role/web@0197fe93fd8433d75090e6186d19f440d7195f77` (kısaltma `0197fe9`). İlk aday `b00212e` idi; inceleme sırasında web ilerledi, son adayın VerifySheet değişikliği alınıp bütün kontroller yeniden çalıştırıldı. Aşağıdaki satırlar **0197fe9** içindir.
- Okunan sözleşme: yerel main VERSION **0.6.1**; hedef web'in VERSION'ı 0.6, deployment 0.5. 0.6.1 belge/eklemeli metrik açıklaması; bu incelemeyi etkileyen ABI, hash ve sonuç eşlemesi değişmiyor.
- Ürün kodu değiştirilmedi. Yeni deploy, zincir tx, OKX veya runner çağrısı yok. R-010 commit'i yalnız bu rapor ve chain handoff'udur. Dalda önceki T-015 audit teslimi ayrıca vardır; onun bağımsız inceleme/merge kapısı bu raporla kapanmaz.

## Çalıştırılan kontrol ve yöntem

`git fetch origin` ve hedef SHA kontrolü yapıldı. Node **v24.15.0**, TypeScript **5.9.3** ile hedef SHA'daki dosyalar `git show <SHA>:<dosya>` kullanılarak belleğe alındı. `transpileModule` + CommonJS/React JSX + VM ile gerçek `chain.ts`, `verify.ts`, `format.ts` ve `VerifySheet.tsx` çalıştırıldı. Kurulu web bağımlılıkları salt okunur kullanıldı; paket kurulmadı.

- ABI: `contracts/chain.json` ABI'siyle ethers Interface referansı; dynamic alan uzunlukları 0/1/31/32/33/97 bayt için **6/6** decode karşılaştırması geçti.
- Gerçek Fuji: web `readDecision` / `readReveal` / `computeCommit` fonksiyonları PublicNode üzerinden cycle **1, 2, 3** için çalıştırıldı. Ethers ABI decode, mevcut `verifyCycle(..., {commitTx,revealTx})` ve `chain/deployments/audit-latest.md` ile **3/3 MATCH**. Üç reveal receipt'i status=1.
- UI: kontrol edilen useState/useEffect yaşam döngüsüyle gerçek VerifySheet fonksiyonu çalıştırıldı, `phase=done` sonrasındaki JSX ağacı ve CheckRow işaretleri okundu. Aşağıdaki **9 senaryonun 6'sında hatalı yeşil sonuç** üretildi. Bu bir Node bileşen testidir; gerçek tarayıcı/DOM veya CORS testi olduğu iddia edilmez.
- Ledger: web `readLedgerHistory` fonksiyonu, deployBlock 59595834'ten itibaren 1000 blokluk pencerelerle bağımsız PublicNode getLogs taramasıyla karşılaştırıldı. Sonraki cache karşılaştırması aşağıdadır.
- Varsayılan Fuji RPC yolu ile cycle 1 `readDecision` da bu tur doğru hash döndürdü. RPC kesintisi ve HTTP 429 ayrı deterministik fixture'lardır; gerçek default RPC'nin bu tur hata verdiği iddia edilmez.
- İlk sandbox Node→git alt sürecini EPERM ile engelledi; aynı salt okunur harness izinli çalıştı. İlk harness'in Unicode başlık ölçümü düzeltilip test tekrarlandı; nihai sonuçlarda `result ok` ve `Match` metni birlikte kontrol edildi. Geçici kanıt dosyası temizlendi.
- Web build, görsel tarayıcı testi ve mevcut kaynak doğrulama/publish komutları çalıştırılmadı; R-010 kontrolü ABI/hash/UI karar mantığı/event okumasıdır.

## 1. ABI ve gerçek hash karşılaştırması

`GrailLedger.sol` ve chain.json ile getter sırası `bytes32 commitHash, uint256 committedAt, bool committed, bool revealed` doğru. `web/src/chain.ts:97` calldata'yı iki uint256 word ile doğru kuruyor. `decisions` selector **0xfd040ac7**; `revealDecision(uint256,uint256,bytes,bytes32,string)` selector **0x2ae20342**.

`chain.ts:126` sonrası beş word'lü head ve gövde başlangıcına göre byte offset çözümü doğru: agentId, cycleId, payload offset, bytes32 salt, okxOrderId offset. Gerçek üç calldata'da payload baytları, salt ve okxOrderId ethers decode ile aynı. Tam uint256 aralığı için Number kısıtı R-010-5'tedir; mevcut 1/2/3 için kodlama/çözüm birebirdir.

`web/src/verify.ts:15` UTF-8 payload baytlarının arkasına salt baytlarını ekleyip keccak-256 hesaplıyor; `verify-cycle.ts` ile aynı sıradır. Payload yeniden JSON serialize edilmedi.

| Cycle | Payload bayt | Mod | Web = ethers = verifyCycle = audit commitHash |
| --- | --- | --- | --- |
| 1 | 1675 | dry_run=true | 0xd9064ac4000cae4637a50cd3f25b4ae7c9612e9c9600772f7468533371785a83 |
| 2 | 423 | LIVE / dry_run=false | 0x7d8116a5636537e03e3b875d2a25b149760b0510d67e0ec00ba61f2a7b070e30 |
| 3 | 2182 | dry_run=true | 0xf428098883ff2f0398cb846ab80548b2807f680da3c2b586ff67e521a77e649a |

Cycle 2 calldata'sındaki sonuç `{"BTC-USDT":"4017748393474314240"}`. Cycle 1 ve 3'te beş coin `simulated`. Burada borsa fill kontrolü yapılmadı.

Tekrar üretim girdileri: audit-latest.md içindeki cycle 1/2/3 commit/reveal tx hash'leri; web `readReveal` ile alınan payload/salt, `readDecision` sonucu ve `computeCommit`; aynı tx kimlikleriyle `verifyCycle`. Gerçek verilerde üç karşılaştırma da eşleşir; aşağıdaki bulgular bu doğru hash fonksiyonundan kaynaklanmıyor.

## 2. Olumsuz senaryoların gerçek bileşen çıktısı

Temel fixture, gerçek cycle 1'in payload/salt/commitHash/karar satırlarıdır. Ağ hata testinde bu üç alan state fallback'inde korunur. Diğer testlerde yalnız tabloda belirtilen girdi değiştirilir.

| Girdi / koşul | Beklenen | Gözlenen final JSX | Durum |
| --- | --- | --- | --- |
| Geçerli cycle 1, iki başarılı okuma | Match | `result ok`, Match | PASS |
| Primary ve fallback fetch reddediliyor | Doğrulanamadı | `result ok`, Match; Fuji hata satırı da var | FAIL |
| Primary HTTP 429/HTML; fallback de 429 | Doğrulanamadı | `result ok`, Match; 429 hata satırı da var | FAIL |
| agentId undefined, RPC çağrısı yok | Doğrulanamadı | `result ok`, Match | FAIL |
| agentId=2; getter committed=false | Mismatch / kayıt yok | `result bad`, Mismatch | PASS |
| cycleId=2; payload cycle_id=1 | Mismatch | `result bad`, Mismatch | PASS |
| Beklenen agentName=OTHER-AGENT; payload GRAIL-01 | Mismatch | Kimlik satırı kırmızı; final `result ok`, Match | FAIL |
| Reveal calldata agent=99/cycle=99, to=0x0; doğru cycle1 payload/salt, farklı order sonucu | Reveal reddedilsin | `result ok`, Match; FAKE-LIVE order metni gösterildi | FAIL |
| Ekrandaki ilk karar SELL/999, sealed payload aynı | Mismatch | Kırmızı satır uyarısı var; final `result ok`, Match | FAIL |

## Bulgular

### R-010-1 — MAJOR — Zincir okunamadığında state içi tutarlılık yeşil on-chain Match sayılıyor

- Yer: `web/src/components/VerifySheet.tsx:35`, `:46`, `:63`, **`:86`**, `:196`; fallback `web/src/chain.ts:56`.
- Tetik: Geçerli payload/salt/hash state'te mevcutken primary RPC ve Routescan fallback başarısız olsun. Aynısı 429 sonrası ve agentId hiç verilmediğinde de olur.
- Beklenen: On-chain okuma tamamlanmadığı için son durum **doğrulanamadı / retry**; yerel hash tutarlılığı ayrı bilgi olabilir.
- Gözlenen: catch sadece chainErr'i doldurur; onchain=null kalır. Verdict `(onchain && !matchChain)` koşulu null olduğunda olumsuz sayılmaz; chainErr ve başarılı zincir okuması zorunlu değildir. Nihai başlık **“Match — you didn't have to trust us”** ve yeşil `result ok` olur. Küçük Fuji hata satırı ve “state.json only” açıklaması yeşil iddiayı ortadan kaldırmaz. Son aday, state hash satırına da bu durumda yeşil tik ekliyor (`:150`).
- Kanıt: İki endpoint unavailable ve 429 fixture'larında chainErr dolu, hiçbir on-chain hash alınmamış, final Match=true. agentId undefined testinde **sıfır RPC çağrısına** rağmen aynı sonuç.
- Kapanış ölçütü: Zincir kanıtı alınmadan on-chain Match üretilmemeli; primary/fallback hata ve eksik kimlik fixture'ları yeşil sonuç verememeli.

### R-010-2 — MAJOR — Bilinen kimlik ve ekran satırı uyuşmazlıkları nihai sonucu düşürmüyor

- Yer: `web/src/components/VerifySheet.tsx:81`, `:83`, **`:88`**, `:203`, `:264`; satır karşılaştırması `web/src/verify.ts:36`.
- Tetik A: Aynı gerçek cycle 1 için beklenen agentName'i OTHER-AGENT yap. Tetik B: payload'ı değiştirmeden ekran kararının action/size alanlarını SELL/999 yap.
- Beklenen: Yanlış agent veya payload ile uyuşmayan karar satırında nihai Mismatch. Kullanıcıya “All ... decisions ... exactly what was sealed” denmemeli.
- Gözlenen: A'da `agentOk=false` ve kimlik satırı kırmızı; B'de `payloadMatchesRows(...).ok=false` ve altta kırmızı metin var. **İkisi de verdict koşuluna girmez**, nihai başlık yeşil Match kalır. Numeric agentId=2 ve payload cycle_id=1/cycleNo=2 testleri ise doğru biçimde Mismatch verdi; bu bulgu onların hatalı çalıştığını iddia etmez.
- Kapanış ölçütü: Kimlik ve gösterilen satırların başarısız kontrolleri nihai olumlu kararla birlikte gösterilememeli. İki fixture ayrı regresyon girdisi olmalı.

### R-010-3 — MAJOR — Reveal'ın hedefi/kimliği/başarısı bağlanmadan emir sonucu güvenilir kabul ediliyor

- Yer: **`web/src/chain.ts:121`**, `:135`, `:140`; `web/src/components/VerifySheet.tsx:39`, `:63`, `:84`, `:236`.
- Tetik: State'teki reveal_tx yanlış bir işleme işaret etsin. Dönen calldata doğru cycle1 payload/salt'ını taşısın, fakat çağrı agentId/cycleId=99/99, hedef adres 0x0 ve okxOrderId `{"BTC-USDT":"FAKE-LIVE"}` olsun. Bunlar RPC fixture'ıdır; gerçek zincire hatalı işlem gönderilmedi.
- Beklenen: Çağrı hedef ledger/agent/cycle ile eşleşmediğinden doğrulanmış reveal ve onun emir sonuçları kabul edilmesin.
- Gözlenen: `readReveal` agentId/cycleId/to alanlarını decode ediyor, ama VerifySheet bunları kontrol etmiyor. Yalnız `eth_call` ve `eth_getTransactionByHash` çağrılıyor; receipt status, canonical block veya DecisionRevealed event eşlemesi yok. Fixture tüm hash tikleriyle yeşil Match verdi ve **FAKE-LIVE** sonucu `OKX order` olarak gösterildi.
- Etki sınırı: Doğru payload/salt, gerçek stored hash ile eşleştiği için bu test hash'in kırıldığını göstermez. **okxOrderId commit hash'ine girmez**; yanlış bir transaction'daki order sonucu hash kontrolüyle doğrulanamaz. Receipt sorgulanmadığından pending/reverted işlem de başarılı reveal'dan ayırt edilmiyor. Bu tur gerçek bir reverted tx bulunduğu iddia edilmez.
- Kapanış ölçütü: Receipt/canonical blok, ledger hedefi, çağrı agent/cycle ve reveal event/storage eşlemeleri doğrulanmalı; yalnız doğru preimage bilmek emir sonucunu doğrulanmış yapmamalı. Mevcut verify-cycle.ts bu kontroller için karşılaştırma kaynağıdır.

### R-010-4 — MINOR — Event geçmişi önbellekte kalabiliyor ve eksikliği arayüze taşınmıyor

- Yer: **`web/src/chain.ts:178`**, `:188`; hata görünürlüğü `web/src/screens/Ledger.tsx:197`, `:203`, `:126`.
- Gerçek kanıt, 16:20:44 Europe/Istanbul: snapshot **59600491**, on-chain commitCount=**25**. Orijinal web sorguları **23** döngü verdi; her iki HTTP yanıtı `CF-Cache-Status: HIT`, `Age: 192`. Sadece request URL'ine cache-bust eklenince aynı web decode fonksiyonu **25** döngü verdi (`MISS`); cycle 24 ve 25 geldi. Ürün kodu değiştirilmedi.
- İlk 16 audit döngüsü orijinal sonuçta da tam; ilk 16:17 karşılaştırmasında hem bağımsız tarama hem web 23 döngü ve aynı hash/tx/payload/okxOrderId verdi. Dolayısıyla kalıcı veri kaybı/ABI event decode hatası değil, somut bir güncellik farkı var.
- Beklenen: Tam geçmiş iddiasında güncellik/tamlık kontrolü veya görünür eksik/stale durumu.
- Gözlenen: GET sorgusunda önbellek atlama yok; log sayıları canlı sayaçlarla eşleştirilmez. Ayrıca load reject handler'ı hatayı yutar; başarısızlıkta loading metni veya eski liste sessizce kalabilir. Cache-bust dışındaki bu hata gösterim sonucu kod akışından değerlendirilmiştir, gerçek bir browser network arızasıyla ayrıca test edilmedi.
- Kapanış ölçütü: Güncel kaynak okuması ve sayaç/tamlık kontrolü; hata veya eksik liste görünür olmalı. Büyük veri/pagination sınırında runtime testi yapılmadı.

### R-010-5 — MINOR — Solidity uint256 cycleId, Number'a dönüşünce birebir korunmuyor

- Yer: **`web/src/chain.ts:97`**, `:99`, `:136`, `:197`, `:200`; `web/src/state.ts` Cycle.cycle_id number.
- Tetik/kanıt: Solidity için geçerli cycleId **9007199254740993** Number'a dönüştürülüp gerçek readDecision fonksiyonuna verilince oluşan calldata, ethers decode'da **9007199254740992** çıktı.
- Beklenen: uint256 kimliği kayıpsız taşınsın veya desteklenmeyen aralık açık hata versin.
- Gözlenen: `BigInt(cycleId)` zaten yuvarlanmış Number'ı alır. Reveal ve history'deki Number dönüşümleri de aynı sınırı taşır; history Map anahtarları çakışabilir. Mevcut 1–25 döngüler bu sınıra yakın değildir; mevcut üç gerçek hash testi etkilenmedi.
- Kapanış ölçütü: Cycle ID için kayıpsız temsil veya Number.isSafeInteger aralık reddi; ABI uyumluluğu tam uint256 diye sunulmamalı.

## Sonuç

**Verify butonu jüriye güvenle gösterilebilir: NO-GO.** Gerçek kayıtların hash'leri doğru, fakat bir doğrulama butonu başarısız/eksik kontrolü yeşil başarıya çevirememeli. R-010-1/2/3 kapanıp aynı olumsuz senaryolar son web SHA'sında tekrar geçmeden GO verilmez. Düzeltme sahibi web; bu inceleme ürün kodunu değiştirmedi.

## Tekrar inceleme — c1c2361

2026-10-17 16:43 Europe/Istanbul · chain / Codex hesap 2.

**Verify jüriye gösterilebilir: GO. Karar: APPROVE — incelenen düzeltme hedefi c1c236128713e9d4e4e82a9012d9e5afcc4f9af4.** Önceki beş bulgunun tekrar üretim koşulları bu SHA'da karşılandı; önceki NO-GO bu hedef için kaldırıldı. Sonuç kodun ileride değişecek sürümlerine otomatik onay değildir.

### Bağımsız kontroller

- `git fetch origin` → `origin/role/web` tam olarak c1c2361. Testten önce ve sonra web worktree HEAD'i aynı; test/package/verdict kaynaklarında çalışma kopyası farkı yok.
- Hedef web worktree'de **`npm test` → 22 test, 22 pass, 0 fail, exit 0**. İlk sandbox denemesinde test runner spawn EPERM verdi; izinli aynı komut geçti. Bu testler saf `decideVerdict` fonksiyonunu kapsıyor; aşağıdaki bağımsız kontroller ayrıca gerçek chain fonksiyonlarını ve bileşenleri çalıştırdı.
- Önceki incelemenin sabit-SHA Node/TypeScript/VM yöntemiyle gerçek `VerifySheet.tsx`, `chain.ts`, `verify.ts`, yeni `verifyLogic.ts` ve `Ledger.tsx` çalıştırıldı. Hook yaşam döngüsü ve tamamlanmış JSX ağacı denetlendi; Result alt bileşeni de gerçekten yürütüldü. Ledger'ın Vite ortam değeri harness'te test modu olarak sağlandı; ürün dosyaları değiştirilmedi.
- **9 olumsuz VerifySheet senaryosunun tamamı beklenen sonuca geçti; hiçbirinde `result ok` yok.** Ayrıca eski/eksik history ve history bağlantı hatası için iki Ledger fixture'ı ile büyük ID kontrolü çalıştırıldı.

| Senaryo | c1c2361 sonucu | Yeşil Match | Ek kanıt |
| --- | --- | --- | --- |
| Primary + fallback RPC kesintisi | Unverified | Hayır | Retry var |
| Primary HTTP 429/HTML + fallback 429 | Unverified | Hayır | Retry var |
| agentId yok | Unverified | Hayır | RPC çağrısı yok, Retry var |
| Yanlış numeric agentId=2 | Mismatch | Hayır | Getter/reveal kimliği reddediliyor |
| cycleNo=2, payload cycle_id=1 | Mismatch | Hayır | Yanlış check-in reddediliyor |
| OTHER-AGENT | Mismatch | Hayır | Agent kontrolü son karara katılıyor |
| Ekran satırı SELL/999 | Mismatch | Hayır | Satır kontrolü son karara katılıyor |
| FAKE-LIVE; reveal agent99/cycle99/to0x0 | Mismatch | Hayır | FAKE-LIVE emir metni gösterilmiyor |
| Reverted reveal receipt status=0 | Mismatch | Hayır | Başarısız receipt reddediliyor |
| Eski liste 23, canlı sayaç 25 | Görünür eksik geçmiş uyarısı | Doğrulama kararı üretilmez | Retry ve her iki GET'te nocache parametresi var |
| History fetch başarısız | Görünür history unavailable uyarısı | Doğrulama kararı üretilmez | Hata yutulmuyor, Retry var |
| cycleId=9007199254740993 | Desteklenen aralık dışında hata | Hayır | Yanlış ID ile RPC çağrısı yok |

Büyük ID için ek kontrol: `readDecision(Number(9007199254740993n))` **RPC'ye gitmeden** reddedildi (0 çağrı). `readReveal` aynı uint256'ı string **9007199254740993** olarak kayıpsız döndürdü; history'deki büyük ID de Map'e yuvarlanarak yazılmadan hata verdi. Bu düzeltme tam uint256 için numeric UI desteği eklemiyor, desteklenmeyen aralığı açıkça reddediyor.

### Gerçek cycle 1 / 2 / 3

Üç mevcut Fuji döngüsü hem PublicNode üzerinden hem uygulamanın **varsayılan Fuji RPC/fallback yolu** üzerinden gerçek VerifySheet ile çalıştırıldı. Üçünde de `Result.kind=match`, `result ok` ve yeşil Match var. `checkReveal` üçünde de boş problems listesi döndürdü. Aynı payload/salt/hash mevcut ethers decode, `verifyCycle` ve audit-latest.md kanıtıyla tekrar karşılaştırıldı:

| Cycle | Mod | Web hash = audit = verifyCycle | Gerçek bileşen |
| --- | --- | --- | --- |
| 1 | dry_run=true | 0xd9064ac4000cae4637a50cd3f25b4ae7c9612e9c9600772f7468533371785a83 | Match |
| 2 | LIVE / dry_run=false | 0x7d8116a5636537e03e3b875d2a25b149760b0510d67e0ec00ba61f2a7b070e30 | Match |
| 3 | dry_run=true | 0xf428098883ff2f0398cb846ab80548b2807f680da3c2b586ff67e521a77e649a | Match |

Cycle 2'nin açılan sonucu hâlâ `{"BTC-USDT":"4017748393474314240"}`; cycle 1/3 beş simulated sonuç taşıyor. Emir gönderilmedi veya exchange fill sorgulanmadı.

Gerçek history tekrarında **snapshot block 59601414**, bağımsız deployBlock→head RPC taraması **38 döngü**, yeni web okuyucu **38 döngü**, eksik ID **0**. Önceki audit'in 16 döngüsü bu listenin içinde. Artan sayı, çalışan agent'ın yeni döngüleridir; eski raporun snapshot'ı değiştirilmedi.

### Bulguların kapanışı ve kapsam

| Bulgu | Tekrar inceleme sonucu |
| --- | --- |
| R-010-1 | Kapandı: chain error / 429 / kimlik eksikliği Unverified; state içi hash eşleşmesi on-chain Match sayılmıyor. |
| R-010-2 | Kapandı: agentOk/rowsOk başarısızlığı verdict'i Mismatch yapıyor. |
| R-010-3 | Eski reproducer ve başarısız receipt senaryosu kapandı: ledger/agent/cycle/wallet/receipt status/DecisionRevealed topic kontrolleri var; doğrulanmamış opening'in emir sonuçları gizleniyor. |
| R-010-4 | Kapandı: nocache sorgusu + eksik liste/sayaç uyarısı + fetch hata görünürlüğü/Retry; gerçek okuma 38/38. |
| R-010-5 | Kapandı: safeCycle açık aralık reddi; reveal cycle ID string olarak kayıpsız. |

Bu GO, istenen web doğrulama akışı ve tekrar üretim koşulları içindir. Node bileşen testi yapıldı; gerçek tarayıcı/DOM/CORS ve görsel kontrol çalıştırılmadı. Web `checkReveal`, CLI `verifyCycle` fonksiyonunun birebir kopyası değildir: CLI ayrıca canonical blockHash ve receipt/event data eşlemelerini denetler; web helper'ı receipt status/adres/sender/kimlik/topic bağını kontrol eder. Yukarıdaki başarılı gerçek UI kontrolleri ve olumsuz fixture sonuçları bu ayrım korunarak raporlanmıştır.

**Verify jüriye gösterilebilir: GO — c1c2361.** İnceleme yalnız rapor/handoff günceller; web veya chain ürün kodu değiştirilmedi.
