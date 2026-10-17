import { Component, useState, type ReactNode } from "react";
import { isAddress, isHex32 } from "../verify";
import { shortHash } from "../format";

export function Card(props: { title?: ReactNode; meta?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${props.className ?? ""}`} id={props.id}>
      {props.title && (
        <h2 className="card-title">
          <span>{props.title}</span>
          {props.meta && <span className="label">{props.meta}</span>}
        </h2>
      )}
      {props.children}
    </section>
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

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="copy"
      title={done ? "Copied" : "Copy"}
      aria-label={done ? "Copied" : `Copy ${value}`}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1200);
          },
          () => undefined,
        );
      }}
    >
      {done ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--buy)" strokeWidth="2.4" aria-hidden="true">
          <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
        </svg>
      )}
    </button>
  );
}

/** Hash in mono, shortened, with a copy button. */
export function Hash({ value, full }: { value?: string; full?: boolean }) {
  if (!value) return <span className="dim">—</span>;
  return (
    <span style={{ whiteSpace: full ? "normal" : "nowrap" }}>
      <span className="mono" title={value} style={{ fontSize: 12.5 }}>
        {full ? value : shortHash(value)}
      </span>
      <CopyButton value={value} />
    </span>
  );
}

/** Snowtrace link; when the value isn't a real hash/address (e.g. mock "0xabc...") it is shown as plain text, never linked. */
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
    <span style={{ whiteSpace: "nowrap" }}>
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
    <span className="tag sim" title="dry_run: order simulated, not sent to OKX">
      SIM
    </span>
  ) : (
    <span className="tag live" title="Real order on OKX TR">
      LIVE
    </span>
  );
}

export function ActionChip({ action, size }: { action?: string; size?: string }) {
  const known = action === "BUY" || action === "SELL" || action === "HOLD";
  const amount = action !== "HOLD" && size && Number(size) > 0 ? `$${Number(size).toFixed(2)}` : null;
  return (
    <span className={`act ${known ? action : "other"}`}>
      {action ?? "?"}
      {amount && <b>{amount}</b>}
    </span>
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
