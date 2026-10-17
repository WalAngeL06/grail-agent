# Handoff — engine (sadece bu rol yazar)

- Güncelleme zamanı: 2026-10-17 13:15 (Europe/Istanbul)
- Aktif görev / durum: T-001 / READY_FOR_REVIEW
- Oturum: Claude Code · Max (Opus 5.5), durdu. Not: oturum yanlışlıkla `Agentic Hack\engine\.claude\worktrees\...` (branch `claude/rol-engine-devam-84aed9`) içinde açıldı; iş doğru worktree'de (`Agentic Hack-wt/engine`, `role/engine`) mutlak yolla yapıldı. O fazladan worktree/branch boş, silinebilir. Sonraki engine/analyst chat'ini doğrudan `Agentic Hack-wt/engine` klasöründen worktree'siz aç.
- Worktree / branch / son commit: `Agentic Hack-wt/engine` / `role/engine` / bu handoff ile aynı commit (`git log -1`)
- contracts okunan sürüm: 0.3
- Tamamlanan somut davranış:
  - `engine/` uv paketi `grail-engine` (`src/grail_engine`): `validate_config`, `decide`, `sr_portfolio`, `n_eff`, `corr_matrix`, `avg_corr`, `hrp_weights`, `psr`, `returns_from_closes`. API ve kurallar: `engine/README.md`.
  - `decide(snapshot, portfolio, cfg)` → `{"ok","payload","metrics","errors"}`; `payload` = decision.md döngü payload'ı (aynen hash'lenir). İstisna fırlatmaz (beklenmeyen hata → hepsi HOLD + ENGINE_ERROR). Saat okumaz: `decided_at_ms = snapshot.at_ms`.
  - OKX ham `candles` satırlarını (en yeni önce) doğrudan kabul eder; gerçek OKX 1H verisiyle denendi (5 coin × 169 mum): ρ̄=0.79, n_eff=1.2, hatasız.
  - `risk_budget_pct` yorumu (kartta tanımsızdı): coin başına yıllık vol katkısı tavanı `w_i * vol_i <= risk_budget_pct`. Integrator onaylamalı.
- Commit edilmemiş / izlenmeyen dosyalar: yok
- Çalıştırılan kontroller (komut → sonuç): `cd engine && uv run pytest -q` → `49 passed`; `grep` src'de open/os/time/requests/print yok.
- Çalıştırılmayan kontroller ve nedeni: Ledoit–Wolf shrinkage yazılmadı (kartta opsiyonel).
- Devam eden süreçler / portlar: yok
- Dış eylemler (emir id, tx hash) ve durumu; belirsiz olanlar işaretli: yok (sadece salt okunur `okx market candles`).
- Açık sorun / denenenler: Bugünkü piyasada `lookback_bars=168` ile 5 coinin trendi negatif → hepsi HOLD (beklenen davranış). Demo emir kapısı için `lookback_bars` 48 ile 5 BUY, 12 ile 3 BUY üretiyor (13:10 verisi). Config kullanıcının/integrator'ın kararı.
- TEKRARLANMAMASI gereken işlem: modül adı `decide.py` yapma (paket `decide` fonksiyonu modülü gölgeliyor → `decision.py`).
- SIRADAKİ İLK ADIM: T-001 review bulgusu varsa düzelt; yoksa T-007 (analyst) kartını oku — yeni chat, `Agentic Hack-wt/engine` içinde.
