import { useMemo, useState } from "react";
import replay from "../../../engine/out/replay.json";
import { n } from "../format";
import { T } from "../i18n";

// engine/out/replay.json (T-012): 30-day simulation on real OKX hourly prices, no real orders.
type Point = { t_ms: number; grail_usdt: number; buy_hold_usdt: number };
type Replay = {
  window?: { days?: number; start?: string; end?: string };
  assumptions?: { capital_usdt?: number; fee_pct?: number };
  grail?: { return_pct?: number; max_drawdown_pct?: number; times_went_to_cash?: number; final_usdt?: number };
  buy_hold?: { return_pct?: number; max_drawdown_pct?: number; final_usdt?: number };
  series?: Point[];
};
const R = replay as unknown as Replay;

const W = 960;
const H = 250;
const M = { l: 40, r: 130, t: 10, b: 26 };
const GOLD = "var(--grail)";
const BH = "#5b8fe0";

export function replaySummary() {
  const g = R.grail ?? {};
  const b = R.buy_hold ?? {};
  return { g, b, days: R.window?.days ?? 30 };
}

export default function ReplayChart() {
  const [hover, setHover] = useState<number | null>(null);
  const pts = useMemo(() => {
    const s = Array.isArray(R.series) ? R.series.filter((p) => Number.isFinite(p.grail_usdt) && Number.isFinite(p.buy_hold_usdt)) : [];
    const step = Math.max(1, Math.floor(s.length / 240));
    return s.filter((_, i) => i % step === 0 || i === s.length - 1);
  }, []);
  if (pts.length < 2) return <p className="muted">{T("Replay data is not available in this build.", "Bu sürümde replay verisi yok.")}</p>;

  const t0 = pts[0].t_ms;
  const t1 = pts[pts.length - 1].t_ms;
  const vals = pts.flatMap((p) => [p.grail_usdt, p.buy_hold_usdt]);
  const lo = Math.floor(Math.min(...vals) - 0.5);
  const hi = Math.ceil(Math.max(...vals) + 0.5);
  const x = (t: number) => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - ((v - lo) / (hi - lo)) * (H - M.t - M.b);
  const line = (k: "grail_usdt" | "buy_hold_usdt") => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t_ms).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const ticks: number[] = [];
  const stepY = hi - lo > 8 ? 2 : 1;
  for (let v = Math.ceil(lo / stepY) * stepY; v <= hi; v += stepY) ticks.push(v);
  const last = pts[pts.length - 1];
  const fmtDay = (t: number) => new Date(t).toLocaleDateString(T("en-GB", "tr-TR"), { day: "numeric", month: "short" });
  const hp = hover !== null ? pts[hover] : null;

  // keep the two end labels at least 14 px apart
  let yg = y(last.grail_usdt);
  let yb = y(last.buy_hold_usdt);
  if (Math.abs(yg - yb) < 14) {
    if (yg <= yb) yb = yg + 14;
    else yg = yb + 14;
  }

  return (
    <div className="chart-box">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`30 days: GRAIL ended at ${n(last.grail_usdt, 2, 2)} USDT, equal-weight buy-and-hold at ${n(last.buy_hold_usdt, 2, 2)} USDT, both starting from ${n(pts[0].grail_usdt, 0)}.`}
        onPointerMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - b.left) / b.width) * W;
          const t = t0 + ((px - M.l) / (W - M.l - M.r)) * (t1 - t0);
          let best = 0;
          for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].t_ms - t) < Math.abs(pts[best].t_ms - t)) best = i;
          setHover(px >= M.l && px <= W - M.r ? best : null);
        }}
        onPointerLeave={() => setHover(null)}
        style={{ display: "block", touchAction: "pan-y" }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--surface-2)" />
            <text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--dim)" fontFamily="var(--mono)">
              {v}
            </text>
          </g>
        ))}
        {[t0, t0 + (t1 - t0) / 2, t1].map((t, i) => (
          <text key={i} x={x(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} fontSize="10" fill="var(--dim)">
            {fmtDay(t)}
          </text>
        ))}
        <path d={line("buy_hold_usdt")} fill="none" stroke={BH} strokeWidth="2" strokeLinejoin="round" />
        <path d={line("grail_usdt")} fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="round" />
        <text x={W - M.r + 8} y={yg + 4} fontSize="11" fontWeight="600" fill="var(--text)">
          GRAIL {n(last.grail_usdt, 2, 2)}
        </text>
        <text x={W - M.r + 8} y={yb + 4} fontSize="11" fill="var(--muted)">
          {T("Buy & hold", "Al-tut")} {n(last.buy_hold_usdt, 2, 2)}
        </text>
        {hp && (
          <g>
            <line x1={x(hp.t_ms)} x2={x(hp.t_ms)} y1={M.t} y2={H - M.b} stroke="var(--border-strong)" />
            <circle cx={x(hp.t_ms)} cy={y(hp.grail_usdt)} r="4" fill={GOLD} stroke="var(--surface)" strokeWidth="2" />
            <circle cx={x(hp.t_ms)} cy={y(hp.buy_hold_usdt)} r="4" fill={BH} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hp && (
        <div className="tooltip" style={{ left: `${(x(hp.t_ms) / W) * 100}%`, top: 4 }}>
          <b>{new Date(hp.t_ms).toLocaleString(T("en-GB", "tr-TR"), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b>
          <div>GRAIL {n(hp.grail_usdt, 2, 2)} USDT</div>
          <div className="muted">
            {T("Buy & hold", "Al-tut")} {n(hp.buy_hold_usdt, 2, 2)} USDT
          </div>
        </div>
      )}
      <div className="chart-legend" style={{ marginTop: 6 }}>
        <span>
          <i style={{ borderColor: GOLD, borderTopWidth: 3 }} />
          GRAIL {T("(simulated, same rules as live)", "(simülasyon, canlıyla aynı kurallar)")}
        </span>
        <span>
          <i style={{ borderColor: BH }} />
          {T("Buy & hold all 5 coins equally", "5 coinin hepsini eşit al-tut")}
        </span>
      </div>
    </div>
  );
}
