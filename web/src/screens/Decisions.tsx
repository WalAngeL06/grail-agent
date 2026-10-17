import { useEffect, useMemo, useRef, useState } from "react";
import { groupCycles, type Cycle, type Decision } from "../state";
import type { ScreenProps } from "../App";
import { ActionChip, Empty, ExplorerLink, Hash, LlmBadge, ModeTag, PageHead, Term } from "../components/Bits";
import VerifySheet from "../components/VerifySheet";
import { clock, coin, countdown, dayClock, price } from "../format";

export default function Decisions({ s, chain, now, demo }: ScreenProps) {
  const cycles = useMemo(() => groupCycles(s), [s]);
  const [onlyTrades, setOnlyTrades] = useState(false);
  const [verify, setVerify] = useState<Cycle | null>(null);
  const fresh = useFreshKeys(cycles.map((c) => c.id));
  const trades = s.decisions.filter(isTrade).length;
  const opened = cycles.filter((c) => c.reveal_tx).length;
  const next = countdown(s.agent.next_cycle_at_ms, now);

  return (
    <>
      <PageHead
        title="Every decision GRAIL made, sealed before it traded."
        summary={
          cycles.length
            ? `${cycles.length} round${cycles.length === 1 ? "" : "s"} shown: ${trades} trade${trades === 1 ? "" : "s"}, ${s.decisions.length - trades} holds. ${opened} opened and checkable by anyone — press "Verify" on a round.`
            : undefined
        }
        aside={
          trades > 0 ? (
            <label className="chip toggle">
              <input type="checkbox" checked={onlyTrades} onChange={(e) => setOnlyTrades(e.target.checked)} /> Only trades ({trades})
            </label>
          ) : undefined
        }
      />

      {cycles.length === 0 ? (
        <Empty title={`Waiting for the first round${next ? ` — next in ${next}` : ""}`}>
          Every {String(s.config.cycle_seconds ?? 90)} seconds GRAIL reads prices, decides buy / sell / hold for each coin, and seals that decision on Avalanche
          before any trade. The first round appears here.
        </Empty>
      ) : (
        <div className="stack">
          {cycles.map((c) => (
            <CycleCard key={c.id} c={c} explorer={s.chain.explorer ?? chain.explorer} onlyTrades={onlyTrades} flash={fresh.has(c.id)} onVerify={() => setVerify(c)} />
          ))}
        </div>
      )}

      {verify && (
        <VerifySheet
          cycle={verify}
          chain={chain}
          agentId={s.chain.agent_id ?? chain.agentId}
          agentName={s.agent.name ?? chain.agentName}
          explorer={s.chain.explorer ?? chain.explorer}
          demo={demo}
          onClose={() => setVerify(null)}
        />
      )}
    </>
  );
}

const isTrade = (d: Decision) => d.action === "BUY" || d.action === "SELL";

function CycleCard({ c, explorer, onlyTrades, flash, onVerify }: { c: Cycle; explorer?: string; onlyTrades: boolean; flash: boolean; onVerify: () => void }) {
  const [proof, setProof] = useState(false);
  const all = [...c.decisions].sort((a, b) => Number(isTrade(b)) - Number(isTrade(a)) || (a.inst_id ?? "").localeCompare(b.inst_id ?? ""));
  const rows = onlyTrades ? all.filter(isTrade) : all;
  const hidden = all.length - rows.length;

  return (
    <article className={`card cycle-card ${flash ? "flash" : ""}`} aria-label={`Round ${c.id}`}>
      <div className="cycle-top">
        <h3>
          Round #{c.id} <span className="mono muted">{dayClock(c.decided_at_ms)}</span> <span className="muted">· {c.decisions.length} decisions</span>{" "}
          <ModeTag dry={c.dry_run} />
        </h3>
        <Stepper c={c} />
      </div>
      {!c.commit_tx && (
        <div className="failbar">
          ✕ Seal failed → no trade was placed (fail-closed). <span className="tech">commit_tx missing</span>
        </div>
      )}

      {rows.map((d) => (
        <div className="drow" key={d.key}>
          <span className="coin">{coin(d.inst_id)}</span>
          <span>
            <ActionChip action={d.action} size={d.size_usdt} />
          </span>
          <span className="reason">
            {d.reason ?? <span className="dim">no reason given</span>}
            {d.llm_flag && (
              <span className="llm-line">
                <LlmBadge flag={d.llm_flag} note={d.llm_note} />
                {d.llm_note && !/^skipped|^exempt/.test(d.llm_note) && <span className="llm-note">{d.llm_note}</span>}
              </span>
            )}
          </span>
          <span className="px">
            at {price(d.ref_price)}
            {d.fill_price && <> → filled {price(d.fill_price)}</>}
          </span>
          <span className="ord">{isTrade(d) ? <OrderStatus d={d} failed={!c.commit_tx} /> : null}</span>
        </div>
      ))}
      {onlyTrades && hidden > 0 && <div className="drow-note">{rows.length ? `+ ${hidden} hold hidden` : `${hidden} hold — no trades this round`}</div>}

      <div className="cycle-foot">
        <span>
          <Term plain="sealed" tech="commit tx" /> {c.commit_tx ? <ExplorerLink explorer={explorer} kind="tx" value={c.commit_tx} /> : <span style={{ color: "var(--danger)" }}>failed</span>}
        </span>
        <span>
          <Term plain="opened" tech="reveal tx" />{" "}
          {c.reveal_tx ? <ExplorerLink explorer={explorer} kind="tx" value={c.reveal_tx} /> : c.commit_tx ? <span className="tag open">STILL SEALED</span> : "—"}
        </span>
        <span className="grow" />
        <button className="btn sm" aria-expanded={proof} onClick={() => setProof(!proof)}>
          {proof ? "Hide the math" : "Show the math"}
        </button>
        {c.commit_tx && (
          <button className="btn sm proofbtn" onClick={onVerify}>
            Verify yourself
          </button>
        )}
      </div>

      {proof && <Proof c={c} explorer={explorer} />}
    </article>
  );
}

function Proof({ c, explorer }: { c: Cycle; explorer?: string }) {
  let pretty = c.payload_utf8 ?? "";
  try {
    if (pretty) pretty = JSON.stringify(JSON.parse(pretty), null, 2);
  } catch {
    /* raw */
  }
  return (
    <div className="detail">
      <div style={{ flex: "3 1 340px", minWidth: 0 }}>
        <div className="label">The sealed decision (payload_utf8 · {c.payload_utf8 ? new TextEncoder().encode(c.payload_utf8).length : 0} bytes)</div>
        {pretty ? <pre>{pretty}</pre> : <p className="muted">Published when the round is opened (revealed).</p>}
      </div>
      <dl className="kvrows" style={{ flex: "2 1 280px" }}>
        <dt>
          <Term plain="fingerprint" tech="commit_hash" />
        </dt>
        <dd>
          <Hash value={c.commit_hash} full />
        </dd>
        <dt>
          <Term plain="secret key" tech="salt_hex" />
        </dt>
        <dd>{c.salt_hex ? <Hash value={c.salt_hex} full /> : <span className="muted">kept secret until opened</span>}</dd>
        <dt>sealed tx</dt>
        <dd>
          <ExplorerLink explorer={explorer} kind="tx" value={c.commit_tx} full />
        </dd>
        <dt>opened tx</dt>
        <dd>{c.reveal_tx ? <ExplorerLink explorer={explorer} kind="tx" value={c.reveal_tx} full /> : <span className="tag open">STILL SEALED</span>}</dd>
      </dl>
    </div>
  );
}

function Stepper({ c }: { c: Cycle }) {
  const ordered = c.decisions.filter(isTrade);
  const allIds = ordered.length > 0 && ordered.every((d) => d.okx_order_id);
  const t = (ms?: number) => (ms ? clock(ms) : "");
  type St = { label: string; cls: string; sub: string };
  const steps: St[] = [
    { label: "Decided", cls: c.decided_at_ms !== undefined ? "done" : "pending", sub: t(c.decided_at_ms) || "pending" },
    { label: "Sealed", cls: c.commit_tx ? "done proof" : "fail", sub: c.commit_tx ? "on Avalanche" : "failed" },
    c.commit_tx
      ? ordered.length === 0
        ? { label: "Order", cls: "skip", sub: "no order" }
        : { label: "Order", cls: allIds ? "done" : "pending", sub: allIds ? (c.dry_run ? "simulated" : "sent") : "pending" }
      : { label: "Order", cls: "fail", sub: "not sent" },
    { label: "Opened", cls: c.reveal_tx ? "done proof" : c.commit_tx ? "pending" : "skip", sub: c.reveal_tx ? "public" : c.commit_tx ? "pending" : "—" },
    { label: "Checked", cls: c.verified === true ? "done ok" : c.verified === false ? "fail" : c.commit_tx ? "pending" : "skip", sub: c.verified === true ? "matches" : c.verified === false ? "mismatch" : c.commit_tx ? "pending" : "—" },
  ];
  return (
    <ol className="stepper" aria-label="Round lifecycle">
      {steps.map((st) => (
        <li key={st.label} className={`step ${st.cls}`}>
          <i aria-hidden="true" />
          <span className="step-l">{st.label}</span>
          <span className={`step-s ${st.sub === "simulated" ? "sim" : ""}`}>{st.sub}</span>
        </li>
      ))}
    </ol>
  );
}

function OrderStatus({ d, failed }: { d: Decision; failed: boolean }) {
  if (failed) return <span className="ostat fail">NOT SENT</span>;
  const st = d.order_status;
  const cls = st === "filled" ? "filled" : st === "simulated" ? "simulated" : st === "pending" ? "simulated" : "other";
  const label = st === "simulated" ? "SIMULATED" : st === "filled" ? "FILLED" : st === "pending" ? "pending" : (st ?? "no status");
  return (
    <span style={{ display: "grid", gap: 2, justifyItems: "end" }}>
      <span className={`ostat ${cls}`}>{label}</span>
      {d.okx_order_id && (
        <span className="mono dim" style={{ fontSize: 11 }} title="OKX order id">
          {d.okx_order_id}
        </span>
      )}
    </span>
  );
}

/** Round ids that appeared since the previous state (first render: none) → gold flash. */
function useFreshKeys(keys: string[]) {
  const seen = useRef<Set<string> | null>(null);
  const fresh = new Set(seen.current ? keys.filter((k) => !seen.current!.has(k)) : []);
  useEffect(() => {
    seen.current = new Set(keys);
  });
  return fresh;
}
