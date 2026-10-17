import { useMemo, useState } from "react";
import { decisionDryRun, type Decision, type GrailState } from "../state";
import { DryTag, Empty, ExplorerLink } from "../components/Bits";
import VerifyPanel from "../components/VerifyPanel";
import { chainHints, computeCommit } from "../verify";
import { coin, dateTime, pct, price, shortHash, usdt } from "../format";

type Verdict = "ok" | "bad" | "na";

export default function Decisions({ s, chainJson }: { s: GrailState; chainJson: unknown }) {
  const [onlyTrades, setOnlyTrades] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const hints = chainHints(chainJson);
  const contract = hints.address ?? s.chain.address;

  const cycles = useMemo(() => {
    const map = new Map<string, Decision[]>();
    for (const d of s.decisions) {
      const k = d.cycle_id !== undefined ? String(d.cycle_id) : "?";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [s.decisions]);

  const verify = (d: Decision) => {
    if (d.payload_utf8 && d.salt_hex) {
      const r = computeCommit(d.payload_utf8, d.salt_hex, d.commit_hash);
      setVerdicts((v) => ({ ...v, [d.key]: r.ok && r.matches ? "ok" : "bad" }));
    } else setVerdicts((v) => ({ ...v, [d.key]: "na" }));
    setOpen((o) => (o === d.key ? null : d.key));
  };

  const trades = s.decisions.filter((d) => d.action === "BUY" || d.action === "SELL").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Karar akışı</h1>
          <p>
            Her döngüde engine coin başına AL / SAT / BEKLE kararı verir. Kararların tamamı, HOLD dahil, emirden önce zincire commit edilir.
            Herhangi bir satırda "Kendin doğrula" hash'i tarayıcınızda yeniden hesaplar.
          </p>
        </div>
        <label className="pill" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={onlyTrades} onChange={(e) => setOnlyTrades(e.target.checked)} /> Sadece işlemler ({trades})
        </label>
      </div>

      {cycles.length === 0 && (
        <Empty title="Henüz karar yok">
          Agent ilk döngüsünü tamamladığında kararlar burada belirir. Döngü süresi {String(s.config.cycle_seconds ?? "?")} sn.
        </Empty>
      )}

      {cycles.map(([cid, ds]) => {
        const head = ds[0];
        const dry = decisionDryRun(head, s);
        const revealed = ds.some((d) => d.reveal_tx) || ds.some((d) => d.verified);
        const rows = onlyTrades ? ds.filter((d) => d.action === "BUY" || d.action === "SELL") : ds;
        if (rows.length === 0) return null;
        return (
          <article className="cycle" key={cid}>
            <div className="cycle-head">
              <h3>Döngü #{cid}</h3>
              <span className="faint num">{dateTime(head.decided_at_ms)}</span>
              <DryTag dry={dry} />
              <span className="sp" />
              <span className="faint" style={{ fontSize: 12.5 }}>
                commit <ExplorerLink explorer={s.chain.explorer} kind="tx" value={head.commit_tx} />
              </span>
              <span className="faint" style={{ fontSize: 12.5 }}>
                {revealed ? (
                  <>
                    reveal <ExplorerLink explorer={s.chain.explorer} kind="tx" value={ds.find((d) => d.reveal_tx)?.reveal_tx} />
                  </>
                ) : (
                  <span className="verdict wait" style={{ fontSize: 12.5 }}>
                    reveal bekliyor
                  </span>
                )}
              </span>
            </div>

            {rows.map((d) => (
              <div className="drow" key={d.key}>
                <div>
                  <div className="coin">{coin(d.inst_id)}</div>
                  <div className="faint" style={{ fontSize: 12.5 }}>
                    @ {price(d.ref_price)}
                  </div>
                </div>
                <div>
                  <span className={`act ${d.action ?? ""}`}>{actionLabel(d.action)}</span>
                </div>
                <div className="num">
                  {d.action === "HOLD" ? <span className="faint">işlem yok</span> : usdt(d.size_usdt)}
                  {d.target_weight_pct !== undefined && (
                    <div className="faint" style={{ fontSize: 12.5 }}>
                      hedef {pct(d.target_weight_pct)}
                    </div>
                  )}
                </div>
                <div className="reasoncol">
                  <div className="reason">{d.reason ?? <span className="faint">gerekçe yazılmamış</span>}</div>
                  <div className="meta">
                    {d.order_status && d.order_status !== "none" && <span>emir: {statusLabel(d.order_status)}</span>}
                    {d.okx_order_id && (
                      <span>
                        OKX id <span className="mono">{d.okx_order_id}</span>
                      </span>
                    )}
                    {d.fill_price && <span>dolum {price(d.fill_price)}</span>}
                    {d.commit_hash && (
                      <span title={d.commit_hash}>
                        hash <span className="mono">{shortHash(d.commit_hash, 8, 6)}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                  <button className={`btn ${open === d.key ? "primary" : ""}`} onClick={() => verify(d)} aria-expanded={open === d.key}>
                    Kendin doğrula
                  </button>
                  <VerdictBadge v={verdicts[d.key]} />
                </div>
                {open === d.key && (
                  <VerifyPanel d={d} explorer={s.chain.explorer} rpc={hints.rpc} contract={contract} onClose={() => setOpen(null)} />
                )}
              </div>
            ))}
          </article>
        );
      })}
    </>
  );
}

function VerdictBadge({ v }: { v?: Verdict }) {
  if (!v) return null;
  if (v === "ok") return <span className="verdict ok">✅ hash tutuyor</span>;
  if (v === "bad") return <span className="verdict bad">❌ hash tutmuyor</span>;
  return <span className="verdict wait">reveal bekleniyor</span>;
}

const actionLabel = (a?: string) => (a === "BUY" ? "AL" : a === "SELL" ? "SAT" : a === "HOLD" ? "BEKLE" : (a ?? "?"));
const statusLabel = (st: string) =>
  ({ filled: "doldu", simulated: "simüle edildi", pending: "bekliyor", canceled: "iptal", rejected: "reddedildi", partially_filled: "kısmen doldu", blocked: "limit engeli" })[
    st
  ] ?? st;
