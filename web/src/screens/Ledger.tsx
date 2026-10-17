import { useEffect, useMemo, useState } from "react";
import { groupCycles, type Cycle, type Decision } from "../state";
import type { ScreenProps } from "../App";
import { AvalancheMark, Card, Empty, ExplorerLink, Hash, ModeTag, PageHead, Term } from "../components/Bits";
import VerifySheet from "../components/VerifySheet";
import { readCounts, readLedgerHistory, type ChainCycle } from "../chain";
import { ago, countdown, dayClock } from "../format";

export default function Ledger({ s, chain, now, demo }: ScreenProps) {
  const c = s.chain;
  const stateCycles = useMemo(() => groupCycles(s), [s]);
  const [verify, setVerify] = useState<Cycle | null>(null);

  // Real addresses come from contracts/chain.json (deploy output); state.json values are the fallback.
  const ledger = chain.ledger ?? c.address;
  const explorer = c.explorer ?? chain.explorer;
  const agentId = c.agent_id ?? chain.agentId;
  const registry = c.identity_registry ?? chain.identityRegistry;
  const onchain = useOnChainCounts(chain, agentId);
  // Every check-in this agent ever sealed, from GrailLedger event logs. In demo mode the made-up check-ins would collide, so skip.
  const { history, historyErr, reloadHistory } = useLedgerHistory(chain, demo ? undefined : agentId);
  const cycles = useMemo(() => {
    if (!history) return stateCycles;
    const known = new Set(stateCycles.map((c) => c.cycle_id));
    const extra = history.filter((h) => !known.has(h.cycleId)).map(cycleFromChain);
    return [...stateCycles, ...extra].sort((a, b) => (b.cycle_id ?? -1) - (a.cycle_id ?? -1));
  }, [stateCycles, history]);
  const chainOnly = cycles.filter((c) => c.fromChain).length;
  // R-010-4: the event list must account for every seal the contract counts
  const historyCommits = history ? history.filter((h) => h.commitTx).length : 0;
  const missing = history && onchain && historyCommits < onchain.commits ? onchain.commits - historyCommits : 0;

  const commits = c.commits ?? cycles.filter((x) => x.commit_tx).length;
  const reveals = c.reveals ?? cycles.filter((x) => x.reveal_tx).length;
  const unrevealed = c.unrevealed ?? Math.max(0, commits - reveals);
  const lastSeal = cycles.find((x) => x.commit_tx);
  const next = countdown(s.agent.next_cycle_at_ms, now);

  return (
    <>
      <PageHead
        eyebrow="On-chain record"
        title="Every decision is sealed on Avalanche before the trade and opened after it. Nothing can be hidden or edited."
        summary={
          commits
            ? `${commits} envelopes sealed, ${reveals} opened${unrevealed ? `, ${unrevealed} still sealed — visible to everyone.` : ". Every envelope is open."} Last seal ${ago(lastSeal?.decided_at_ms, now)}.`
            : "No envelopes yet — the first one is sealed at the next check-in."
        }
      />

      <div className="stack">
        <div className="cols three">
          <div className="card bigstat">
            <Term plain="Sealed" tech="commits" />
            <div className="v">{commits}</div>
            <p>sealed before any order</p>
          </div>
          <div className="card bigstat">
            <Term plain="Opened" tech="reveals" />
            <div className="v">{reveals}</div>
            <p>opened and checkable</p>
          </div>
          <div className={`card bigstat ${unrevealed > 0 ? "open" : ""}`}>
            <Term plain="Still sealed" tech="unrevealed commits" tip="A check-in is opened right after its order. A seal that is never opened stays visible here, so bad decisions can't be quietly dropped." />
            <div className="v">{unrevealed}</div>
            <p>{unrevealed > 0 ? "Still sealed — they stay visible, so no decision can be hidden." : "Every envelope has been opened."}</p>
          </div>
        </div>
        {onchain && (
          <p className="muted" style={{ margin: "-4px 0 0", fontSize: 13 }}>
            Read live from the contract on Fuji: <b>{onchain.commits}</b> sealed, <b>{onchain.reveals}</b> opened for agent #{agentId}.
          </p>
        )}

        <div className="cols two">
          <Card title="Where the record lives">
            <div className="contract">
              <AvalancheMark />
              <dl className="kvrows" style={{ flex: 1 }}>
                <dt>Network</dt>
                <dd>
                  Avalanche Fuji <span className="muted">· chain {c.chain_id ?? chain.chainId ?? 43113} (test network)</span>
                </dd>
                <dt>
                  <Term plain="Record contract" tech="GrailLedger" />
                </dt>
                <dd>{ledger ? <ExplorerLink explorer={explorer} kind="address" value={ledger} full /> : <span className="muted">not deployed yet</span>}</dd>
                {chain.ledgerDeployTx && (
                  <>
                    <dt>Deployed in</dt>
                    <dd>
                      <ExplorerLink explorer={explorer} kind="tx" value={chain.ledgerDeployTx} />
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </Card>
          <Card title={<Term plain="On-chain ID card" tech="ERC-8004 IdentityRegistry" tip="A public on-chain ID for the agent, so its record can't be swapped for another one." />}>
            <dl className="kvrows">
              <dt>Agent</dt>
              <dd>{s.agent.name ?? chain.agentName ?? "—"}</dd>
              <dt>Agent ID</dt>
              <dd>{agentId ? <span style={{ fontSize: 20, fontWeight: 700 }}>#{agentId}</span> : <span className="tag open">NOT REGISTERED</span>}</dd>
              <dt>Registry</dt>
              <dd>{registry ? <ExplorerLink explorer={explorer} kind="address" value={registry} /> : <span className="muted">not registered</span>}</dd>
              {chain.registrationTx && agentId === chain.agentId && (
                <>
                  <dt>Registered in</dt>
                  <dd>
                    <ExplorerLink explorer={explorer} kind="tx" value={chain.registrationTx} />
                  </dd>
                </>
              )}
              {chain.agentWallet && (
                <>
                  <dt>Agent wallet</dt>
                  <dd>
                    <Hash value={chain.agentWallet} />
                  </dd>
                </>
              )}
            </dl>
          </Card>
        </div>

        {(historyErr || missing > 0) && (
          <div className="strip-msg warn" role="alert">
            {historyErr
              ? `Couldn't load the full on-chain history (${historyErr}). Showing the agent's file only.`
              : `Some check-ins may be missing: the contract counts ${onchain!.commits} seals, the event list returned ${historyCommits}.`}
            <button className="btn sm" onClick={reloadHistory}>
              Retry
            </button>
          </div>
        )}
        <Card
          title="Every check-in, newest first"
          meta={`${cycles.length} in view${chainOnly ? ` · ${chainOnly} read straight from Avalanche (not in this agent's state file)` : ""}${history ? "" : historyErr ? " · on-chain history unavailable" : " · on-chain history loading…"}`}
        >
          {cycles.length === 0 ? (
            <Empty title={`Waiting for the first check-in${next ? ` — next in ${next}` : ""}`}>
              Each check-in shows up here the moment it is sealed, with links to the Avalanche explorer (Snowtrace).
            </Empty>
          ) : (
            <div className="scroll-x">
              <table className="table ledger-table">
                <thead>
                  <tr>
                    <th>Check-in</th>
                    <th>Time</th>
                    <th>Sealed</th>
                    <th>Opened</th>
                    <th>Mode</th>
                    <th>Decisions</th>
                    <th>Checked</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((x) => (
                    <tr key={x.id}>
                      <td data-label="Check-in" style={{ fontWeight: 600 }}>
                        #{x.id}
                        {x.fromChain && (
                          <div className="tech" title="Not in this agent's state file; read from GrailLedger events on Avalanche.">
                            from chain
                          </div>
                        )}
                      </td>
                      <td data-label="Time" className="mono muted">{dayClock(x.decided_at_ms)}</td>
                      <td data-label="Sealed">{x.commit_tx ? <ExplorerLink explorer={explorer} kind="tx" value={x.commit_tx} /> : <span style={{ color: "var(--danger)" }}>failed · no trade</span>}</td>
                      <td data-label="Opened">{x.reveal_tx ? <ExplorerLink explorer={explorer} kind="tx" value={x.reveal_tx} /> : x.commit_tx ? <span className="tag open" title="Sealed but not opened yet. It stays visible on chain.">OPEN</span> : "—"}</td>
                      <td data-label="Mode">
                        <ModeTag dry={x.dry_run} />
                      </td>
                      <td data-label="Decisions">{summary(x.decisions.map((d) => d.action)) || <span className="dim">not opened yet</span>}</td>
                      <td data-label="Checked">{x.verified === true ? <span className="mark ok">✓</span> : x.verified === false ? <span className="mark bad">✕</span> : <span className="dim">—</span>}</td>
                      <td className="r verify-cell">
                        {x.commit_tx && (
                          <button className="btn sm proofbtn" onClick={() => setVerify(x)}>
                            Verify yourself
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {verify && (
        <VerifySheet
          cycle={verify}
          chain={chain}
          agentId={chain.agentId ?? agentId}
          agentName={chain.agentName ?? s.agent.name}
          explorer={explorer}
          demo={demo}
          onClose={() => setVerify(null)}
        />
      )}
    </>
  );
}

function useLedgerHistory(chain: ScreenProps["chain"], agentId: string | undefined) {
  const [v, setV] = useState<ChainCycle[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!agentId || !chain.ledger) return;
    let alive = true;
    const load = () =>
      readLedgerHistory(chain, agentId).then(
        (r) => {
          if (!alive) return;
          setV(r);
          setErr(null);
        },
        (e) => alive && setErr(e instanceof Error ? e.message : String(e)), // R-010-4: visible, not swallowed
      );
    load();
    const t = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [chain, agentId, tick]);
  return { history: v, historyErr: err, reloadHistory: () => setTick((t) => t + 1) };
}

/** A check-in known only from chain events: decisions come from the revealed payload (if opened). */
function cycleFromChain(h: ChainCycle): Cycle {
  let p: { decided_at_ms?: unknown; dry_run?: unknown; decisions?: unknown } | null = null;
  try {
    p = h.payloadUtf8 ? JSON.parse(h.payloadUtf8) : null;
  } catch {
    p = null;
  }
  const raw = Array.isArray(p?.decisions) ? (p!.decisions as Record<string, unknown>[]) : [];
  const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);
  const decisions: Decision[] = raw.map((d, i) => ({
    key: `chain-${h.cycleId}-${i}`,
    cycle_id: h.cycleId,
    inst_id: str(d.inst_id),
    action: str(d.action),
    size_usdt: str(d.size_usdt),
    ref_price: str(d.ref_price),
    reason: str(d.reason),
    llm_flag: str(d.llm_flag),
    llm_note: str(d.llm_note),
    commit_tx: h.commitTx,
    commit_hash: h.commitHash,
    reveal_tx: h.revealTx,
    payload_utf8: h.payloadUtf8,
  }));
  return {
    id: String(h.cycleId),
    cycle_id: h.cycleId,
    decisions,
    decided_at_ms: typeof p?.decided_at_ms === "number" ? p.decided_at_ms : h.committedAt,
    commit_tx: h.commitTx,
    reveal_tx: h.revealTx,
    commit_hash: h.commitHash,
    payload_utf8: h.payloadUtf8,
    dry_run: typeof p?.dry_run === "boolean" ? p.dry_run : undefined,
    trades: decisions.filter((d) => d.action === "BUY" || d.action === "SELL").length,
    synthetic: false,
    fromChain: true,
  };
}

function useOnChainCounts(chain: ScreenProps["chain"], agentId: string | undefined) {
  const [v, setV] = useState<{ commits: number; reveals: number } | null>(null);
  useEffect(() => {
    if (!agentId || !chain.ledger) return;
    let alive = true;
    readCounts(chain, agentId).then(
      (r) => alive && setV(r),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [chain, agentId]);
  return v;
}

function summary(actions: (string | undefined)[]) {
  const counts = new Map<string, number>();
  for (const a of actions) counts.set(a ?? "?", (counts.get(a ?? "?") ?? 0) + 1);
  const word: Record<string, string> = { BUY: "buy", SELL: "sell", HOLD: "hold" };
  const keys = ["BUY", "SELL", "HOLD", ...[...counts.keys()].filter((k) => !["BUY", "SELL", "HOLD"].includes(k))];
  return keys
    .filter((k) => counts.has(k))
    .map((k) => `${counts.get(k)} ${word[k] ?? k}`)
    .join(" · ");
}
