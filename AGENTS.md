# GRAIL — AI çalışma kuralları (tüm araçlar için tek kaynak)

Bu dosyayı Codex, Claude Code (CLAUDE.md üzerinden) ve Antigravity okur. Kısa tutulur; ayrıntı `coord/` ve `contracts/` altında.
Hackathon: OKX ATK × Avalanche, 17 Ekim 2026, üretim 10:00–19:00, teslim 19:00, final 20:00.

## YENİ CHAT AÇILDIĞINDA (her rol, her araç) — önce bunu yap
Chat'ler kısa ömürlüdür: **1 görev = 1 chat**. Bağlam şişince veya görev bitince chat kapatılır, yenisi açılır.
Kullanıcı yeni chat'e sadece şunu yazar: **"Rol: <rol>. Devam et."** Sen de sırayla:
1. `git rev-parse --abbrev-ref HEAD` → doğru worktree/branch'te misin? Değilsen dur ve söyle.
2. `coord/handoffs/<rol>.md` oku → **SIRADAKİ İLK ADIM** satırı senin işin.
3. `coord/STATE.md` içinde kendi satırını ve ilgili `coord/tasks/T-xxx.md` kartını oku. Başka dosyayı gerekmedikçe okuma.
4. `git status` + `git log --oneline -3` ile handoff'taki iddiayı gerçek durumla karşılaştır; çelişki varsa gerçeği esas al ve yaz.
5. İlk cevabında tek satır: "Rol X, görev T-xxx, branch@commit, contracts vY, ilk adımım: ...". Sonra çalış.
Chat'i bitirmeden (veya her anlamlı adımdan sonra) handoff'u **üzerine yazarak** güncelle: kısa tut, geçmiş birikmesin.
Handoff, bir sonraki chat'in hiçbir şey hatırlamadan devam edebileceği kadar somut olmalı.

## Ürün (tek cümle)
Korelasyonun farkında, otonom bir trading agent'ı: OKX ATK'dan veri çeker, quant engine ile karar verir,
her kararı emirden ÖNCE Avalanche'a commit eder, ATK ile emri verir, sonra reveal eder → değiştirilemez agent sicili.

## Kesin gereksinimler (kullanıcıdan, pazarlık yok)
1. Engine hata vermeden ve kullanıcı config'ine uygun çalışır. Sonuç/getiri önemli değil.
2. Avalanche kullanımı gerçek değer taşır (commit-reveal sicil), sadece bonus kutucuğu değil.
3. Avalanche deploy kesin yapılır (Fuji 13:00'e kadar).
4. Kararlar/işlemler zincire yazılır. HOLD da bir karardır ve commit edilir.
5. OKX ATK kesin kullanılır (veri + emir + hesap).
6. UI/UX tamamlanır. Tasarım 15:00'te başlar; sonraki değişiklikler UI'a yansıtılır.

## Roller ve sahiplik — kimse başkasının alanına YAZMAZ
Kimliğin araç adı DEĞİL, **rol + worktree**'dir. İki Codex oturumu (iki ayrı hesap) aynı dosyayı okur; hangisi olduğunu
çalıştığın klasör ve branch belirler. Aynı hesaptaki iki oturum da birbirinden habersizdir.

| Rol | Araç · hesap | Worktree klasörü | Branch | Yazabildiği yerler |
|---|---|---|---|---|
| integrator | Codex · hesap 1 | `Agentic Hack` (ana) | `main` | `coord/STATE.md`, `coord/DECISIONS.md`, `coord/tasks/`, `contracts/` (chain.json hariç), kök dosyalar, merge |
| agents | Codex · hesap 1 | `Agentic Hack-wt/agents` | `role/agents` | `agents/`, `coord/handoffs/agents.md` |
| engine | Claude Code · Max | `Agentic Hack-wt/engine` | `role/engine` | `engine/`, `coord/handoffs/engine.md` |
| chain | Codex · hesap 2 | `Agentic Hack-wt/chain` | `role/chain` | `chain/`, `contracts/chain.json`, `coord/handoffs/chain.md` |
| web | Antigravity | `Agentic Hack-wt/web` | `role/web` | `web/`, `coord/handoffs/web.md` |
| docs | Claude · Pro | `Agentic Hack-wt/docs` | `role/docs` | `docs/`, `coord/handoffs/docs.md` |
| reviewer | Codex · hesap 2 (T-003 bitince) | `Agentic Hack-wt/review` | `role/review` | sadece `coord/reviews/`, `coord/handoffs/reviewer.md` — ürün koduna YAZMAZ |

- **Reviewer:** merge'den önce READY_FOR_REVIEW dalı inceler (`git diff main...role/<x>`), kartın kontrol komutunu kendisi çalıştırır,
  bulguyu `coord/reviews/<görev>.md`'ye yazar: dosya:satır, tetikleme koşulu, beklenen/gözlenen, önem. Kanıtsız "yeniden yaz" önerisi yok.
  Implementer'dan farklı model incelesin: Claude'un işini (engine) Codex · hesap 2; Codex'in işini (agents, chain) Claude · Pro inceler.
  Codex · hesap 2 kendi yazdığı chain işini incelemez.
- **Debug:** hatayı alanın sahibi düzeltir (bağlam onda). Sahibin limiti bittiyse görev handoff ile başka araca devredilir;
  devralan o alanın geçici sahibi olur, iki kişi aynı anda yazmaz. Alanlar arası (entegrasyon) hata → integrator teşhis eder,
  sahibine görev kartı açar.

- Başka bir alanda değişiklik gerekiyorsa YAPMA; RAPOR'daki "istek" satırına yaz. Kullanıcı integrator'a taşır.
- `contracts/` değişikliği sadece integrator yapar ve `contracts/VERSION` değerini artırır.
- Bağımlılık: her Python paketi kendi `pyproject.toml`'una sahip (`engine/`, `agents/`). Kökte ortak lock dosyası yok.
- Sırlar (API key, private key) sadece `.env` içinde. Asla commit edilmez, asla rapora/loga yazılmaz.

## İletişim — araçlar birbirini OTOMATİK görmez
Mesajlaşma yok. Tek iletişim yolu: **dosyalar + kullanıcının taşıdığı RAPOR**.
- Görev: `coord/tasks/T-xxx.md` (integrator yazar). Sadece sana atanmış görevi yap.
- Durum: `coord/STATE.md` tek yetkili kaynak (sadece integrator yazar).
- Devir: `coord/handoffs/<rol>.md` (sadece o rol yazar). Her anlamlı adımdan sonra güncelle; limitin dolmasını bekleme.
- Diğer worktree'lerdeki dosyalar kendiliğinden güncellenmez. Güncel `main`'i görmek için aşağıdaki "senkron" adımını yap.

## Çalışma döngüsü (her görevde)
1. **Başla:** kendi worktree'nde olduğunu doğrula (`git rev-parse --abbrev-ref HEAD` = senin branch'in).
   Temizse `git merge main` ile senkronla. `coord/STATE.md`, görev kartın, `contracts/VERSION` ve kendi handoff'unu oku.
2. **Kapsam:** görev kartındaki kabul ölçütleri dışına çıkma. Yeni özellik fikri → RAPOR'a "öneri" olarak yaz.
3. **Önce test:** davranışı bilinen girdi → beklenen çıktı örnekleriyle teste yaz, sonra kodu yaz.
4. **Kontrol:** kartta yazan komutu çalıştır; çıktıyı RAPOR'a koy. Çalıştırmadığın kontrolü geçti diye yazma.
5. **Sınır kontrolü:** `git diff --name-only main...HEAD` sadece senin yazabildiğin yolları göstermeli.
6. **Teslim:** küçük commit'ler at, handoff'u güncelle, RAPOR yaz. Durum READY_FOR_REVIEW olur.
7. **Döngüye girme:** aynı hata 2 denemede çözülmediyse dur; hata + denenenler + hipotezle RAPOR yaz (BLOCKED).

## RAPOR biçimi (her turun sonunda, kullanıcı bunu integrator'a yapıştırır)
```
### RAPOR <rol> <görev-id> <saat>
durum: IN_PROGRESS | READY_FOR_REVIEW | BLOCKED
branch@commit: <branch>@<kısa hash>   contracts okunan: v<x.y>
yapılan: <1-3 madde, somut davranış>
değişen dosyalar: <liste>
kontroller: <komut> → <sonuç>   (çalıştırılmayanlar: ...)
istek/sözleşme değişikliği: yok | <ne, neden, kimi etkiler>
engel: yok | <...>
sıradaki ilk adım: <...>
```

## Integrator'ın merge kuralı
Merge öncesi: sınır kontrolü (sadece sahibin yolları), görev kartındaki kontrol komutu kendi tarafında da geçer,
sözleşme sürümü uyumlu. Merge sonrası `main` çalışır ve demo edilebilir kalmalı; `coord/STATE.md` güncellenir.
Durumlar: TODO → IN_PROGRESS → READY_FOR_REVIEW → INTEGRATED (ya da BLOCKED).

## Hesap / limit değişimi
Hesap veya chat değişimi aynı şeydir: yukarıdaki "YENİ CHAT AÇILDIĞINDA" adımları. Aynı worktree kullanılır.
Eski chat/oturum yazmayı bırakmadan yenisi aynı rolde yazmaz. Limit dolmadan önce handoff'u güncel tut.
Integrator `coord/STATE.md`'yi kısa tutar (~80 satır); eski kanıtları `coord/archive/`'a taşır.
Codex: bu dosya değişirse açık Codex oturumları yeniden başlatılmadan değişikliği görmez.
Integrator yedeği: Codex · hesap 1 limiti dolarsa önce o hesabın sıfırlama hakkı kullanılır; olmuyorsa Codex · hesap 2
(aynı araç), o da yoksa Claude Max integrator rolünü `coord/handoffs/integrator.md` üzerinden devralır.
İki Codex hesabı aynı anda: her hesap ayrı `CODEX_HOME` klasöründe oturum açar (hesap 2 için ör. `%USERPROFILE%\.codex-hesap2`).

## Güvenlik
- OKX: geliştirme ve testte DEMO modu. Canlı emir sadece kullanıcı açıkça izin verirse, config'teki limitlerle.
- Belirsiz emir/tx (timeout vb.): önce kimliğiyle durumunu sorgula; bilinmeden tekrar gönderme.
- Commit tx başarısızsa o döngüde emir verilmez (fail-closed); hata loglanır, agent sonraki döngüye geçer.
