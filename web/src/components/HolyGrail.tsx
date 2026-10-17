import { useMemo, useRef, useState } from "react";
import { n as fmt } from "../format";

// Holy Grail: N varlık, ortalama korelasyon ρ → efektif bağımsız bahis N_eff = 1 / (1/N + (1−1/N)·ρ)
// (engine/src/grail_engine/stats.py ile aynı). Portföy SR ≈ SR_tek · √N_eff.
export const nEff = (N: number, rho: number) => {
  const d = 1 / N + (1 - 1 / N) * rho;
  return d > 0 ? 1 / d : Infinity;
};

const W = 640;
const H = 300;
const M = { l: 40, r: 18, t: 14, b: 34 };

type Props = { nAssets?: number; rho?: number; nEffNow?: number; srSingle?: number };

export default function HolyGrail({ nAssets, rho, nEffNow, srSingle }: Props) {
  const hasRho = rho !== undefined;
  const [what, setWhat] = useState<number>(hasRho ? clamp(round2(rho!), 0, 1) : 0.6);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const N = nAssets && nAssets > 0 ? nAssets : undefined;
  const nNow = N !== undefined ? (nEffNow ?? (hasRho ? nEff(N, rho!) : undefined)) : undefined;
  const xMax = Math.max(20, (N ?? 0) + 5);
  const showWhat = !hasRho || Math.abs(what - rho!) > 0.004;

  const yMax = useMemo(() => {
    const cands = [hasRho ? nEff(xMax, Math.max(rho!, 0.02)) : 0, nEff(xMax, Math.max(what, 0.02)), nNow ?? 0, 4];
    const m = Math.max(...cands.filter(Number.isFinite));
    return Math.min(xMax, Math.ceil(m * 1.2));
  }, [hasRho, rho, what, xMax, nNow]);

  const x = (v: number) => M.l + ((v - 1) / (xMax - 1)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - (Math.min(v, yMax) / yMax) * (H - M.t - M.b);
  const path = (r: number) => {
    const pts: string[] = [];
    for (let i = 1; i <= xMax; i += 0.25) pts.push(`${x(i).toFixed(1)},${y(Math.min(nEff(i, r), yMax)).toFixed(1)}`);
    return "M" + pts.join("L");
  };
  const yTicks = ticks(yMax);
  const xTicks = [1, 5, 10, 15, 20, 25, 30].filter((t) => t <= xMax);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const v = Math.round(1 + ((px - M.l) / (W - M.l - M.r)) * (xMax - 1));
    setHover(v >= 1 && v <= xMax ? v : null);
  };

  const sr = (ne: number) => (srSingle !== undefined && Number.isFinite(ne) ? srSingle * Math.sqrt(ne) : undefined);
  const cap = (r: number) => (r > 0 ? 1 / r : Infinity);

  return (
    <div className="chart-wrap" ref={box}>
      <h3>Holy Grail eğrisi: coin sayısı arttıkça kaç bağımsız bahis kazanıyorsunuz</h3>
      <p className="sub">
        Ortalama korelasyon ρ̄ yüksekse eğri erken düzleşir; tavan 1/ρ̄. Kaydırıcıyla "korelasyon şu olsaydı" senaryosunu deneyin.
      </p>
      <div className="chart-legend" aria-hidden="true">
        {hasRho && (
          <span>
            <i style={{ borderColor: "var(--gold-chart)" }} />
            bugünkü ρ̄ = {fmt(rho, 2)}
          </span>
        )}
        {showWhat && (
          <span>
            <i style={{ borderColor: "var(--whatif)" }} />
            senaryo ρ = {fmt(what, 2)}
          </span>
        )}
        <span>
          <i className="dash" style={{ borderColor: "var(--ink-3)" }} />
          korelasyonsuz ideal (ρ = 0)
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Efektif bahis sayısı grafiği. ${N ?? "?"} coin, ortalama korelasyon ${fmt(rho, 2)}, efektif bahis ${fmt(nNow, 2)}.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ display: "block", touchAction: "pan-y" }}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - M.b + 18} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
            {t}
          </text>
        ))}
        <text x={W - M.r} y={H - 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
          coin sayısı (N)
        </text>
        <text x={M.l} y={M.t - 2} fontSize="11" fill="var(--ink-3)" dy="-2">
          efektif bahis
        </text>

        {/* ρ = 0 ideal: N_eff = N */}
        <clipPath id="plot">
          <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
        </clipPath>
        <g clipPath="url(#plot)">
          <line x1={x(1)} y1={y(1)} x2={x(xMax)} y2={y(xMax)} stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="4 4" />
          {hasRho && rho! > 0 && cap(rho!) < yMax && (
            <>
              <line x1={M.l} x2={W - M.r} y1={y(cap(rho!))} y2={y(cap(rho!))} stroke="var(--gold-chart)" strokeWidth="1" strokeDasharray="2 4" />
              <text x={W - M.r} y={y(cap(rho!)) - 6} textAnchor="end" fontSize="11" fill="var(--ink-2)">
                tavan 1/ρ̄ ≈ {fmt(cap(rho!), 2)}
              </text>
            </>
          )}
          {showWhat && <path d={path(what)} fill="none" stroke="var(--whatif)" strokeWidth="2" strokeLinejoin="round" />}
          {hasRho && <path d={path(rho!)} fill="none" stroke="var(--gold-chart)" strokeWidth="2.5" strokeLinejoin="round" />}
        </g>

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={H - M.b} stroke="var(--line-strong)" strokeWidth="1" />
        )}

        {N !== undefined && nNow !== undefined && Number.isFinite(nNow) && (
          <g>
            <circle cx={x(N)} cy={y(nNow)} r="7" fill="var(--gold)" stroke="var(--surface)" strokeWidth="2" />
            <text x={x(N) + 12} y={y(nNow) + 22} fontSize="12" fill="var(--ink)" fontWeight="600">
              şu an: {N} coin → {fmt(nNow, 2)} bahis
            </text>
          </g>
        )}
        {N !== undefined && showWhat && (
          <circle cx={x(N)} cy={y(Math.min(nEff(N, what), yMax))} r="5" fill="var(--whatif)" stroke="var(--surface)" strokeWidth="2" />
        )}
      </svg>

      {hover !== null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: 70 }}>
          <b>{hover} coin</b>
          {hasRho && (
            <div>
              ρ̄ {fmt(rho, 2)}: {fmt(nEff(hover, rho!), 2)} bahis · SR ≈ {fmt(sr(nEff(hover, rho!)), 2)}
            </div>
          )}
          {showWhat && (
            <div>
              ρ {fmt(what, 2)}: {fmt(nEff(hover, what), 2)} bahis · SR ≈ {fmt(sr(nEff(hover, what)), 2)}
            </div>
          )}
          <div className="faint">ρ = 0: {hover} bahis</div>
        </div>
      )}

      <div className="slider">
        <label htmlFor="rho">Senaryo korelasyonu</label>
        <input
          id="rho"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={what}
          onChange={(e) => setWhat(Number(e.target.value))}
          aria-valuetext={`ρ ${fmt(what, 2)}, ${N ?? 5} coin için ${fmt(nEff(N ?? 5, what), 2)} efektif bahis`}
        />
        <span className="val num">
          ρ {fmt(what, 2, 2)} → {fmt(nEff(N ?? 5, what), 2)} bahis
        </span>
      </div>
      {hasRho && showWhat && (
        <div style={{ textAlign: "right", marginTop: 6 }}>
          <span className="slider">
            <button onClick={() => setWhat(clamp(round2(rho!), 0, 1))}>Bugünkü ρ̄'ya dön</button>
          </span>
        </div>
      )}
      {!hasRho && <p className="sub">Engine henüz ortalama korelasyon yazmadı; sadece senaryo eğrisi gösteriliyor.</p>}
    </div>
  );
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
function ticks(max: number) {
  const step = max <= 6 ? 1 : max <= 12 ? 2 : 5;
  const out: number[] = [];
  for (let t = 0; t <= max; t += step) out.push(t);
  return out;
}
