import { groupCycles, type Cycle, type GrailState } from "../state";
import type { ScreenProps } from "../App";
import HolyGrail, { nEff } from "../components/HolyGrail";
import type { ReactNode } from "react";
import { Card, Empty, PageHead, Term } from "../components/Bits";
import { ago, coin, countdown, n, pct, price, signedPct, usd } from "../format";

export default function Dashboard({ s, now }: ScreenProps) {
  const m = s.metrics;
  const N = m.n_assets ?? (Array.isArray(s.config.coins) ? (s.config.coins as unknown[]).length : undefined);
  const ne = m.n_eff ?? (N && m.avg_corr !== undefined ? nEff(N, m.avg_corr) : undefined);
  const cycles = groupCycles(s);
  const last = cycles.find((c) => c.cycle_id === s.agent.cycle_id) ?? cycles[0];
  const sealed = cycles.find((c) => c.commit_tx);

  return (
    <div className="stack">
      <PageHead title="How many real bets GRAIL holds, and what it is doing right now." summary={liveSummary(s, sealed, now)} />

      <FlowStrip c={last} s={s} now={now} />

      <div className="hero-row">
        <Card className="hero">
          <Term plain="Independent bets" tech="effective N (n_eff)" tip="Coins that move together count as one bet. This number says how many truly separate bets the basket is." />
          {ne !== undefined ? (
            <div>
              <div className="num" aria-label={`${n(ne, 2)} independent bets`}>
                {n(ne, 1, 1)}
              </div>
              <div className="cap">
                {N ?? "?"} coins, but they move like {n(ne, 1, 1)}.
              </div>
            </div>
          ) : (
            <Empty title="Not measured yet">GRAIL needs a few hours of prices to see how the coins move together.</Empty>
          )}
          <div className="hero-sub">
            <Term plain="How much the coins move together" tech="average correlation ρ̄" tip="0 = completely independent, 1 = always move in lockstep." />
            <span className="v">{n(m.avg_corr, 2, 2)}</span>
          </div>
          <div className="hero-sub">
            <Term plain="Confidence the edge is real" tech="PSR · probabilistic Sharpe" tip="How likely it is that returns come from skill rather than luck, given the data so far." />
            <span className="v">{m.psr !== undefined ? pct(m.psr * 100, 0) : <span className="muted" style={{ fontSize: 13 }}>needs more history</span>}</span>
          </div>
          <details className="math">
            <summary>Show the math</summary>
            <p className="mono small">
              n_eff = N / (1 + (N−1)·ρ̄){N !== undefined && m.avg_corr !== undefined ? ` = ${N} / ${n(1 + (N - 1) * m.avg_corr, 2, 2)} = ${n(ne, 2, 2)}` : ""}
            </p>
            <p className="mono small">Sharpe_portfolio = Sharpe_single · √n_eff</p>
          </details>
        </Card>

        <Card title="Why adding more coins barely helps" meta={m.window_bars ? `measured over the last ${m.window_bars} hours` : undefined}>
          <HolyGrail nAssets={N} rho={m.avg_corr} srSingle={m.sr_single_assumed} srNow={m.sr_portfolio_est} nEffNow={ne} curve={m.holy_grail_curve} />
        </Card>
      </div>

      <div className="cols four">
        <Stat label={<Term plain="Account value" tech="equity" />} value={usd(s.portfolio.equity_usdt)} sub={s.dry_run ? "practice balance" : "OKX TR spot account"} />
        <Stat label={<Term plain="Cash" tech="USDT" />} value={usd(s.portfolio.cash_usdt)} sub={cashShare(s)} />
        <Stat
          label={<Term plain="Return per unit of risk" tech="Sharpe (est.)" tip="Higher is better. Diversifying across independent bets raises it." />}
          value={n(m.sr_portfolio_est, 2, 2)}
          sub={m.sr_single_assumed !== undefined ? `one coin alone: ${n(m.sr_single_assumed, 2, 2)}` : undefined}
        />
        <Stat
          label={<Term plain="How much it swings" tech="portfolio volatility, yearly" tip="Typical yearly up-and-down range of the whole portfolio." />}
          value={pct(m.portfolio_vol_pct)}
          sub={typeof s.config.target_vol_pct === "number" ? `aim: ${pct(s.config.target_vol_pct as number, 0)}` : undefined}
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

function liveSummary(s: GrailState, sealed: Cycle | undefined, now: number) {
  const held = s.portfolio.positions.filter((p) => p.inst_id).length;
  const hold = held === 0 ? "GRAIL is fully in cash" : `GRAIL holds ${held} coin${held === 1 ? "" : "s"}`;
  const seal = sealed ? `Last decision sealed on Avalanche ${ago(sealed.decided_at_ms, now)} (round #${sealed.id}).` : "No decision sealed yet.";
  const mode = s.dry_run ? " Practice mode: trades are simulated." : s.dry_run === false ? " Live mode: real funds." : "";
  return `${hold}. ${seal}${mode}`;
}

/** 1 Market → 2 Decision → 3 Sealed → 4 Order → 5 Revealed, for the latest cycle; each step links to its screen. */
function FlowStrip({ c, s, now }: { c?: Cycle; s: GrailState; now: number }) {
  const next = countdown(s.agent.next_cycle_at_ms, now);
  const mk = s.market.find((x) => x.at_ms)?.at_ms;
  const steps: { n: number; title: string; sub: string; href: string; state: "done" | "pending" | "skip" | "fail" }[] = [
    { n: 1, title: "Market", sub: s.market.length ? `${s.market.length} prices from OKX${mk ? ` · ${ago(mk, now)}` : ""}` : "waiting for prices", href: "#/dashboard/positions", state: s.market.length ? "done" : "pending" },
    { n: 2, title: "Decision", sub: c ? `${c.trades} trade${c.trades === 1 ? "" : "s"}, ${c.decisions.length - c.trades} hold` : "next round soon", href: "#/decisions", state: c ? "done" : "pending" },
    { n: 3, title: "Sealed", sub: !c ? "—" : c.commit_tx ? "locked on Avalanche" : "seal failed → no trade", href: "#/ledger", state: !c ? "pending" : c.commit_tx ? "done" : "fail" },
    {
      n: 4,
      title: "Order",
      sub: !c || !c.commit_tx ? "—" : c.trades === 0 ? "nothing to trade" : c.dry_run ? "simulated on OKX" : "sent to OKX",
      href: "#/decisions",
      state: !c || !c.commit_tx ? "pending" : c.trades === 0 ? "skip" : "done",
    },
    { n: 5, title: "Revealed", sub: !c ? "—" : c.reveal_tx ? "opened — anyone can check" : "still sealed", href: "#/ledger", state: !c ? "pending" : c.reveal_tx ? "done" : "pending" },
  ];
  return (
    <nav className="flow" aria-label={`Latest round${c ? ` #${c.id}` : ""}`}>
      <div className="flow-head">
        <span>Latest round {c ? <b>#{c.id}</b> : null}</span>
        <span className="muted">{next ? `next round in ${next}` : ""}</span>
      </div>
      <ol>
        {steps.map((st) => (
          <li key={st.n} className={st.state}>
            <a href={st.href}>
              <span className="flow-n">{st.state === "done" ? "✓" : st.state === "fail" ? "✕" : st.n}</span>
              <span className="flow-t">
                {st.n} · {st.title}
              </span>
              <span className="flow-s">{st.sub}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Stat({ label, value, sub }: { label: ReactNode; value: string; sub?: string }) {
  return (
    <div className="card stat">
      {label}
      <div className="v">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function cashShare(s: GrailState) {
  const eq = Number(s.portfolio.equity_usdt);
  const cash = Number(s.portfolio.cash_usdt);
  return Number.isFinite(eq) && eq > 0 && Number.isFinite(cash) ? `${pct((cash / eq) * 100, 0)} of the account` : undefined;
}

function Positions({ s }: { s: GrailState }) {
  const rows = s.portfolio.positions.filter((p) => p.inst_id);
  const hrp = s.metrics.hrp_weights_pct;
  const mk = new Map(s.market.map((r) => [r.inst_id, r]));
  const scale = Math.max(35, ...rows.map((r) => r.weight_pct ?? 0), ...Object.values(hrp));
  return (
    <Card
      id="positions"
      title="What GRAIL holds"
      meta={
        <span className="legend">
          <i style={{ background: "var(--text)" }} /> now <i style={{ background: "var(--dim)" }} />{" "}
          <Term plain="risk-balanced target" tech="HRP" tip="The share each coin would get if risk were spread evenly across groups of similar coins." />
        </span>
      }
    >
      {rows.length === 0 ? (
        <Empty title="All cash — no coin is trending up right now">
          {usd(s.portfolio.cash_usdt)} is waiting. GRAIL only buys coins whose recent trend is positive.
        </Empty>
      ) : (
        <div className="scroll-x">
          <table className="table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Coin</th>
                <th className="r">Amount</th>
                <th className="r">Value</th>
                <th>Share now / target</th>
                <th className="r">Price</th>
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
                    <td className="r mono muted">{p.size_base ?? "—"}</td>
                    <td className="r">{usd(p.value_usdt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div className="dbar" style={{ flex: 1 }}>
                          <span className="w" style={{ width: `${((p.weight_pct ?? 0) / scale) * 100}%` }} />
                          <span className="t" style={{ width: `${((t ?? 0) / scale) * 100}%` }} />
                        </div>
                        <span style={{ minWidth: 92, textAlign: "right", fontSize: 12 }}>
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
  const title = <Term plain="Which coins move together" tech="pairwise correlation" tip="Gold = the two coins usually rise and fall together. Dark = they move independently. Blue = opposite." />;
  if (!c)
    return (
      <Card title={title}>
        <Empty title="Not measured yet">Appears once GRAIL has a few hours of prices for two or more coins.</Empty>
      </Card>
    );
  const k = c.labels.length;
  const color = (v: number | null) => {
    if (v === null) return "var(--surface-2)";
    const a = Math.min(1, Math.abs(v));
    const [r0, g0, b0] = [26, 33, 48];
    const [r1, g1, b1] = v >= 0 ? [232, 176, 75] : [59, 130, 246];
    return `rgb(${Math.round(r0 + (r1 - r0) * a)}, ${Math.round(g0 + (g1 - g0) * a)}, ${Math.round(b0 + (b1 - b0) * a)})`;
  };
  return (
    <Card title={title}>
      <div className="heat" style={{ gridTemplateColumns: `44px repeat(${k}, minmax(0, 1fr))` }} role="table" aria-label="Correlation matrix">
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
              const diag = i === j;
              return (
                <span
                  key={col}
                  role="cell"
                  className={`cell ${diag ? "diag" : ""}`}
                  style={diag ? undefined : { background: color(v), color: v !== null && Math.abs(v) > 0.55 ? "#0b0e14" : undefined }}
                  title={`${coin(row)} × ${coin(col)}: ${v === null ? "—" : n(v, 2, 2)}`}
                >
                  {v === null ? "—" : n(v, 2, 2)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="heat-legend">
        <span className="mono">−1</span>
        <i aria-hidden="true" />
        <span className="mono">+1</span>
        <span className="muted">average {n(s.metrics.avg_corr, 2, 2)}</span>
      </div>
    </Card>
  );
}

function Signals({ s }: { s: GrailState }) {
  const m = s.metrics;
  const coins = Object.keys(m.trend_pct);
  if (!coins.length) return null;
  const ups = coins.filter((c) => m.trend_pct[c] > 0).length;
  const regime = ups === 0 ? "No coin is trending up: GRAIL stays in cash." : ups === coins.length ? "Every coin is trending up." : `${ups} of ${coins.length} coins trending up; the rest stay in cash.`;
  return (
    <Card title="Trend by coin" meta={regime}>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Coin</th>
              <th className="r">
                <Term plain="Recent trend" tech="48h momentum" />
              </th>
              <th className="r">
                <Term plain="How much it swings" tech="volatility, yearly" />
              </th>
              <th className="r">
                <Term plain="Risk-balanced share" tech="HRP weight" />
              </th>
              <th className="r">
                <Term plain="Target share" tech="after limits" />
              </th>
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

