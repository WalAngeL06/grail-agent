import { Component, type ReactNode } from "react";
import { isAddress, isHex32 } from "../verify";
import { shortHash } from "../format";

export function Section(props: { title: string; meta?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" id={props.id}>
      <header>
        <h2>{props.title}</h2>
        {props.meta && <span className="meta">{props.meta}</span>}
      </header>
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

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${90 - i * 17}%` }} />
      ))}
    </div>
  );
}

/** Snowtrace bağlantısı; değer gerçek bir hash/adres değilse (ör. "0xabc...") bağlantı vermez, olduğu gibi gösterir. */
export function ExplorerLink(props: { explorer?: string; kind: "tx" | "address"; value?: string; full?: boolean }) {
  const { explorer, kind, value } = props;
  if (!value) return <span className="faint">—</span>;
  const valid = kind === "tx" ? isHex32(value) : isAddress(value);
  const label = props.full ? value : shortHash(value, 8, 6);
  if (!valid || !explorer)
    return (
      <span className="mono faint" title={valid ? value : "Geçerli bir hash değil; bağlantı verilmedi"}>
        {label}
      </span>
    );
  return (
    <a className="mono link" href={`${explorer.replace(/\/$/, "")}/${kind}/${value}`} target="_blank" rel="noreferrer" title={value}>
      {label}
    </a>
  );
}

export function DryTag({ dry }: { dry?: boolean }) {
  if (dry === undefined) return <span className="tag" title="dry_run bilgisi yok">dry_run ?</span>;
  return dry ? (
    <span className="tag" title="dry_run: emir OKX'e gönderilmedi, simüle edildi">simülasyon</span>
  ) : (
    <span className="tag live" title="Gerçek emir (OKX TR)">canlı emir</span>
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
        <div className="banner bad" role="alert">
          <div>
            <b>{this.props.name} ekranı çizilemedi.</b> Diğer ekranlar çalışıyor. Hata: <span className="mono">{this.state.err}</span>{" "}
            <button className="btn" onClick={() => this.setState({ err: null })}>
              Tekrar dene
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}
