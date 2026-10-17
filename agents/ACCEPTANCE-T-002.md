# T-002 acceptance evidence — 2026-10-17, Europe/Istanbul

Contracts read: 0.4. Fixed account context: `grail`, `tr`, live account; execution `dry_run=true`. Installed ATK CLI: 1.4.8. No order or chain transaction was sent.

## Verification

- `cd agents; uv run pytest -q --tb=short` → 78 passed in 0.20s, all offline.
- `cd agents; uv run python -m grail_agents smoke --config ../contracts/config.example.json` → exit 0, `ok: true`.
- Smoke read BTC-USDT, ETH-USDT, SOL-USDT, AVAX-USDT, OKB-USDT; all active USDT spot instruments. Each returned 49 confirmed 1H bars (48-bar engine lookback plus one closing value).
- Source scan: no withdrawal, transfer, leverage, account-setting, auth-login or config-init command in `agents/src/`.

Relevant actual smoke output (account data, not credentials):

```json
{
  "contract_version": "0.4",
  "mode": "live",
  "dry_run": true,
  "cash_usdt": "29.40294764",
  "equity_usdt": "29.40298514277985564967753674",
  "order": {
    "client_order_id": "grailSmoke",
    "okx_order_id": null,
    "order_status": "simulated",
    "fill_price": null,
    "inst_id": "BTC-USDT",
    "action": "BUY",
    "size_base": "0.00002449",
    "size_usdt": "2"
  }
}
```

| Instrument | minSz (base) | lotSz (base) | tickSz | minimum USDT at observed ticker |
|---|---|---|---|---|
| BTC-USDT | 0.00001 | 0.00000001 | 0.1 | 0.816421 |
| ETH-USDT | 0.0001 | 0.000001 | 0.01 | 0.243872 |
| SOL-USDT | 0.01 | 0.000001 | 0.01 | 1.0496 |
| AVAX-USDT | 0.1 | 0.000001 | 0.001 | 1.0011 |
| OKB-USDT | 0.01 | 0.000001 | 0.01 | 1.177 |

These minimum equivalents are a historical observation, not a fixed exchange quote-size rule. The adapter refreshes instrument rules for each live submission and enforces the configured 2 USDT minimum as well.

## Deviations and limits to carry to the integrator

- Task card says contracts 0.3; current main is 0.4. Examples and 48-bar lookback verified.
- CLI 1.4.8 rejects `--read-only`. The human explicitly approved a fixed read-query allowlist in this chat. Record that task-card correction; no contract version change is required for it.
- `--site tr` alone does not override ATK's profile/environment API base URL. Adapter additionally forces `https://tr.okx.com` and removes credential environment overrides.
- Actual account contains 0.001855 TRY dust. First smoke stopped instead of dropping its value. Inverse USDT-TRY ticker now values it; additive position fields `tradable=false` and `valuation_pair=USDT-TRY` distinguish synthetic TRY-USDT. Cash remains actual available USDT. Other unpriced holdings fail closed.
- Pending/partial reservations are deliberately conservative. All live workers for this account must share the same persistent journal; T-006 must persist the equity peak, catch GrailError, and require a confirmed Avalanche commit before invoking execution.
- Independent Claude Pro review is pending. No automatic integration or main push was performed.
- First live minimum-size order was not run: user-owned config remains `dry_run=true`; no user activation/confirmation for live execution was provided. Live path is covered with a fake exchange, including submission timeout, restart, durable claim, pending budgets and untracked orders.
