import { groupCycles, type GrailState } from "../state";
import HolyGrail, { nEff } from "../components/HolyGrail";
import { ActionChip, Card, Empty } from "../components/Bits";
import { coin, n, pct, price, signedPct, usd } from "../format";

export default function Dashboard({ s }: { s: GrailState }) {
  const m = s.metrics;
  const N = m.n_assets ?? (Array.isArray(s.config.coins) ? (s.config.coins as unknown[]).length : undefined);
  const ne = m.n_eff ?? (N && m.avg_corr !== undefined ? nEff(N, m.avg_corr) : undefined);
  const last = groupCycles(s).find((c) => c.cycle_id === s.agent.cycle_id) ?? groupCycles(s)[0];

  return (
    <div className="stack">
      <div className="hero-row">
        <Card className="hero">
          <div>
            <div className="label">Effective bets</div>
            {ne !== undefined ? (
              <>
                <div className="num" aria-label={`${n(ne, 2)} effective bets`}>
                  {n(ne, 2, 2)}
                </div>
                <div className="cap">
                  effective bets out of {N ?? "?"} coins <span>· ρ̄ = {n(m.avg_corr, 2, 2)}</span>
                </div>
              </>
            ) : (
              <Empty title="Not computed yet">The engine writes correlation after its first cycle.</Empty>
            )}
          </div>
          <p>
            Average pairwise correlation decides how many independent bets a basket really is. GRAIL sizes positions on this number, not on
            the coin count.
          </p>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Last cycle {last?.cycle_id !== undefined ? `#${last.cycle_id}` : ""}
            </div>
            {last ? (
              <div className="lastcycle">
                {[...last.decisions]
                  .sort((a, b) => (a.inst_id ?? "").localeCompare(b.inst_id ?? ""))
                  .map((d) => (
                    <span key={d.key} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>{coin(d.inst_id)}</span>
                      <ActionChip action={d.action} />
                    </span>
                  ))}
                <a className="linkbtn" href="#/decisions">
                  → Decisions
                </a>
              </div>
            ) : (
              <span className="muted">Waiting for the first cycle.</span>
            )}
          </div>
          <div className="stat">
            <span className="label">PSR (probabilistic Sharpe)</span>
            <span className="v" style={{ fontSize: 18 }}>
              {m.psr !== undefined ? pct(m.psr * 100, 0) : <span className="muted">— (needs history)</span>}
            </span>
          </div>
        </Card>

        <Card title="Holy Grail: Sharpe vs number of assets" meta={m.window_bars ? `correlation over ${m.window_bars} bars` : undefined}>
          <HolyGrail nAssets={N} rho={m.avg_corr} srSingle={m.sr_single_assumed} srNow={m.sr_portfolio_est} nEffNow={ne} curve={m.holy_grail_curve} />
        </Card>
      </div>

      <div className="cols four">
        <Stat label="Equity" value={usd(s.portfolio.equity_usdt)} sub={s.dry_run ? "simulated balance" : "OKX TR spot"} />
        <Stat label="Cash" value={usd(s.portfolio.cash_usdt)} sub={cashShare(s)} />
        <Stat
          label="Portfolio Sharpe (est.)"
          value={n(m.sr_portfolio_est, 2, 2)}
          sub={m.sr_single_assumed !== undefined ? `vs ${n(m.sr_single_assumed, 2, 2)} single coin` : undefined}
        />
        <Stat
          label="Portfolio volatility"
          value={pct(m.portfolio_vol_pct)}
          sub={typeof s.config.target_vol_pct === "number" ? `target ${pct(s.config.target_vol_pct as number, 0)}` : "annualised"}
        />
      </div>

      <div className="cols wide">
        <Positions s={s} />
        <Correlation s={s} />
      </div>

      <Signals s={s} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stat">
      <span className="label">{label}</span>
      <div className="v">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function cashShare(s: GrailState) {
  const eq = Number(s.portfolio.equity_usdt);
  const cash = Number(s.portfolio.cash_usdt);
  return Number.isFinite(eq) && eq > 0 && Number.isFinite(cash) ? `${pct((cash / eq) * 100, 0)} of equity` : undefined;
}

function Positions({ s }: { s: GrailState }) {
  const rows = s.portfolio.positions.filter((p) => p.inst_id);
  const hrp = s.metrics.hrp_weights_pct;
  const mk = new Map(s.market.map((r) => [r.inst_id, r]));
  const scale = Math.max(40, ...rows.map((r) => r.weight_pct ?? 0), ...Object.values(hrp));
  return (
    <Card title="Positions" meta="weight vs HRP target">
      {rows.length === 0 ? (
        <Empty title="All cash — trend filter is risk-off">Cash: {usd(s.portfolio.cash_usdt)}</Empty>
      ) : (
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Coin</th>
                <th className="r">Size</th>
                <th className="r">Value</th>
                <th>Weight / target</th>
                <th className="r">Last</th>
                <th className="r">24h</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const t = p.inst_id ? hrp[p.inst_id] : undefined;
                const q = mk.get(p.inst_id);
                return (
                  <tr key={p.inst_id}>
                    <td style={{ fontWeight: 600 }}>{coin(p.inst_id)}</td>
                    <td className="r mono">{p.size_base ?? "—"}</td>
                    <td className="r">{usd(p.value_usdt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div className="dbar" style={{ flex: 1 }} title={`weight ${pct(p.weight_pct)} · HRP target ${pct(t)}`}>
                          <span className="w" style={{ width: `${((p.weight_pct ?? 0) / scale) * 100}%` }} />
                          <span className="t" style={{ width: `${((t ?? 0) / scale) * 100}%` }} />
                        </div>
                        <span style={{ minWidth: 92, textAlign: "right" }}>
                          {pct(p.weight_pct)} <span className="muted">/ {pct(t)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="r mono">{price(q?.last)}</td>
                    <td className={`r ${q?.change_24h_pct === undefined ? "" : q.change_24h_pct >= 0 ? "up" : "down"}`}>{signedPct(q?.change_24h_pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Correlation({ s }: { s: GrailState }) {
  const c = s.metrics.corr;
  if (!c)
    return (
      <Card title="Correlation">
        <Empty title="No correlation matrix yet">Appears once the engine has returns for two or more coins.</Empty>
      </Card>
    );
  const k = c.labels.length;
  // ρ=0 → surface-2, ρ=1 → grail; negative → blue (ui-brief §3)
  const color = (v: number | null) => {
    if (v === null) return "var(--surface-2)";
    const a = Math.min(1, Math.abs(v));
    const [r0, g0, b0] = [26, 33, 48];
    const [r1, g1, b1] = v >= 0 ? [232, 176, 75] : [59, 130, 246];
    return `rgb(${Math.round(r0 + (r1 - r0) * a)}, ${Math.round(g0 + (g1 - g0) * a)}, ${Math.round(b0 + (b1 - b0) * a)})`;
  };
  return (
    <Card title="Correlation" meta="pairwise, return window">
      <div className="heat" style={{ gridTemplateColumns: `48px repeat(${k}, minmax(0, 1fr))` }} role="table" aria-label="Correlation matrix">
        <span />
        {c.labels.map((l) => (
          <span key={l} className="lab top" role="columnheader">
            {coin(l)}
          </span>
        ))}
        {c.labels.map((row, i) => (
          <div key={row} style={{ display: "contents" }} role="row">
            <span className="lab" role="rowheader">
              {coin(row)}
            </span>
            {c.labels.map((col, j) => {
              const v = c.values[i]?.[j] ?? null;
              return (
                <span
                  key={col}
                  role="cell"
                  className={`cell ${i === j ? "diag" : ""}`}
                  style={{ background: color(v), color: v !== null && v > 0.6 ? "#0b0e14" : undefined }}
                  title={`${coin(row)} × ${coin(col)}: ${v === null ? "—" : n(v, 2, 2)}`}
                >
                  {v === null ? "—" : n(v, 2, 2)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Signals({ s }: { s: GrailState }) {
  const m = s.metrics;
  const coins = Object.keys(m.trend_pct);
  if (!coins.length) return null; // engine metrics beyond the v0.4 example: show only when present
  const ups = coins.filter((c) => m.trend_pct[c] > 0).length;
  const regime = ups === 0 ? "Risk-off: no coin is trending up, agent holds cash." : ups === coins.length ? "Risk-on: every coin is trending up." : `Selective: ${ups} of ${coins.length} coins trending up; the rest go to cash.`;
  return (
    <Card title="Signals by coin" meta={regime}>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Coin</th>
              <th className="r">Trend</th>
              <th className="r">Volatility (ann.)</th>
              <th className="r">HRP weight</th>
              <th className="r">Target weight</th>
            </tr>
          </thead>
          <tbody>
            {coins.map((c) => {
              const t = m.trend_pct[c];
              return (
                <tr key={c}>
                  <td style={{ fontWeight: 600 }}>{coin(c)}</td>
                  <td className={`r ${t > 0 ? "up" : "down"}`}>
                    {t > 0 ? "▲" : "▼"} {signedPct(t, 2)}
                  </td>
                  <td className="r">{pct(m.vol_pct[c])}</td>
                  <td className="r">{pct(m.hrp_weights_pct[c])}</td>
                  <td className="r">{pct(m.target_weights_pct[c])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
