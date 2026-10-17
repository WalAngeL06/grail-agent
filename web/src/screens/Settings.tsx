import type { GrailState } from "../state";
import { Card } from "../components/Bits";
import { coin, dayClock, n, usd } from "../format";

// Settings is read-only (ui-brief §1.4): the UI never writes config and never places orders.
type Known = { label: string; fmt: (v: unknown) => string; hint?: string };
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const asPct = (v: unknown) => (Number.isFinite(num(v)) ? `${n(num(v), 2)}%` : String(v));
const asUsd = (v: unknown) => (Number.isFinite(num(v)) ? usd(String(v)) : String(v));

const KNOWN: Record<string, Known> = {
  max_order_usdt: { label: "Max per order", fmt: asUsd, hint: "No single order can exceed this." },
  max_total_deploy_usdt: { label: "Max total deployed", fmt: asUsd, hint: "Total USDT the agent may put to work." },
  min_order_usdt: { label: "Min order", fmt: asUsd, hint: "Smaller rebalances are skipped." },
  kill_switch_drawdown_pct: { label: "Drawdown kill switch", fmt: asPct, hint: "No new orders beyond this drawdown." },
  max_position_pct: { label: "Max weight per coin", fmt: asPct },
  risk_budget_pct: { label: "Risk budget per coin", fmt: asPct, hint: "weight × annual vol ≤ budget" },
  target_vol_pct: { label: "Portfolio volatility target", fmt: asPct },
  cycle_seconds: { label: "Cycle length", fmt: (v) => `${String(v)} s` },
  candle_bar: { label: "Candle bar", fmt: (v) => String(v) },
  lookback_bars: { label: "Lookback", fmt: (v) => `${String(v)} bars` },
  okx_site: { label: "OKX site", fmt: (v) => String(v).toUpperCase() },
  quote: { label: "Quote currency", fmt: (v) => String(v) },
};
const ORDER = Object.keys(KNOWN);

const GUARDS: { ok: boolean; title: string; text: string }[] = [
  { ok: true, title: "Spot only", text: "No derivatives, no margin." },
  { ok: true, title: "No leverage", text: "The leverage setting is never called." },
  { ok: true, title: "Config coins only", text: "Orders outside the coin list are rejected in code." },
  { ok: true, title: "Per-order and total caps", text: "Enforced in code before every order." },
  { ok: true, title: "Drawdown kill switch", text: "Stops new orders when the drawdown limit is hit." },
  { ok: true, title: "API key without withdraw", text: "Read + Trade only. No withdrawal or transfer exists anywhere in the code." },
  { ok: true, title: "Fail-closed", text: "If the commit transaction fails, no order is placed that cycle." },
];

export default function Settings({ s }: { s: GrailState }) {
  const cfg = s.config;
  const coins = Array.isArray(cfg.coins) ? (cfg.coins as unknown[]).filter((c): c is string => typeof c === "string") : [];
  const keys = Object.keys(cfg).filter((k) => k !== "coins" && k !== "dry_run" && k !== "mode");
  keys.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  const errors = [...s.errors].sort((a, b) => (b.at_ms ?? 0) - (a.at_ms ?? 0));

  return (
    <>
      <div className="head">
        <div>
          <h1>Settings</h1>
          <p>Read-only view of what the agent is allowed to do. Limits live in config and are enforced in code, under human control.</p>
        </div>
      </div>

      <div className="stack">
        <Card title="Mode">
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`mode-badge ${s.dry_run === false ? "live" : s.dry_run ? "dry" : "unk"}`}>
              {s.dry_run === false ? "LIVE · real funds" : s.dry_run ? "DRY RUN · simulated orders" : "Mode unknown"}
            </span>
            <span className="muted">
              {s.mode && <>Account: {s.mode === "live" ? "OKX TR live account" : s.mode}. </>}
              Switching to live is a human action (config), not a UI button.
            </span>
          </div>
        </Card>

        <div className="cols two">
          <Card title="Config" meta="from the agent's running state">
            <table className="table">
              <tbody>
                <tr>
                  <td className="muted">Coins</td>
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
                        {known ? (
                          <>
                            {known.label}
                            {known.hint && (
                              <div className="dim" style={{ fontSize: 12 }}>
                                {known.hint}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="mono muted">{k}</span>
                        )}
                      </td>
                      <td className="r" style={{ fontWeight: known ? 600 : 400 }}>
                        {known ? known.fmt(v) : <span className="mono">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card title="Guardrails" meta="narrow the permission, cap the spend, keep the trail">
            <ul className="checks">
              {GUARDS.map((g) => (
                <li key={g.title}>
                  <span className={g.ok ? "y" : "n"} aria-hidden="true">
                    ✔
                  </span>
                  <div>
                    <b>{g.title}</b>
                    <p>{g.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="System › Errors" meta="a failing step skips the cycle; the agent keeps running" id="system">
          {errors.length === 0 ? (
            <span className="chip ok">No errors</span>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Code</th>
                    <th>Message</th>
                    <th>Where</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e, i) => (
                    <tr key={i}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>
                        {dayClock(e.at_ms)}
                      </td>
                      <td>
                        <span className="errcode">{e.code ?? "ERROR"}</span>
                      </td>
                      <td>{e.message ?? "—"}</td>
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
