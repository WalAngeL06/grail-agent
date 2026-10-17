# R-013 · Kill switch düzeltmesi incelemesi (engine `role/engine@d240923`)

- İnceleyen: reviewer · Claude Code (Opus 5.5) · `role/review`, planner ataması ve kullanıcı onayıyla. Not: engine de Claude ailesinden.
- Hedef: `d240923` ("kill switch on rolling 168h peak; stop blocks buys only, sells allowed"). Main: 6dc9b03.
- `git merge-tree origin/main origin/role/engine` temiz. Sonuç sadece `engine/` (+ engine handoff) değiştiriyor: `src/grail_engine/{peak.py (yeni), decision.py, replay.py}`, `tests/test_decide.py`, `scripts/{kill_switch_168.py, backtest_long.py}`, `out/*`.
- Gerçek emir/tx yok. Testler scratchpad'de main + `role/engine:engine` ile koştu; kopya ve `.venv` silindi.

## Kontroller
| Komut | Sonuç |
|---|---|
| `cd engine && uv run pytest -q` | **217 passed** (11.4 s) |
| `cd agents && uv run pytest -q` (main agents + bu engine) | **157 passed** (24.1 s) |
| Kill-on fuzz'ı: 300 rastgele senaryo × `MR_ENABLED` False/True; zirve = equity × {1, 1.04, 1.06, 1.3} | Kill açık 140/140 vaka: **0 BUY**. 175/172 SELL, hepsi ≤ min(elde olan, `max_order`). İhlal 0. |
| `PeakTracker` kenar durumları | Yeni başlangıç → zirve = mevcut equity (kill yok). Sadece NaN equity → **ValueError** (R-013-4). |
| Yavaş, sürekli düşüş simülasyonu (28 gün, 168 saatlik kayan zirve, eşik %5) | Haftada %3 → toplam kayıp %11.5, stop'ta geçen süre **%0**. Haftada %4.5 → kayıp **%16.8, stop %0**. Haftada %6 → kayıp %21.9, stop %79. Haftada %10 → kayıp %34.4, stop %88. |

## Planner'ın sorularına cevaplar
1. **Tetikliyken hiçbir yolda BUY yok: doğru.** Kill kontrolü artık bütün karar hesaplandıktan sonra, coinin son aksiyonunda uygulanıyor. SELL değilse aksiyon → HOLD ve boyut 0 (`decision.py:319-325`). Bu momentum, kırılım/retest ve MR (açık/kapalı) yollarının hepsini kapsıyor (fuzz). Equity geçersiz ya da coin verisi geçersiz yolları zaten HOLD. Analist BUY üretemiyor (değişmedi). Bütçe hâlâ `size_u` ile düşülüyor (muhafazakâr).
2. **SELL limitleri aşmıyor.** SELL = `min(cur − target, max_order)` ve `target ≥ 0` (`:316`) → elde olandan fazla satış ya da açığa satış yok (fuzz: 0 ihlal).
3. **Canlıda zirve: engine değil, agents veriyor — ve agents hâlâ "tüm zamanlar" kullanıyor.**
   - `decide()` durumsuz; zirveyi `portfolio.peak_equity_usdt`'den alıyor (`decision.py:223-225`). Kayan zirve sadece `replay.py:88/97`'de (`PeakTracker`) kullanılıyor.
   - Main'deki agents: `storage.py:95-99` `update_peak` = kalıcı tüm zamanlar zirvesi (`control.json`); `loop.py:164` bunu engine'e veriyor. `orders.py:66-68` drawdown ≥ eşik iken **BUY ve SELL dahil her emri** `KILL_SWITCH` ile reddediyor.
   - Yani canlı/dry-run agent'ta: stop yine tüm zamanlar zirvesiyle tetiklenir. Engine artık SELL önerir, agents onu engeller → state'te `blocked` + her döngüde `KILL_SWITCH` hatası (güvenli yön). **Canlı davranış değişmiyor; bu düzeltmenin etkisi sadece replay/backtest'te.**
   - 168 saatlik geçmiş yoksa `PeakTracker` zirveyi mevcut değerden başlatıyor → yeni başlangıçta kill yok. Agents ileride kayan zirveyi kalıcı noktalar olmadan benimserse, **yeniden başlatmak stop'u sıfırlar** (aşağıda koşul).
4. **Erken serbest kalma: pencere içinde yok, pencere boyunca var; kümülatif kayıp sınırı kalkıyor.** Zirve 168 saat pencerede kaldıkça serbest kalma yok (test `test_kill_switch_releases_when_window_peak_rolls_off`). Ama:
   - Haftada %5'in altındaki sürekli düşüş stop'u **hiç** tetiklemiyor (haftada %4.5 → 28 günde %16.8 kayıp).
   - Zirve pencereden düşünce düşüş sürerken alım yeniden başlıyor.
   - Sınır artık "toplamda %5" değil, "her 168 saatte ~%5" oranı.
   → R-013-1.

## Bulgular

### R-013-1 · MAJOR (güvenlik politikası) · Kayan zirve, `kill_switch_drawdown_pct`'nin "toplam kayıp" anlamını kaldırıyor
- Yer: `engine/src/grail_engine/peak.py:24-34` (`PeakTracker`), `replay.py:88/97`. Politika metinleri: `AGENTS.md:116` ("`kill_switch_drawdown_pct` → aşılırsa emir yok") ve UI'daki "Trading stops after a 5% loss".
- Tetikleme: eşik altında ama sürekli bir düşüş (ör. haftada %4.5) ya da zirvenin pencereden çıkması.
- Beklenen (mevcut kural): toplam düşüş ≥ %5 → emir yok.
- Gözlenen (kayan zirve): 28 günde %16.8 kayıp, stop hiç devreye girmedi (simülasyon).
- **Canlıyı şu an etkilemiyor** (agents hâlâ tüm zamanlar zirvesi + bütün emirleri engelliyor). Ama replay/pitch rakamları artık canlıdan farklı bir kural altında üretiliyor (R-013-3).
- Agents'a taşınması ancak kullanıcının açık kararı + `AGENTS.md`/`DECISIONS` güncellemesiyle olmalı.

### R-013-2 · MINOR · Engine "SELL serbest" diyor, agents SELL'i de engelliyor
- Yer: `decision.py:319-321` ↔ `agents/src/grail_agents/orders.py:66-68`. Kill açıkken engine SELL kararı commit eder; agents `KILL_SWITCH` ile reddeder; reveal'de bu coin "blocked" olarak eşlemeye girmez; state'te her döngüde hata.
- Güvenli yön. UI/pitch "stop sırasında satış serbest" diyemez — canlıda serbest değil.

### R-013-3 · MINOR · Replay ve backtest farklı kural kullanıyor
- `engine/out/replay*`, `out/kill-switch-168.*`, `scripts/backtest_long.py` kayan zirveyle yeniden üretildi; canlı agent tüm zamanlar zirvesi kullanıyor. Docs/pitch'te replay rakamı gösterilecekse "backtest kill switch: 168 saatlik kayan zirve; canlı: tüm zamanlar zirvesi" notu düşülmeli.

### R-013-4 · MINOR · `PeakTracker.update` sadece NaN noktalarla ValueError atıyor
- Yer: `peak.py:34` (`max(... if math.isfinite(e))` boş). Replay'de equity hep sonlu olduğu için tetiklenmez. Agents benimserse NaN için guard eklenmeli (ör. sonlu nokta yoksa NaN döndür, çağıran fail-closed davransın).

## Agents tarafı
**18:45 için agents'ta değişiklik GEREKMEZ ve önerilmez** (güvenlik kodu, incelemeye zaman yok). Mevcut agents daha sıkı kuralı uyguluyor. İleride kullanıcı kayan zirve + "stop'ta sadece BUY engelli" kararını canlıya taşımak isterse tam liste:
1. `agents/src/grail_agents/storage.py:95-99` `update_peak`: `control.json`'da `peak_points: [[t_ms, equity], …]` (PeakTracker `to_list`) atomik sakla. Yüklerken eski `peak_equity_usdt`'yi şimdiki zamana nokta olarak ekle (yeniden başlatma stop'u sıfırlamasın). Dönüş = pencere zirvesi; sonlu nokta yoksa hata (fail-closed).
2. `agents/src/grail_agents/orders.py:66-68` `_guard`: drawdown kuralı sadece `prepared["action"] == "BUY"` için. `kill_switch is not False` (manuel bayrak) bütün emirleri engellemeye devam etsin. SELL'in elde olanı aşmama kontrolü (`:81-88`) aynen kalsın.
3. Testler: restart sonrası stop korunuyor; SELL stop'ta geçiyor, BUY geçmiyor; NaN/boş geçmişte fail-closed.
4. Integrator: `AGENTS.md:116` + `DECISIONS` politika metni ve UI "Trading stops after a 5% loss" metni.

## Karar
Engine değişikliği kendi içinde güvenli: stop'ta BUY yok, SELL sınırlı, testler yeşil, merge temiz. Canlıda koruma agents üzerinden değişmeden kalıyor.

SONUÇ: APPROVE (koşullu — R-013-1/2/3 bilinen durum olarak STATE'e; agents'a taşıma ayrı karar).
**18:45 merge: GO** (sadece engine; agents değişmeden).
