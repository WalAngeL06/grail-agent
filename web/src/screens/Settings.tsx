import type { ScreenProps } from "../App";
import { Card, PageHead, Term } from "../components/Bits";
import { coin, dayClock, n, usd } from "../format";

// Read-only (ui-brief §1.4): the UI never writes config and never places orders.
type Known = { label: string; fmt: (v: unknown) => string; hint?: string };
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const asPct = (v: unknown) => (Number.isFinite(num(v)) ? `${n(num(v), 2)}%` : String(v));
const asUsd = (v: unknown) => (Number.isFinite(num(v)) ? usd(String(v)) : String(v));

const KNOWN: Record<string, Known> = {
  max_order_usdt: { label: "Most per trade", fmt: asUsd, hint: "No single order can be bigger than this." },
  max_total_deploy_usdt: { label: "Most in total", fmt: asUsd, hint: "The agent can never put more than this to work." },
  kill_switch_drawdown_pct: { label: "Emergency stop", fmt: asPct, hint: "If the account falls this much, no new orders are placed." },
  min_order_usdt: { label: "Smallest trade", fmt: asUsd, hint: "Tiny rebalances are skipped to save fees." },
  max_position_pct: { label: "Biggest share for one coin", fmt: asPct },
  risk_budget_pct: { label: "Risk allowance per coin", fmt: asPct, hint: "share × yearly swing must stay under this" },
  target_vol_pct: { label: "Target swing for the portfolio", fmt: asPct, hint: "Positions are scaled so the whole portfolio swings about this much per year." },
  cycle_seconds: { label: "Time between rounds", fmt: (v) => `${String(v)} s` },
  candle_bar: { label: "Price candle size", fmt: (v) => String(v) },
  lookback_bars: { label: "History used for trends", fmt: (v) => `${String(v)} candles` },
  okx_site: { label: "OKX site", fmt: (v) => String(v).toUpperCase() },
  quote: { label: "Quote currency", fmt: (v) => String(v) },
};
const ORDER = Object.keys(KNOWN);
const LIMITS = ["max_order_usdt", "max_total_deploy_usdt", "kill_switch_drawdown_pct"];

const GUARDS: { title: string; text: string }[] = [
  { title: "Can never withdraw money", text: "The OKX key allows reading and trading only. No withdrawal or transfer exists anywhere in the code." },
  { title: "No borrowing, no leverage", text: "Spot trading only: no derivatives, no margin. The leverage setting is never called." },
  { title: "Only the listed coins", text: "Orders for any other coin are rejected in code." },
  { title: "Spending caps", text: "Per-trade and total limits are checked in code before every order." },
  { title: "Emergency stop", text: "If losses reach the limit, new orders stop automatically." },
  { title: "No seal, no trade", text: "If sealing the decision on Avalanche fails, no order is placed that round (fail-closed)." },
  { title: "A human switches it on", text: "Practice mode is the default. Going live is a config change made by a person, not a button here." },
];

export default function Settings({ s }: ScreenProps) {
  const cfg = s.config;
  const coins = Array.isArray(cfg.coins) ? (cfg.coins as unknown[]).filter((c): c is string => typeof c === "string") : [];
  const keys = Object.keys(cfg).filter((k) => !["coins", "dry_run", "mode", ...LIMITS].includes(k));
  keys.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  const errors = [...s.errors].sort((a, b) => (b.at_ms ?? 0) - (a.at_ms ?? 0));
  const lim = (k: string) => (cfg[k] === undefined || cfg[k] === null || cfg[k] === "" ? null : KNOWN[k].fmt(cfg[k]));
  const caps = [lim("max_order_usdt") && `${lim("max_order_usdt")} per trade`, lim("max_total_deploy_usdt") && `${lim("max_total_deploy_usdt")} in total`]
    .filter(Boolean)
    .join(" and ");
  const summary = [
    s.dry_run ? "Practice mode — no real orders." : s.dry_run === false ? "Live mode — real funds." : "",
    caps ? `Spending is capped at ${caps}.` : "",
    lim("kill_switch_drawdown_pct") ? `Trading stops after a ${lim("kill_switch_drawdown_pct")} loss.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHead title="What GRAIL is allowed to do. The limits are enforced in code, not by promises." summary={summary} aside={<span className="tag unk">READ-ONLY</span>} />

      <div className="stack">
        <Card title="Mode">
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`mode-badge ${s.dry_run === false ? "live" : s.dry_run ? "dry" : "unk"}`}>
              {s.dry_run === false ? "LIVE · real funds" : s.dry_run ? "PRACTICE MODE" : "Mode unknown"}
            </span>
            <span>
              {s.dry_run ? "Orders are simulated, but every decision is really sealed on Avalanche." : s.dry_run === false ? "Orders go to OKX TR with real money." : ""}
              <span className="tech">
                dry_run: {String(s.dry_run)} · account: {s.mode === "live" ? "OKX TR live account" : (s.mode ?? "?")} · switching is a config change, not a UI button
              </span>
            </span>
          </div>
        </Card>

        <Card title="Spending limits" meta="checked in code before every order">
          <div className="cols three">
            {LIMITS.map((k) => (
              <div key={k} className="stat">
                <Term plain={KNOWN[k].label} tech={k} />
                <div className="v" style={{ fontSize: 32 }}>
                  {lim(k) ?? <span className="dim">—</span>}
                </div>
                <div className="sub">{lim(k) ? KNOWN[k].hint : "not reported by the agent yet"}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="cols two">
          <Card title="Safety rules" meta="narrow the permission, cap the spend, keep the trail">
            <ul className="checks">
              {GUARDS.map((g) => (
                <li key={g.title}>
                  <span className="y" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <b>{g.title}</b>
                    <p>{g.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="All settings" meta="exactly what the agent reports">
            <table className="table">
              <tbody>
                <tr>
                  <td>
                    Coins it may trade<div className="tech">coins</div>
                  </td>
                  <td className="r">
                    {coins.length ? (
                      <span className="coins" style={{ justifyContent: "flex-end" }}>
                        {coins.map((c) => (
                          <span key={c} className="chip" style={{ color: "var(--text)" }}>
                            {coin(c)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                {keys.map((k) => {
                  const known = KNOWN[k];
                  const v = cfg[k];
                  return (
                    <tr key={k}>
                      <td>
                        {known ? known.label : <span className="mono muted">{k}</span>}
                        <div className="tech">
                          {k}
                          {known?.hint ? ` · ${known.hint}` : ""}
                        </div>
                      </td>
                      <td className="r" style={{ fontWeight: known ? 600 : 400 }}>
                        {known ? known.fmt(v) : <span className="mono muted">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        <Card title={<Term plain="Problems the agent reported" tech="System › Errors" />} meta="a failing step skips the round; the agent keeps running" id="system">
          {errors.length === 0 ? (
            <span className="chip ok">✓ No problems</span>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>What happened</th>
                    <th>Code</th>
                    <th>Where</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e, i) => (
                    <tr key={i}>
                      <td className="mono muted" style={{ whiteSpace: "nowrap" }}>
                        {dayClock(e.at_ms)}
                      </td>
                      <td>{e.message ?? "—"}</td>
                      <td>
                        <span className="errcode">{e.code ?? "ERROR"}</span>
                      </td>
                      <td className="mono muted">{e.where ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
