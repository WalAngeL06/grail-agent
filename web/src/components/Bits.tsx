import { Component, useEffect, useState, type ReactNode } from "react";
import { isAddress, isHex32 } from "../verify";
import { shortHash } from "../format";

export function Card(props: { title?: ReactNode; meta?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${props.className ?? ""}`} id={props.id}>
      {props.title && (
        <h2 className="card-title">
          <span>{props.title}</span>
          {props.meta && <span className="card-meta">{props.meta}</span>}
        </h2>
      )}
      {props.children}
    </section>
  );
}

/** Plain-language label first; the technical name sits underneath, small and gray, with a "?" hint. */
export function Term({ plain, tech, tip, big }: { plain: ReactNode; tech?: string; tip?: string; big?: boolean }) {
  return (
    <span className={`term ${big ? "big" : ""}`}>
      <span className="term-plain">{plain}</span>
      {(tech || tip) && (
        <span className="term-tech">
          {tech}
          {tip && <Hint text={tip} />}
        </span>
      )}
    </span>
  );
}

export function Hint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="hint" onMouseLeave={() => setOpen(false)}>
      <button type="button" className="hint-btn" aria-label={text} aria-expanded={open} onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)}>
        ?
      </button>
      {open && (
        <span className="hint-pop" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}

/** Big one-sentence "what you're looking at" + a live summary built from state. */
export function PageHead({ eyebrow, title, summary, aside }: { eyebrow?: string; title: string; summary?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {summary && <p className="live">{summary}</p>}
      </div>
      {aside}
    </header>
  );
}

export function Empty(props: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{props.title}</b>
      {props.children}
    </div>
  );
}

// ---- copy + toast ----
let pushToast: ((s: string) => void) | null = null;
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: number | undefined;
    pushToast = (s) => {
      setMsg(s);
      window.clearTimeout(t);
      t = window.setTimeout(() => setMsg(null), 1400);
    };
    return () => {
      pushToast = null;
      window.clearTimeout(t);
    };
  }, []);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

export function CopyButton({ value }: { value: string }) {
  return (
    <button
      className="copy"
      title="Copy"
      aria-label={`Copy ${value}`}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => pushToast?.(`Copied ${shortHash(value)}`),
          () => undefined,
        );
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
      </svg>
    </button>
  );
}

export function Hash({ value, full }: { value?: string; full?: boolean }) {
  if (!value) return <span className="dim">—</span>;
  return (
    <span style={{ whiteSpace: full ? "normal" : "nowrap", wordBreak: full ? "break-all" : undefined }}>
      <span className="mono" title={value} style={{ fontSize: 12.5 }}>
        {full ? value : shortHash(value)}
      </span>
      <CopyButton value={value} />
    </span>
  );
}

/** Snowtrace link; values that aren't real hashes/addresses (mock "0xabc...") are shown as text, never linked. */
export function ExplorerLink(props: { explorer?: string; kind: "tx" | "address"; value?: string; full?: boolean; label?: string }) {
  const { explorer, kind, value } = props;
  if (!value) return <span className="dim">—</span>;
  const valid = kind === "tx" ? isHex32(value) : isAddress(value);
  const text = props.label ?? (props.full ? value : shortHash(value));
  if (!valid || !explorer)
    return (
      <span className="mono dim" style={{ fontSize: 12.5 }} title={valid ? value : "Not a valid hash — no explorer link"}>
        {text}
      </span>
    );
  return (
    <span style={props.full ? { wordBreak: "break-all" } : { whiteSpace: "nowrap" }}>
      <a className="proof" href={`${explorer.replace(/\/$/, "")}/${kind}/${value}`} target="_blank" rel="noreferrer" title={value}>
        {text} ↗
      </a>
      <CopyButton value={value} />
    </span>
  );
}

export function ModeTag({ dry }: { dry?: boolean }) {
  if (dry === undefined) return <span className="tag unk">?</span>;
  return dry ? (
    <span className="tag sim" title="Practice mode: order simulated, decision really on-chain">
      PRACTICE
    </span>
  ) : (
    <span className="tag live" title="Real order on OKX TR">
      LIVE
    </span>
  );
}

const ACTION_WORD: Record<string, string> = { BUY: "Buy", SELL: "Sell", HOLD: "Hold" };
export function ActionChip({ action, size }: { action?: string; size?: string }) {
  const known = action === "BUY" || action === "SELL" || action === "HOLD";
  const amount = action !== "HOLD" && size && Number(size) > 0 ? `$${Number(size).toFixed(2)}` : null;
  return (
    <span className={`act ${known ? action : "other"}`} title={action}>
      {known ? ACTION_WORD[action!] : (action ?? "?")}
      {amount && <b>{amount}</b>}
    </span>
  );
}

// v0.5 analyst flag (contracts/decision.md): the AI may only keep, shrink or cancel a BUY; SELLs never go through it.
const LLM: Record<string, { label: string; title: string }> = {
  approved: { label: "approved", title: "A second AI looked at this buy and kept it as is." },
  reduced: { label: "reduced", title: "A second AI made this buy smaller. It can never make it bigger." },
  vetoed: { label: "vetoed", title: "A second AI cancelled this buy (turned it into hold)." },
  exempt: { label: "not needed (sell)", title: "Sells are not reviewed: reducing risk is never blocked." },
  skipped: { label: "not needed", title: "No buy to review in this check-in; the decision is unchanged." },
};

export function LlmBadge({ flag, note }: { flag: string; note?: string }) {
  // "skipped" covers two cases: nothing to review (no buys) vs AI not reachable — say which.
  const unavailable = flag === "skipped" && !!note && /^skipped/.test(note) && !/no_buys/.test(note);
  const known = unavailable ? { label: "unavailable — decision unchanged", title: "AI review unavailable — decision unchanged." } : LLM[flag];
  return (
    <span className={`llm ${LLM[flag] ? flag : "unknown"}`} title={[known?.title ?? `llm_flag: ${flag}`, note].filter(Boolean).join(" — ")}>
      AI second opinion: {known?.label ?? flag}
    </span>
  );
}

/** Official Avalanche mark (cryptocurrency-icons, CC0). */
export function AvalancheMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Avalanche" style={{ flex: "none" }}>
      <circle fill="#E84142" cx="16" cy="16" r="16" />
      <path
        fill="#FFF"
        d="M11.518 22.75H8.49c-.636 0-.95 0-1.142-.123A.77.77 0 017 22.025c-.012-.226.145-.503.46-1.055l7.472-13.193c.318-.56.48-.84.682-.944a.77.77 0 01.698 0c.203.104.364.384.682.944l1.536 2.686.008.014c.343.6.517.906.593 1.226a2.26 2.26 0 010 1.066c-.076.323-.249.63-.597 1.24l-3.926 6.95-.01.017c-.346.606-.52.913-.764 1.145a2.284 2.284 0 01-.93.54c-.319.089-.675.089-1.387.089zm7.643 0h4.336c.64 0 .962 0 1.154-.126a.768.768 0 00.348-.607c.011-.219-.142-.484-.443-1.005l-.032-.054-2.172-3.722-.025-.042c-.305-.517-.46-.778-.657-.879a.762.762 0 00-.693 0c-.2.104-.36.377-.678.925l-2.165 3.722-.007.013c-.317.548-.476.821-.464 1.046a.777.777 0 00.348.606c.188.123.51.123 1.15.123z"
      />
    </svg>
  );
}

export class Boundary extends Component<{ children: ReactNode; name: string }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { err: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.err)
      return (
        <div className="strip-msg danger" role="alert">
          <span>
            The {this.props.name} screen failed to render ({this.state.err}). Other screens still work.
          </span>
          <button className="btn sm" onClick={() => this.setState({ err: null })}>
            Retry
          </button>
        </div>
      );
    return this.props.children;
  }
}
