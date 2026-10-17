import type { GrailState } from "../state";
import { AvalancheMark, PageHead } from "../components/Bits";
import { n, usd } from "../format";
import ReplayChart, { replaySummary } from "../components/ReplayChart";

/** Five cards, each a small diagram + two sentences. Live numbers are used when the agent's state is available. */
export default function HowItWorks({ s }: { s: GrailState | null }) {
  const maxOrder = s?.config.max_order_usdt as string | undefined;
  const maxTotal = s?.config.max_total_deploy_usdt as string | undefined;
  const kill = s?.config.kill_switch_drawdown_pct as number | undefined;
  const { g, b, days } = replaySummary();

  return (
    <>
      <PageHead eyebrow="How it works" title="Five ideas behind every decision GRAIL makes." />
      <div className="how">
        <article className="card how-card">
          <CorrDiagram />
          <h2>1 · Independent bets</h2>
          <p>
            Coins that rise and fall together act like one bet, so five coins can be worth barely more than one. GRAIL counts real bets, not coins, and
            sizes every position by them.
          </p>
          <a className="linkbtn" href="#/dashboard">
            See the live chart →
          </a>
        </article>

        <article className="card how-card">
          <EnvelopeDiagram />
          <h2>2 · Sealed envelope</h2>
          <p>
            Before any order, GRAIL writes a fingerprint of its decision to Avalanche, like sealing an envelope. After the trade it opens the envelope,
            so anyone can check that nothing changed.
          </p>
          <a className="linkbtn" href="#/decisions">
            Verify a decision yourself →
          </a>
        </article>

        <article className="card how-card">
          <AiDiagram />
          <h2>3 · AI second opinion</h2>
          <p>An AI reviews each buy and can make it smaller or cancel it. It can never make a trade bigger, and it never blocks a sell.</p>
          <a className="linkbtn" href="#/decisions">
            See its verdicts →
          </a>
        </article>

        <article className="card how-card">
          <ShieldDiagram />
          <h2>4 · Safety limits</h2>
          <p>
            The agent can only buy and sell spot coins from its list, with hard caps per order and in total
            {maxOrder && maxTotal ? ` (${usd(maxOrder)} and ${usd(maxTotal)})` : ""}. It cannot withdraw money or borrow, and an emergency stop pauses new
            orders while the account is {kill !== undefined ? `${n(kill, 1)}%` : "a set percentage"} or more below its high. It does not sell, so a drop can
            go past that line.
          </p>
          <a className="linkbtn" href="#/settings">
            See all limits →
          </a>
        </article>

        <article className="card how-card">
          <div className="diagram roles" aria-hidden="true">
            <div className="role">
              <span className="okx">OKX</span>
              <small>prices · orders</small>
            </div>
            <span className="arrow">⇄</span>
            <div className="role">
              <b className="grail-dot">GRAIL</b>
              <small>decides</small>
            </div>
            <span className="arrow">⇄</span>
            <div className="role">
              <AvalancheMark size={30} />
              <small>record</small>
            </div>
          </div>
          <h2>5 · OKX + Avalanche</h2>
          <p>OKX Agent Trade Kit gives GRAIL live prices and places its orders on OKX TR. Avalanche keeps the record of every decision, which no one can edit.</p>
          <a className="linkbtn" href="#/ledger">
            Open the on-chain record →
          </a>
        </article>
      </div>

      {s && Object.keys(s.metrics.signals).length > 0 && <SmartEntry s={s} />}

      <section className="card replay" style={{ marginTop: 16 }} aria-label={`Last ${days} days`}>
        <div className="replay-head">
          <div>
            <div className="eyebrow">Last {days} days · simulation on real OKX hourly prices, no real orders</div>
            <h2>
              {drawdownHeadline(g.max_drawdown_pct, b.max_drawdown_pct)}: <span className="gold">{n(g.max_drawdown_pct, 1, 1)}%</span> vs{" "}
              {n(b.max_drawdown_pct, 1, 1)}%
            </h2>
            <p className="muted">
              Starting from {n(R_START(), 0)} USDT, GRAIL's worst fall from a high was {n(g.max_drawdown_pct, 1, 1)}%, against {n(b.max_drawdown_pct, 1, 1)}% for
              simply holding all 5 coins. The price of that calm: it made <b>{signed(g.return_pct)}</b> while buy-and-hold made <b>{signed(b.return_pct)}</b>.
              It stepped fully into cash {g.times_went_to_cash ?? "—"} times when prices turned down.
            </p>
          </div>
          <dl className="replay-stats">
            <div>
              <dt>Worst drop</dt>
              <dd>
                <span className="gold">{n(g.max_drawdown_pct, 1, 1)}%</span> <span className="muted">vs {n(b.max_drawdown_pct, 1, 1)}%</span>
              </dd>
            </div>
            <div>
              <dt>Return</dt>
              <dd>
                {signed(g.return_pct)} <span className="muted">vs {signed(b.return_pct)}</span>
              </dd>
            </div>
          </dl>
        </div>
        <ReplayChart />
        <p className="tech" style={{ marginTop: 8 }}>
          engine/out/replay.json · 1 engine decision per closed 1H bar · 0.1% fee · fills at bar close, no slippage · same limits as the live config · past
          results are no promise
        </p>
      </section>

      <details className="card math" style={{ marginTop: 16 }}>
        <summary>Glossary — plain words and the technical names behind them</summary>
        <dl className="glossary">
          <dt>Independent bets</dt>
          <dd>n_eff (effective N) = N / (1 + (N−1)·ρ̄). How many truly separate bets your coins add up to.</dd>
          <dt>Togetherness</dt>
          <dd>ρ̄, average pairwise correlation of returns, from 0 (independently) to 1 (in lockstep).</dd>
          <dt>Return per unit of risk</dt>
          <dd>Sharpe ratio (SR). On the dashboard it is an illustration: SR₁ = 0.5 assumed per coin, × √n_eff.</dd>
          <dt>Chance the basket's trend is real</dt>
          <dd>PSR(SR&gt;0) of the risk-balanced basket of all coins over the last 48h, in-sample. Not GRAIL's own track record.</dd>
          <dt>Family-based sizing</dt>
          <dd>HRP, hierarchical risk parity: coins that behave alike are grouped and each family gets its share of risk.</dd>
          <dt>Seal / Open</dt>
          <dd>commit / reveal on GrailLedger: commit_hash = keccak256(payload ‖ salt), then revealDecision(payload, salt, okxOrderId).</dd>
          <dt>Fingerprint</dt>
          <dd>hash (keccak256). Change one character and it changes completely.</dd>
          <dt>Random code</dt>
          <dd>salt, 32 random bytes per check-in. Not a password or wallet key.</dd>
          <dt>Practice mode</dt>
          <dd>dry_run: decisions are made and sealed for real, orders are only simulated.</dd>
          <dt>Emergency stop</dt>
          <dd>kill switch: no new orders while equity is the set percentage or more below its peak. It does not sell.</dd>
          <dt>Check-in</dt>
          <dd>cycle: read the market, decide, seal, trade, open.</dd>
          <dt>AI verdict</dt>
          <dd>llm_flag: approved · reduced · vetoed · exempt (sells are not reviewed) · skipped (nothing to review, or AI unavailable).</dd>
          <dt>On-chain ID card</dt>
          <dd>ERC-8004 IdentityRegistry agentId.</dd>
        </dl>
      </details>
    </>
  );
}

/** Headline from the replay numbers themselves, so it stays true when replay.json changes. */
export function drawdownHeadline(g?: number, b?: number): string {
  if (g === undefined || b === undefined || !(b > 0)) return "Worst drop";
  const f = g / b;
  if (f > 1.1) return "A deeper worst drop than buy-and-hold";
  if (f >= 0.9) return "About the same worst drop";
  if (f >= 0.55) return `A ${Math.round((1 - f) * 100)}% smaller worst drop`;
  if (f >= 0.48) return "Half the worst drop";
  if (f >= 0.36) return "Less than half the worst drop";
  if (f >= 0.3) return "About a third of the worst drop";
  if (f >= 0.2) return "Less than a third of the worst drop";
  return `A ${n(1 / f, 0)}× smaller worst drop`;
}

const signed = (v?: number) => (v === undefined ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${n(Math.abs(v), 1, 1)}%`);
const R_START = () => (replaySummary() as unknown as { g: { start_usdt?: number } }).g.start_usdt ?? 50;

function SmartEntry({ s }: { s: GrailState }) {
  const sig = s.metrics.signals;
  const coins = Object.keys(sig);
  const trending = coins.filter((c) => sig[c].regime === "trending").length;
  const confirmed = coins.filter((c) => sig[c].setup === "retest").length;
  return (
    <article className="card how-card" style={{ marginTop: 16 }}>
      <EntryDiagram />
      <h2>6 · Smart entry</h2>
      <p>
        First GRAIL asks whether the market is trending or just moving sideways, using the Hurst exponent. In a sideways market, breakouts usually fail,
        so it waits.
      </p>
      <p>
        When a price breaks out of its range, GRAIL waits for it to come back, test the old ceiling and hold. That retest confirms the move and allows a
        full-size buy; with no breakout at all it buys only half size. These checks can only shrink a buy, never enlarge it. Right now:{" "}
        {trending} of {coins.length} coins trending, {confirmed} breakout{confirmed === 1 ? "" : "s"} confirmed by a retest.
      </p>
      <a className="linkbtn" href="#/decisions">
        See the signals per coin →
      </a>
    </article>
  );
}

function EntryDiagram() {
  // range box, breakout above it, pullback to the old top (retest), then continuation
  return (
    <svg className="diagram" viewBox="0 0 240 80" aria-hidden="true">
      <rect x="14" y="34" width="96" height="30" rx="3" fill="rgba(245,165,36,.08)" stroke="var(--warn)" strokeDasharray="3 3" />
      <text x="62" y="76" textAnchor="middle" fontSize="9" fill="var(--muted)">
        range (sideways)
      </text>
      <path d="M18 56 L30 42 L42 58 L54 40 L66 57 L78 41 L90 55 L104 38 L122 18 L138 34 L154 34 L170 16 L196 8 L226 4" fill="none" stroke="var(--grail)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="122" cy="18" r="3.5" fill="var(--proof)" />
      <text x="122" y="12" textAnchor="middle" fontSize="9" fill="var(--proof)">
        breakout
      </text>
      <circle cx="146" cy="34" r="3.5" fill="var(--buy)" />
      <text x="146" y="48" textAnchor="middle" fontSize="9" fill="var(--buy)">
        retest holds
      </text>
    </svg>
  );
}

function CorrDiagram() {
  // five coins: four clustered (move together) + one apart → "≈ 1.4 bets"
  return (
    <svg className="diagram" viewBox="0 0 240 90" aria-hidden="true">
      <ellipse cx="70" cy="45" rx="52" ry="32" fill="rgba(232,176,75,.10)" stroke="var(--grail)" strokeDasharray="3 3" />
      {[
        [52, 34],
        [80, 30],
        [60, 58],
        [88, 55],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="var(--surface-2)" stroke="var(--grail)" strokeWidth="1.5" />
      ))}
      <circle cx="158" cy="45" r="9" fill="var(--surface-2)" stroke="var(--proof)" strokeWidth="1.5" />
      <text x="70" y="88" textAnchor="middle" fontSize="10" fill="var(--muted)">
        4 of 5 coins move together
      </text>
      <text x="158" y="72" textAnchor="middle" fontSize="10" fill="var(--muted)">
        apart
      </text>
      <text x="215" y="50" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--grail)">
        ≈1.5
      </text>
    </svg>
  );
}

function EnvelopeDiagram() {
  const step = (x: number, label: string, color: string, glyph: string) => (
    <g>
      <circle cx={x} cy="34" r="16" fill="var(--surface-2)" stroke={color} strokeWidth="1.5" />
      <text x={x} y="39" textAnchor="middle" fontSize="14" fill={color}>
        {glyph}
      </text>
      <text x={x} y="68" textAnchor="middle" fontSize="10" fill="var(--muted)">
        {label}
      </text>
    </g>
  );
  return (
    <svg className="diagram" viewBox="0 0 240 80" aria-hidden="true">
      <line x1="30" y1="34" x2="210" y2="34" stroke="var(--border-strong)" />
      {step(30, "decide", "var(--text)", "✎")}
      {step(90, "seal", "var(--proof)", "🔒")}
      {step(150, "trade", "var(--text)", "⇄")}
      {step(210, "open", "var(--buy)", "✓")}
    </svg>
  );
}

function AiDiagram() {
  return (
    <svg className="diagram" viewBox="0 0 240 80" aria-hidden="true">
      <rect x="10" y="20" width="56" height="28" rx="6" fill="var(--buy-wash)" stroke="var(--buy)" />
      <text x="38" y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--buy)">
        Buy $10
      </text>
      <path d="M70 34h26" stroke="var(--muted)" />
      <circle cx="116" cy="34" r="17" fill="var(--surface-2)" stroke="var(--proof)" />
      <text x="116" y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--proof)">
        AI
      </text>
      <path d="M134 26l30-12M134 34h30M134 42l30 12" stroke="var(--muted)" />
      <text x="170" y="17" fontSize="10" fill="var(--buy)">
        keep $10
      </text>
      <text x="170" y="38" fontSize="10" fill="var(--warn)">
        smaller $4
      </text>
      <text x="170" y="59" fontSize="10" fill="var(--danger)">
        cancel
      </text>
      <text x="120" y="76" textAnchor="middle" fontSize="10" fill="var(--muted)">
        never bigger · never new
      </text>
    </svg>
  );
}

function ShieldDiagram() {
  return (
    <svg className="diagram" viewBox="0 0 240 80" aria-hidden="true">
      <path d="M40 8 18 16v18c0 15 9 27 22 31 13-4 22-16 22-31V16Z" fill="var(--surface-2)" stroke="var(--buy)" strokeWidth="1.5" />
      <path d="m31 36 6 6 12-13" fill="none" stroke="var(--buy)" strokeWidth="2" strokeLinecap="round" />
      {[
        ["per trade cap", 20],
        ["total cap", 40],
        ["emergency stop", 60],
      ].map(([t, y]) => (
        <g key={t as string}>
          <rect x="80" y={(y as number) - 10} width="140" height="14" rx="3" fill="var(--surface-2)" />
          <text x="88" y={(y as number) + 1} fontSize="10" fill="var(--text)">
            ✓ {t}
          </text>
        </g>
      ))}
    </svg>
  );
}
