# Handoff — integrator

- Güncelleme: 2026-10-17 18:17 Europe/Istanbul. Başlangıç main@c3073d4 temiz ve origin/main ile aynı. Kullanıcı sırası: engine@253c046 → web@c9657b2 ayrı merge/push; ardından contracts/config.example.json lookback48→168, VERSION0.6.3, STATE analiz notu.
- Engine exact hedef birleşik index'te; actual14dosya yalnız engine/+engine handoff. Exact ağaç, sınır, diff--check PASS. Önceki aa77641 Grinold ve0eda3cc 180gün analizleri bu hedefin atalarıdır, şimdi kapsam dahil.
- Birleşik engine: uv run --frozen pytest -q --tb=short →212passed13.09s; agents aynıkomut157passed22.52s. Web npmtest22/22,build56modül863ms/public773ms PASS. İlk sandbox uv denemesi önbellek ACL'sinde durdu; izinli tekrar gerçek testleri geçirdi.
- MR_ENABLED=False: T-017 varsayılan KAPALI; O-U gözlem metrikleri sürer, ranging sleeve none, momentum/T-014 karar yolu. Analiz JSON:168/T014180gün+7.12/Sharpe1.16/DD5.81;OOS150gün+5.17/1.01;al-tut+16.73/0.91/DD32.66.168 duyarlılıkta seçildi,aşırı uyum riski;backtest yeniden koşulmadı.
- Agents kaynakta lookback+2 mum ister,lookback+1 kapanmış seçer (168→170istenen/169kapanmış). agents/tests/test_market.py:68 örnek config48varsayar;168değişiminden sonra tam testte doğrulanmalı,owner alanına integrator yazmaz.
- Analiz sahibi için düşük öncelik: backtest_long.simulate modül patch'lerini restore etmez,ProcessPool worker tekrarında sonuç etkilenebilir;lookback168dört iş/dört worker bu riski azaltır. Raporda MR işlem sayısını artırır cümlesi628<641tablosuyla çelişir. Üretim karar yolunu etkilemez.
- SIRADAKİ İLK ADIM: bu engine merge'ünü commit+push et ve uzak main eşitliğini doğrula; sonra exactwebc9657b2test/build/merge+push;sonra168/v0.6.3ve nihai STATE/kart/karar güncellemesi. .env/runtime/runner/journal/pending/OKX/tx yok.
