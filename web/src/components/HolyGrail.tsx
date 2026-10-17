import { useState } from "react";
import { n as fmt } from "../format";

// docs/ui-brief.md §2 — n_eff(N, ρ) = N / (1 + (N−1)ρ), SR_p = SR₁ · √n_eff  (engine/src/grail_engine/stats.py ile aynı)
export const nEff = (N: number, rho: number) => {
  const d = 1 + (N - 1) * rho;
  return d > 0 ? N / d : Infinity;
};
const srP = (sr1: number, N: number, rho: number) => sr1 * Math.sqrt(nEff(N, rho));

const W = 720;
const H = 320;
const M = { l: 44, r: 64, t: 16, b: 36 };
const X_MAX = 20;
const REFS = [0, 0.2, 0.4, 0.8];

type Props = { nAssets?: number; rho?: number; srSingle?: number; srNow?: number; curve: { n: number; sr: number }[] };

export default function HolyGrail({ nAssets, rho, srSingle, srNow, curve }: Props) {
  const live = rho !== undefined ? clamp(round2(rho), 0, 0.95) : undefined;
  const [what, setWhat] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const r = what ?? live ?? 0.5;
  const isWhatIf = what !== null && live !== undefined && Math.abs(what - live) > 0.0001;
  const sr1 = srSingle ?? 0.5;
  const N = nAssets && nAssets > 0 ? Math.min(nAssets, X_MAX) : undefined;

  const yMax = Math.ceil(srP(sr1, X_MAX, 0) * 2) / 2;
  const x = (v: number) => M.l + ((v - 1) / (X_MAX - 1)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - (Math.min(v, yMax) / yMax) * (H - M.t - M.b);
  const path = (rr: number) => {
    let d = "";
    for (let i = 1; i <= X_MAX; i += 0.25) d += `${i === 1 ? "M" : "L"}${x(i).toFixed(1)},${y(srP(sr1, i, rr)).toFixed(1)}`;
    return d;
  };
  const yTicks: number[] = [];
  for (let t = 0; t <= yMax + 1e-9; t += 0.5) yTicks.push(Number(t.toFixed(1)));

  const nowSr = N !== undefined ? (!isWhatIf && srNow !== undefined ? srNow : srP(sr1, N, r)) : undefined;
  const nowBets = N !== undefined ? nEff(N, r) : undefined;
  const ceiling = r > 0 ? sr1 / Math.sqrt(r) : undefined;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * W;
    const v = Math.round(1 + ((px - M.l) / (W - M.l - M.r)) * (X_MAX - 1));
    setHover(v >= 1 && v <= X_MAX ? v : null);
  };

  return (
    <div>
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i style={{ borderColor: "var(--grail)", borderTopWidth: 3 }} />
          {isWhatIf ? `what-if ρ = ${fmt(r, 2)}` : `live ρ̄ = ${fmt(r, 2)}`}
        </span>
        {isWhatIf && (
          <span>
            <i className="dash" style={{ borderColor: "var(--grail)" }} />
            live ρ̄ = {fmt(live, 2)}
          </span>
        )}
        <span>
          <i className="thin" style={{ borderColor: "var(--dim)" }} />
          reference ρ = 0, 0.2, 0.4, 0.8
        </span>
        <span>
          <i className="dash thin" style={{ borderColor: "var(--muted)" }} />
          correlation ceiling SR₁/√ρ
        </span>
      </div>

      <div className="chart-box">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Portfolio Sharpe versus number of assets. ${N ?? "?"} coins at correlation ${fmt(r, 2)} give ${fmt(nowBets, 2)} effective bets and Sharpe ${fmt(nowSr, 2)}.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          style={{ display: "block", touchAction: "pan-y" }}
        >
          <defs>
            <clipPath id="hg-plot">
              <rect x={M.l} y={M.t - 2} width={W - M.l - M.r + 2} height={H - M.t - M.b + 4} />
            </clipPath>
          </defs>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--dim)">
                {t.toFixed(1)}
              </text>
            </g>
          ))}
          {[1, 5, 10, 15, 20].map((t) => (
            <text key={t} x={x(t)} y={H - M.b + 18} textAnchor="middle" fontSize="11" fill="var(--dim)">
              {t}
            </text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--muted)">
            number of assets
          </text>
          <text x={12} y={(M.t + H - M.b) / 2} fontSize="11" fill="var(--muted)" textAnchor="middle" transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>
            portfolio Sharpe
          </text>

          <g clipPath="url(#hg-plot)">
            {REFS.map((rr) => (
              <g key={rr}>
                <path d={path(rr)} fill="none" stroke="var(--dim)" strokeWidth="1" opacity="0.7" />
                <text x={W - M.r + 6} y={y(srP(sr1, X_MAX, rr)) + 4} fontSize="11" fill="var(--dim)">
                  ρ {rr}
                </text>
              </g>
            ))}
            {ceiling !== undefined && ceiling < yMax && (
              <g>
                <line x1={M.l} x2={W - M.r} y1={y(ceiling)} y2={y(ceiling)} stroke="var(--muted)" strokeDasharray="4 4" />
                <text x={M.l + 6} y={y(ceiling) - 6} fontSize="11" fill="var(--muted)">
                  correlation ceiling {fmt(ceiling, 2)}
                </text>
              </g>
            )}
            {isWhatIf && live !== undefined && (
              <path d={path(live)} fill="none" stroke="var(--grail)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
            )}
            <path d={path(r)} fill="none" stroke="var(--grail)" strokeWidth="3" strokeLinejoin="round" />
            {!isWhatIf &&
              curve
                .filter((p) => p.n >= 1 && p.n <= X_MAX)
                .map((p) => <circle key={p.n} cx={x(p.n)} cy={y(p.sr)} r="3.5" fill="var(--bg)" stroke="var(--grail)" strokeWidth="1.5" />)}
          </g>

          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={H - M.b} stroke="var(--border-strong)" />}

          {N !== undefined && nowSr !== undefined && Number.isFinite(nowSr) && (
            <g>
              <circle className="pulse" cx={x(N)} cy={y(nowSr)} r="7" fill="none" stroke="var(--grail)" strokeWidth="2" />
              <circle cx={x(N)} cy={y(nowSr)} r="6" fill="var(--grail)" stroke="var(--bg)" strokeWidth="2" />
              <text x={x(N) + 12} y={y(nowSr) - 12} fontSize="12" fontWeight="600" fill="var(--text)">
                You are here: {N} coins ≈ {fmt(nowBets, 2)} bets
              </text>
            </g>
          )}
        </svg>

        {hover !== null && (
          <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: 8 }}>
            <b>{hover} assets</b>
            <div>
              ρ {fmt(r, 2)}: Sharpe {fmt(srP(sr1, hover, r), 2)} · {fmt(nEff(hover, r), 2)} bets
            </div>
            <div className="muted">ρ 0: Sharpe {fmt(srP(sr1, hover, 0), 2)}</div>
          </div>
        )}
      </div>

      <div className="slider">
        <label htmlFor="rho">Correlation ρ</label>
        <input
          id="rho"
          type="range"
          min={0}
          max={0.95}
          step={0.01}
          value={r}
          onChange={(e) => setWhat(Number(e.target.value))}
          aria-valuetext={`ρ ${fmt(r, 2)}: ${N ?? 5} coins give ${fmt(nEff(N ?? 5, r), 2)} effective bets`}
        />
        <span className="val">
          ρ {fmt(r, 2, 2)} → {fmt(nEff(N ?? 5, r), 2)} bets
        </span>
      </div>
      <div className="whatif">
        {isWhatIf && (
          <>
            <span className="chip warn">what-if</span>
            <button className="linkbtn" onClick={() => setWhat(null)}>
              Reset to live ρ̄ ({fmt(live, 2)})
            </button>
          </>
        )}
        {live === undefined && <span className="muted">No live correlation yet — curve uses the slider value.</span>}
      </div>
      <p className="chart-note">Adding coins that move together adds almost nothing. GRAIL sizes positions by effective bets.</p>
    </div>
  );
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
