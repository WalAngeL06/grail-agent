import type { GrailState } from "../state";
import { AvalancheMark, PageHead } from "../components/Bits";
import { n, usd } from "../format";

/** Five cards, each a small diagram + two sentences. Live numbers are used when the agent's state is available. */
export default function HowItWorks({ s }: { s: GrailState | null }) {
  const N = s?.metrics.n_assets ?? 5;
  const ne = s?.metrics.n_eff;
  const maxOrder = s?.config.max_order_usdt as string | undefined;
  const maxTotal = s?.config.max_total_deploy_usdt as string | undefined;
  const kill = s?.config.kill_switch_drawdown_pct as number | undefined;

  return (
    <>
      <PageHead
        title="How GRAIL works, in five pictures."
        summary="GRAIL is an AI trading agent. It decides on its own, but it can't hide or change what it decided, and it can't spend beyond hard limits."
      />
      <div className="how">
        <article className="card how-card">
          <CorrDiagram />
          <h2>1 · More coins isn't always more safety</h2>
          <p>
            Coins that rise and fall together behave like one big bet. {ne !== undefined ? `Today GRAIL's ${N} coins move like ${n(ne, 1, 1)} independent bets.` : `Five coins can move like only one or two.`}
          </p>
          <p>So GRAIL measures how independent the coins really are and spreads risk across real bets, not across names.</p>
          <a className="linkbtn" href="#/dashboard">
            See the live chart →
          </a>
        </article>

        <article className="card how-card">
          <EnvelopeDiagram />
          <h2>2 · A sealed envelope, before every trade</h2>
          <p>Before trading, GRAIL locks a fingerprint of its decision on the Avalanche blockchain. After the trade, it opens the envelope and publishes the decision.</p>
          <p>Anyone can check that what was opened matches what was sealed, so results can't be edited or cherry-picked afterwards.</p>
          <a className="linkbtn" href="#/decisions">
            Verify a decision yourself →
          </a>
        </article>

        <article className="card how-card">
          <AiDiagram />
          <h2>3 · An AI second opinion that can only say "less"</h2>
          <p>Before sealing, a second AI reviews each planned buy. It may keep it, make it smaller, or cancel it, but it can never make a trade bigger or invent a new one.</p>
          <p>Sells skip this check, because reducing risk should never be blocked. Its note is sealed together with the decision.</p>
          <a className="linkbtn" href="#/decisions">
            See its notes →
          </a>
        </article>

        <article className="card how-card">
          <ShieldDiagram />
          <h2>4 · Hard safety limits, written in code</h2>
          <p>
            {maxOrder && maxTotal ? `At most ${usd(maxOrder)} per trade and ${usd(maxTotal)} in total` : "Per-trade and total spending caps"}
            {kill !== undefined ? `, and an emergency stop after a ${n(kill, 1)}% loss.` : ", plus an emergency stop."} The key can trade but can never withdraw money.
          </p>
          <p>It starts in practice mode: orders are simulated while decisions are really sealed. Going live is a human decision.</p>
          <a className="linkbtn" href="#/settings">
            See all limits →
          </a>
        </article>

        <article className="card how-card">
          <div className="diagram roles" aria-hidden="true">
            <div className="role">
              <span className="okx">OKX</span>
              <small>prices · balance · orders</small>
            </div>
            <span className="arrow">⇄</span>
            <div className="role">
              <b className="grail-dot">GRAIL</b>
              <small>decides</small>
            </div>
            <span className="arrow">⇄</span>
            <div className="role">
              <AvalancheMark size={30} />
              <small>public record</small>
            </div>
          </div>
          <h2>5 · OKX trades, Avalanche remembers</h2>
          <p>OKX TR is the exchange: GRAIL reads prices and its balance there and places the orders through the OKX Agent Trade Kit.</p>
          <p>Avalanche is the notary: the sealed decisions and the agent's identity card (ERC-8004) live there, readable by anyone.</p>
          <a className="linkbtn" href="#/ledger">
            Open the public record →
          </a>
        </article>
      </div>

      <details className="card math" style={{ marginTop: 16 }}>
        <summary>Glossary — plain words and the technical names behind them</summary>
        <dl className="glossary">
          <dt>Independent bets</dt>
          <dd>effective N, n_eff = N / (1 + (N−1)·ρ̄)</dd>
          <dt>How much coins move together</dt>
          <dd>average pairwise correlation ρ̄ of returns</dd>
          <dt>Return per unit of risk</dt>
          <dd>Sharpe ratio; portfolio Sharpe ≈ single-coin Sharpe · √n_eff ("Holy Grail" chart)</dd>
          <dt>Confidence the edge is real</dt>
          <dd>PSR, probabilistic Sharpe ratio</dd>
          <dt>Risk-balanced target</dt>
          <dd>HRP, hierarchical risk parity weights</dd>
          <dt>Sealed envelope</dt>
          <dd>commit–reveal: commit_hash = keccak256(payload ‖ salt) on GrailLedger, then revealDecision(payload, salt, okxOrderId)</dd>
          <dt>Fingerprint</dt>
          <dd>hash (keccak256)</dd>
          <dt>Secret key of the envelope</dt>
          <dd>salt, 32 random bytes per round</dd>
          <dt>Practice mode</dt>
          <dd>dry_run: orders simulated, decisions really on-chain</dd>
          <dt>Emergency stop</dt>
          <dd>kill switch on drawdown</dd>
          <dt>AI second opinion</dt>
          <dd>analyst llm_flag: approved / reduced / vetoed / skipped / exempt</dd>
          <dt>Agent identity card</dt>
          <dd>ERC-8004 IdentityRegistry agentId</dd>
        </dl>
      </details>
    </>
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
        move together = 1 bet
      </text>
      <text x="158" y="72" textAnchor="middle" fontSize="10" fill="var(--muted)">
        apart
      </text>
      <text x="215" y="50" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--grail)">
        ≈1.4
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
