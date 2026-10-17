import { groupCycles, type Cycle, type GrailState } from "../state";
import type { ScreenProps } from "../App";
import HolyGrail, { nEff } from "../components/HolyGrail";
import type { ReactNode } from "react";
import { Card, Empty, PageHead, Term } from "../components/Bits";
import { ago, coin, countdown, n, pct, price, psrText, signedPct, usd, windowLabel } from "../format";

export default function Dashboard({ s, now }: ScreenProps) {
  const m = s.metrics;
  const N = m.n_assets ?? (Array.isArray(s.config.coins) ? (s.config.coins as unknown[]).length : undefined);
  const ne = m.n_eff ?? (N && m.avg_corr !== undefined ? nEff(N, m.avg_corr) : undefined);
  const cycles = groupCycles(s);
  const last = cycles.find((c) => c.cycle_id === s.agent.cycle_id) ?? cycles[0];
  const win = windowLabel(s.config, m.window_bars);

  return (
    <div className="stack">
      <PageHead
        eyebrow="Dashboard"
        title="How many independent bets GRAIL's coin list really offers, and what the agent is doing right now."
        summary={liveSummary(s, last, ne, now)}
      />

      <FlowStrip c={last} s={s} now={now} />

      <div className="hero-row">
        <Card className="hero">
          <Term plain="Independent bets" tech="effective N (n_eff) · equal-weight list" tip="How many truly separate bets the coins on GRAIL's list add up to, once you account for how much they move together. It describes the list, not what GRAIL holds right now." />
          {ne !== undefined ? (
            <div>
              <div className="num" aria-label={`${n(ne, 2)} independent bets`}>
                {n(ne, 1, 1)}
              </div>
              <div className="cap">
                {N ?? "?"} coins on the list, but they move like {n(ne, 1, 1)} <span className="muted">({win}, equal weights)</span>
              </div>
            </div>
          ) : (
            <Empty title="Not measured yet">GRAIL needs a few hours of prices to see how the coins move together.</Empty>
          )}
          <div className="hero-sub">
            <Term plain="Togetherness" tech="average correlation ρ̄" tip="How much the coins rise and fall together, from 0 (independently) to 1 (in lockstep)." />
            <span className="v">{n(m.avg_corr, 2, 2)}</span>
          </div>
          <div className="hero-sub">
            <Term
              plain="Chance the coin basket's recent trend is real"
              tech={`PSR(SR>0) · risk-balanced basket of all coins · ${win}, in-sample`}
              tip={`Probability that the basket's true Sharpe over the ${win.replace("last ", "last ")} is above zero. It is not GRAIL's own track record.`}
            />
            <span className="v">{m.psr !== undefined ? psrText(m.psr) : <span className="muted" style={{ fontSize: 13 }}>— (needs more history)</span>}</span>
          </div>
          <details className="math">
            <summary>Show the math</summary>
            <p className="mono small">
              n_eff = N / (1 + (N−1)·ρ̄){N !== undefined && m.avg_corr !== undefined ? ` = ${N} / ${n(1 + (N - 1) * m.avg_corr, 4, 4)} = ${n(ne, 2, 2)}` : ""}
            </p>
            <p className="mono small">Sharpe_portfolio = SR₁ · √n_eff, with SR₁ = {n(m.sr_single_assumed, 2, 2)} assumed (illustration, not measured)</p>
          </details>
        </Card>

        <Card title="More coins, fewer real bets" meta={`return per unit of risk vs number of coins · togetherness from the ${win}`}>
          <HolyGrail nAssets={N} rho={m.avg_corr} srSingle={m.sr_single_assumed} srNow={m.sr_portfolio_est} nEffNow={ne} curve={m.holy_grail_curve} />
        </Card>
      </div>

      <div className="cols four">
        <Stat label={<Term plain="Account value" tech="equity" />} value={usd(s.portfolio.equity_usdt)} sub={s.dry_run ? "practice balance" : "OKX TR spot account"} />
        <Stat label={<Term plain="Cash" tech="USDT" />} value={usd(s.portfolio.cash_usdt)} sub={cashShare(s)} />
        <Stat
          label={
            <Term
              plain="Diversification boost (illustration)"
              tech="√n_eff · Sharpe est. = SR₁ · √n_eff, SR₁ assumed"
              tip="How much spreading across independent bets would raise return per unit of risk. Illustration only: nothing is measured here."
            />
          }
          value={ne !== undefined ? `×${n(Math.sqrt(ne), 2, 2)}` : "—"}
          sub={
            m.sr_single_assumed !== undefined && m.sr_portfolio_est !== undefined
              ? `if each coin alone scored ${n(m.sr_single_assumed, 2, 2)} (assumed, not measured) → ${n(m.sr_portfolio_est, 2, 2)}`
              : undefined
          }
        />
        <Stat
          label={<Term plain="Expected price swings" tech="target-mix volatility, yearly (est.)" tip={`Estimated yearly swing of the target mix, from the ${win} of prices.`} />}
          value={pct(m.portfolio_vol_pct)}
          sub={typeof s.config.target_vol_pct === "number" ? `capped near ${pct(s.config.target_vol_pct as number, 0)}` : undefined}
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

// docs/ui-copy.md (c) Dashboard live summary
function liveSummary(s: GrailState, c: Cycle | undefined, ne: number | undefined, now: number) {
  const next = countdown(s.agent.next_cycle_at_ms, now);
  const nextTxt = next ? ` Next in ${next}.` : "";
  if (!c) return `Waiting for the first check-in${next ? ` — next in ${next}` : ""}.`;
  const held = s.portfolio.positions.filter((p) => p.inst_id).length;
  if (held === 0 && c.trades === 0) return `All in cash — every coin's trend is down, so the agent is waiting.${next ? ` Next check-in in ${next}.` : ""}`;
  const k = (a: string) => c.decisions.filter((d) => d.action === a).length;
  const head = s.metrics.n_assets !== undefined && ne !== undefined ? `${s.metrics.n_assets} coins, ${n(ne, 1, 1)} independent bets. ` : "";
  return `${head}Last check-in #${c.id}: ${k("BUY")} buy · ${k("SELL")} sell · ${k("HOLD")} hold.${nextTxt}`;
}

/** R-007-3: the agent's real target (after limits), converted from the trading budget to a share of the whole account. */
export function targetOfAccount(s: GrailState, inst: string | undefined): number | undefined {
  if (!inst) return undefined;
  const latest = groupCycles(s).find((c) => c.decisions.some((d) => d.inst_id === inst && d.target_weight_pct !== undefined));
  const tw = s.metrics.target_weights_pct[inst] ?? latest?.decisions.find((d) => d.inst_id === inst)?.target_weight_pct;
  const eq = Number(s.portfolio.equity_usdt);
  if (tw === undefined || !(eq > 0)) return tw;
  const cap = Number(s.config.max_total_deploy_usdt);
  const base = Number.isFinite(cap) && cap > 0 ? Math.min(eq, cap) : eq;
  return (tw * base) / eq;
}

/** 1 Market → 2 Decision → 3 Sealed → 4 Order → 5 Revealed, for the latest cycle; each step links to its screen. */
function FlowStrip({ c, s, now }: { c?: Cycle; s: GrailState; now: number }) {
  const next = countdown(s.agent.next_cycle_at_ms, now);
  const mk = s.market.find((x) => x.at_ms)?.at_ms;
  const steps: { n: number; title: string; sub: string; href: string; state: "done" | "pending" | "skip" | "fail" }[] = [
    { n: 1, title: "Market", sub: s.market.length ? `${s.market.length} prices from OKX${mk ? ` · ${ago(mk, now)}` : ""}` : "waiting for prices", href: "#/dashboard/positions", state: s.market.length ? "done" : "pending" },
    { n: 2, title: "Decision", sub: c ? `${c.trades} trade${c.trades === 1 ? "" : "s"}, ${c.decisions.length - c.trades} hold` : "next check-in soon", href: "#/decisions", state: c ? "done" : "pending" },
    { n: 3, title: "Sealed", sub: !c ? "—" : c.commit_tx ? "fingerprint on Avalanche" : "couldn't seal → no order", href: "#/ledger", state: !c ? "pending" : c.commit_tx ? "done" : "fail" },
    {
      n: 4,
      title: "Order",
      sub: !c || !c.commit_tx ? "—" : c.trades === 0 ? "nothing to trade" : c.dry_run ? "simulated on OKX" : "sent to OKX",
      href: "#/decisions",
      state: !c || !c.commit_tx ? "pending" : c.trades === 0 ? "skip" : "done",
    },
    { n: 5, title: "Opened", sub: !c ? "—" : c.reveal_tx ? "opened — anyone can check" : "still sealed", href: "#/ledger", state: !c ? "pending" : c.reveal_tx ? "done" : "pending" },
  ];
  return (
    <nav className="flow" aria-label={`Latest check-in${c ? ` #${c.id}` : ""}`}>
      <div className="flow-head">
        <span>Latest check-in {c ? <b>#{c.id}</b> : null}</span>
        <span className="muted">{next ? `next check-in in ${next}` : ""}</span>
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
  const mk = new Map(s.market.map((r) => [r.inst_id, r]));
  const targets = new Map(rows.map((p) => [p.inst_id, targetOfAccount(s, p.inst_id)]));
  const scale = Math.max(35, ...rows.map((r) => r.weight_pct ?? 0), ...[...targets.values()].map((v) => v ?? 0));
  return (
    <Card
      id="positions"
      title="What GRAIL holds"
      meta={
        <span className="legend">
          <i style={{ background: "var(--text)" }} /> now <i style={{ background: "var(--dim)" }} />{" "}
          <Term
            plain="agent's target (after limits)"
            tech="target_weight_pct × trading budget ÷ account"
            tip="The share the agent is steering toward after its risk and spending limits, shown as a share of the whole account so it compares with 'now'."
          />
        </span>
      }
    >
      {rows.length === 0 ? (
        <Empty title="All in cash — the trend filter is staying out of the market">
          {usd(s.portfolio.cash_usdt)} available. GRAIL only buys coins whose recent trend is up.
        </Empty>
      ) : (
        <div className="scroll-x">
          <table className="table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Coin</th>
                <th className="r">Amount</th>
                <th className="r">Value</th>
                <th>Share of account: now / target</th>
                <th className="r">Price</th>
                <th className="r">24h</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const t = targets.get(p.inst_id);
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
                <Term plain="Recent trend" tech={`momentum, ${windowLabel(s.config, m.window_bars)}`} />
              </th>
              <th className="r">
                <Term plain="Price swings" tech="volatility, yearly" />
              </th>
              <th className="r">
                <Term
                  plain="Family-based share"
                  tech="HRP weight, before limits"
                  tip="Risk-balanced share among the coins that are trending up; coins trending down get 0. Limits are applied after this."
                />
              </th>
              <th className="r">
                <Term plain="Target share of account" tech="target_weight_pct, after limits" />
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
                  <td className="r">{pct(targetOfAccount(s, c))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

