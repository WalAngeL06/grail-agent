import { useEffect, useMemo, useRef, useState } from "react";
import { groupCycles, type Cycle, type Decision, type GrailState } from "../state";
import { ActionChip, Empty, ExplorerLink, Hash, LlmBadge, ModeTag } from "../components/Bits";
import VerifyPanel from "../components/VerifyPanel";
import { chainHints } from "../verify";
import { clock, coin, countdown, dayClock, price } from "../format";

type Props = { s: GrailState; chainJson: unknown; now: number; demo?: boolean };

export default function Decisions({ s, chainJson, now, demo }: Props) {
  const cycles = useMemo(() => groupCycles(s), [s]);
  const [onlyTrades, setOnlyTrades] = useState(false);
  const fresh = useFreshKeys(s.decisions.map((d) => d.key));
  const trades = s.decisions.filter(isTrade).length;

  return (
    <>
      <div className="head">
        <div>
          <h1>Decisions</h1>
          <p>
            Every cycle the engine decides BUY, SELL or HOLD per coin. The whole cycle — HOLDs included — is committed on Avalanche before any
            order is sent, then revealed.
          </p>
        </div>
        {trades > 0 && (
          <label className="chip" style={{ cursor: "pointer", height: 30 }}>
            <input type="checkbox" checked={onlyTrades} onChange={(e) => setOnlyTrades(e.target.checked)} /> Only trades ({trades})
          </label>
        )}
      </div>

      {cycles.length === 0 ? (
        <Empty title={`Waiting for first cycle${countdown(s.agent.next_cycle_at_ms, now) ? ` — next in ${countdown(s.agent.next_cycle_at_ms, now)}` : ""}`}>
          Decisions appear here as soon as the agent finishes a cycle.
        </Empty>
      ) : (
        <div className="stack">
          {cycles.map((c) => (
            <CycleCard key={c.id} c={c} s={s} chainJson={chainJson} onlyTrades={onlyTrades} fresh={fresh} demo={demo} />
          ))}
        </div>
      )}
    </>
  );
}

const isTrade = (d: Decision) => d.action === "BUY" || d.action === "SELL";

function CycleCard({ c, s, chainJson, onlyTrades, fresh, demo }: { c: Cycle; s: GrailState; chainJson: unknown; onlyTrades: boolean; fresh: Set<string>; demo?: boolean }) {
  const [open, setOpen] = useState<"none" | "detail" | "verify">("none");
  const hints = chainHints(chainJson);
  const rows = (onlyTrades ? c.decisions.filter(isTrade) : [...c.decisions]).sort(
    (a, b) => Number(isTrade(b)) - Number(isTrade(a)) || (a.inst_id ?? "").localeCompare(b.inst_id ?? ""),
  );
  if (rows.length === 0) return null;
  const ex = s.chain.explorer;

  return (
    <article className="card cycle-card" aria-label={`Cycle ${c.cycle_id ?? "?"}`}>
      <div className="cycle-top">
        <h3>
          Cycle #{c.id} <span>· {dayClock(c.decided_at_ms)} · {c.decisions.length} decisions</span> <ModeTag dry={c.dry_run} />
        </h3>
        <Stepper c={c} />
      </div>
      {!c.commit_tx && <div className="failbar">commit failed → no order (fail-closed)</div>}

      {rows.map((d) => {
        const trade = isTrade(d);
        return (
          <div className={`drow ${fresh.has(d.key) ? "flash" : ""}`} key={d.key}>
            <span className="coin">{coin(d.inst_id)}</span>
            <span>
              <ActionChip action={d.action} size={d.size_usdt} />
            </span>
            <span className="reason">
              {d.reason ?? <span className="dim">no reason given</span>}
              {d.llm_flag && (
                <span className="llm-line">
                  <LlmBadge flag={d.llm_flag} note={d.llm_note} />
                  {d.llm_note && <span className="llm-note">{d.llm_note}</span>}
                </span>
              )}
            </span>
            <span className="px">
              ref {price(d.ref_price)}
              {d.fill_price && <> → fill {price(d.fill_price)}</>}
            </span>
            <span className="ord">{trade ? <OrderStatus d={d} /> : null}</span>
          </div>
        );
      })}

      <div className="cycle-foot">
        <span>
          commit <ExplorerLink explorer={ex} kind="tx" value={c.commit_tx} />
        </span>
        <span>
          reveal {c.reveal_tx ? <ExplorerLink explorer={ex} kind="tx" value={c.reveal_tx} /> : <span className="tag open">OPEN</span>}
        </span>
        <span className="grow" />
        <button className="btn sm" aria-expanded={open === "detail"} onClick={() => setOpen(open === "detail" ? "none" : "detail")}>
          {open === "detail" ? "Hide payload" : "Payload & proof"}
        </button>
        <button className="btn sm gold" aria-expanded={open === "verify"} onClick={() => setOpen(open === "verify" ? "none" : "verify")}>
          Verify yourself
        </button>
      </div>

      {open !== "none" && (
        <div className="detail">
          {open === "detail" && <Proof c={c} explorer={ex} />}
          <VerifyPanel key={open} cycle={c} rpc={hints.rpc} contract={hints.address ?? s.chain.address} demo={demo} />
        </div>
      )}
    </article>
  );
}

function Proof({ c, explorer }: { c: Cycle; explorer?: string }) {
  let pretty = c.payload_utf8 ?? "";
  try {
    if (pretty) pretty = JSON.stringify(JSON.parse(pretty), null, 2);
  } catch {
    /* show raw */
  }
  return (
    <>
      <dl className="kvrows">
        <dt>commit_hash</dt>
        <dd>
          <Hash value={c.commit_hash} full />
        </dd>
        <dt>salt_hex</dt>
        <dd>{c.salt_hex ? <Hash value={c.salt_hex} full /> : <span className="muted">secret until reveal</span>}</dd>
        <dt>commit tx</dt>
        <dd>
          <ExplorerLink explorer={explorer} kind="tx" value={c.commit_tx} full />
        </dd>
        <dt>reveal tx</dt>
        <dd>{c.reveal_tx ? <ExplorerLink explorer={explorer} kind="tx" value={c.reveal_tx} full /> : <span className="tag open">OPEN</span>}</dd>
      </dl>
      {pretty ? (
        <pre aria-label="Committed payload">{pretty}</pre>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Payload is published with the reveal.
        </p>
      )}
    </>
  );
}

function Stepper({ c }: { c: Cycle }) {
  const ordered = c.decisions.filter(isTrade);
  const allIds = ordered.length > 0 && ordered.every((d) => d.okx_order_id);
  const steps: { label: string; cls: string; title?: string }[] = [
    { label: "Decided", cls: c.decided_at_ms !== undefined ? "done" : "pending", title: clock(c.decided_at_ms) },
    { label: "Committed", cls: c.commit_tx ? "done" : "fail" },
    c.commit_tx
      ? ordered.length === 0
        ? { label: "no order", cls: "skip", title: "All HOLD — nothing to send" }
        : { label: c.dry_run ? "Ordered (sim)" : "Ordered", cls: allIds ? "done" : "pending" }
      : { label: "no order", cls: "fail", title: "Fail-closed: no commit, no order" },
    { label: "Revealed", cls: c.reveal_tx ? "done" : c.commit_tx ? "pending" : "skip" },
    { label: "Verified", cls: c.verified === true ? "done ok" : c.verified === false ? "fail" : c.commit_tx ? "pending" : "skip" },
  ];
  return (
    <div className="stepper" aria-label="Cycle lifecycle">
      {steps.map((st, i) => (
        <span key={st.label} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && <span className="line" />}
          <span className={`step ${st.cls}`} title={st.title}>
            <i aria-hidden="true" />
            {st.label}
            {st.cls === "pending" && <span className="dim"> pending</span>}
          </span>
        </span>
      ))}
    </div>
  );
}

function OrderStatus({ d }: { d: Decision }) {
  const st = d.order_status;
  const cls = st === "filled" ? "filled" : st === "simulated" ? "simulated" : "other";
  return (
    <span style={{ display: "grid", gap: 2 }}>
      <span className={`ostat ${cls}`}>{st === "simulated" ? "SIMULATED" : (st ?? "no status")}</span>
      {d.okx_order_id && (
        <span className="mono dim" style={{ fontSize: 11 }} title="OKX order id">
          {d.okx_order_id}
        </span>
      )}
    </span>
  );
}

/** Keys that appeared since the previous state (first render: none) → gold flash for 1.5 s. */
function useFreshKeys(keys: string[]) {
  const seen = useRef<Set<string> | null>(null);
  const fresh = new Set(seen.current ? keys.filter((k) => !seen.current!.has(k)) : []);
  useEffect(() => {
    seen.current = new Set(keys);
  });
  return fresh;
}
