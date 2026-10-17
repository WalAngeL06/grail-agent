import { useEffect, useMemo, useState } from "react";
import { groupCycles, type Cycle } from "../state";
import type { ScreenProps } from "../App";
import { AvalancheMark, Card, Empty, ExplorerLink, Hash, ModeTag, PageHead, Term } from "../components/Bits";
import VerifySheet from "../components/VerifySheet";
import { readCounts } from "../chain";
import { ago, countdown, dayClock } from "../format";

export default function Ledger({ s, chain, now, demo }: ScreenProps) {
  const c = s.chain;
  const cycles = useMemo(() => groupCycles(s), [s]);
  const [verify, setVerify] = useState<Cycle | null>(null);

  // Real addresses come from contracts/chain.json (deploy output); state.json values are the fallback.
  const ledger = chain.ledger ?? c.address;
  const explorer = c.explorer ?? chain.explorer;
  const agentId = c.agent_id ?? chain.agentId;
  const registry = c.identity_registry ?? chain.identityRegistry;
  const onchain = useOnChainCounts(chain, agentId);

  const commits = c.commits ?? cycles.filter((x) => x.commit_tx).length;
  const reveals = c.reveals ?? cycles.filter((x) => x.reveal_tx).length;
  const unrevealed = c.unrevealed ?? Math.max(0, commits - reveals);
  const lastSeal = cycles.find((x) => x.commit_tx);
  const next = countdown(s.agent.next_cycle_at_ms, now);

  return (
    <>
      <PageHead
        title="The public record: every decision, sealed on Avalanche. None can be hidden."
        summary={
          commits
            ? `${commits} decision rounds sealed, ${reveals} opened${unrevealed ? `, ${unrevealed} still sealed` : ""}. Last seal ${ago(lastSeal?.decided_at_ms, now)}.`
            : "Nothing sealed yet."
        }
      />

      <div className="stack">
        <div className="cols three">
          <div className="card bigstat">
            <Term plain="Sealed before trading" tech="commits" />
            <div className="v">{commits}</div>
            <p>Decision locked on Avalanche before any order.</p>
          </div>
          <div className="card bigstat">
            <Term plain="Opened for anyone to check" tech="reveals" />
            <div className="v">{reveals}</div>
            <p>Decision text and secret key published.</p>
          </div>
          <div className={`card bigstat ${unrevealed > 0 ? "open" : ""}`}>
            <Term plain="Still sealed" tech="unrevealed commits" tip="A round is opened right after its order. A seal that is never opened stays visible here, so bad decisions can't be quietly dropped." />
            <div className="v">{unrevealed}</div>
            <p>{unrevealed > 0 ? "Open seals stay visible — no cherry-picking." : "Every seal has been opened."}</p>
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
          <Card title={<Term plain="Agent identity card" tech="ERC-8004 IdentityRegistry" tip="A public on-chain ID for the agent, so its record can't be swapped for another one." />}>
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

        <Card title="Every round, newest first" meta={`${cycles.length} in view`}>
          {cycles.length === 0 ? (
            <Empty title={`Waiting for the first round${next ? ` — next in ${next}` : ""}`}>
              Each round shows up here the moment it is sealed, with links to the Avalanche explorer (Snowtrace).
            </Empty>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Round</th>
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
                      <td style={{ fontWeight: 600 }}>#{x.id}</td>
                      <td className="mono muted">{dayClock(x.decided_at_ms)}</td>
                      <td>{x.commit_tx ? <ExplorerLink explorer={explorer} kind="tx" value={x.commit_tx} /> : <span style={{ color: "var(--danger)" }}>failed · no trade</span>}</td>
                      <td>{x.reveal_tx ? <ExplorerLink explorer={explorer} kind="tx" value={x.reveal_tx} /> : x.commit_tx ? <span className="tag open">STILL SEALED</span> : "—"}</td>
                      <td>
                        <ModeTag dry={x.dry_run} />
                      </td>
                      <td>{summary(x.decisions.map((d) => d.action))}</td>
                      <td>{x.verified === true ? <span className="mark ok">✓</span> : x.verified === false ? <span className="mark bad">✕</span> : <span className="dim">—</span>}</td>
                      <td className="r">
                        {x.commit_tx && (
                          <button className="btn sm proofbtn" onClick={() => setVerify(x)}>
                            Verify
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
          agentId={agentId}
          agentName={s.agent.name ?? chain.agentName}
          explorer={explorer}
          demo={demo}
          onClose={() => setVerify(null)}
        />
      )}
    </>
  );
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
