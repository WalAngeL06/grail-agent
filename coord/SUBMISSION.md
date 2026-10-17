# Teslim formu — 19:00'dan ÖNCE doldurulacak (formu kullanıcı doldurur ve gönderir)

Form: https://docs.google.com/forms/d/e/1FAIpQLSfSMYuEAv_RelL6JVXpvZHDyUkZAjtcVV0XHm9x6zsNGryCWg/viewform
("Agentic Hackathon Submition Form" — Avalanche Team1 x OKX TR)

| Alan | Zorunlu | Bizdeki karşılığı | Sorumlu | Durum |
|---|---|---|---|---|
| Builder Hub hesabına kayıtlı e-posta | ✅ | Builder Hub hesabı açıldı (e-postayı formda kullanıcı yazar) | kullanıcı | ✅ |
| Projenin yayınlandığı website | — | UI'ın public deploy'u (ör. Vercel), mock/okuma modunda | web + integrator | ⏳ (vakit kalırsa; jüriye artı) |
| Takım / proje adı | ✅ | GRAIL | — | ✅ |
| Proje açıklaması | ✅ | `coord/BRIEF.md` "Tek cümle" + 4 parça (docs rolü kısa metni hazırlar) | docs | ⏳ |
| GitHub linki | ✅ | github.com/WalAngeL06/grail-agent (şu an private; 18:30'da public) + README | integrator | ⏳ private |
| Avalanche'da deploy edilen kontrat adresi | — (ama Bonus 2) | `contracts/chain.json` → GrailLedger adresi (+ IdentityRegistry, agentId) | chain | ⏳ |
| Proje sunumu (Google Slides / Canva linki) | ✅ | Slayt destesi, paylaşım linki "bağlantıya sahip herkes görüntüleyebilir" | docs + kullanıcı | ⏳ |

## Zaman planı
- 15:00'a kadar: Builder Hub hesabı (kullanıcı), GitHub reposu (private başlar).
- 17:00 freeze sonrası: README, sunum destesi, açıklama metni.
- 18:30: repo public yapılır, linkler test edilir (çıkış yapılmış/gizli pencerede açılıyor mu).
- 18:45: form doldurulur ve gönderilir. Gönderim onayı ekran görüntüsü alınır.

## Dikkat
- Repoya `.env`, private key, OKX anahtarı girmemeli (`.gitignore` hazır). Public yapmadan önce `git log -p` ile sır taraması.
- Forma şifre/anahtar yazılmaz.
