import { Fragment, useMemo, useState } from "react";
import { groupCycles, type GrailState } from "../state";
import { Card, Empty, ExplorerLink, Hash, ModeTag } from "../components/Bits";
import VerifyPanel from "../components/VerifyPanel";
import { chainHints } from "../verify";
import { countdown, dayClock } from "../format";

type Props = { s: GrailState; chainJson: unknown; now: number; demo?: boolean };

export default function Ledger({ s, chainJson, now, demo }: Props) {
  const hints = chainHints(chainJson);
  const c = s.chain;
  const cycles = useMemo(() => groupCycles(s), [s]);
  const [open, setOpen] = useState<string | null>(null);

  const commits = c.commits ?? cycles.filter((x) => x.commit_tx).length;
  const reveals = c.reveals ?? cycles.filter((x) => x.reveal_tx).length;
  const unrevealed = c.unrevealed ?? Math.max(0, commits - reveals);
  const agentId = c.agent_id ?? hints.agentId;
  const address = c.address ?? hints.address;

  return (
    <>
      <div className="head">
        <div>
          <h1>On-chain Ledger</h1>
          <p>Each cycle is sealed on Avalanche before the order and revealed after it. The record can't be shown selectively.</p>
        </div>
      </div>

      <div className="stack">
        <div className="cols three">
          <div className="card bigstat">
            <div className="label">Commits</div>
            <div className="v">{commits}</div>
            <p>decisions sealed before any order</p>
          </div>
          <div className="card bigstat">
            <div className="label">Reveals</div>
            <div className="v">{reveals}</div>
            <p>payload + salt published</p>
          </div>
          <div className={`card bigstat ${unrevealed > 0 ? "open" : ""}`}>
            <div className="label">Unrevealed</div>
            <div className="v">{unrevealed}</div>
            <p>{unrevealed > 0 ? "Open commits stay visible — no cherry-picking." : "Every commit has been revealed."}</p>
          </div>
        </div>

        <div className={agentId !== undefined ? "cols two" : "cols"}>
          <Card title="Ledger contract">
            <div className="contract">
              <AvaxLogo />
              <dl className="kvrows" style={{ flex: 1 }}>
                <dt>Network</dt>
                <dd>
                  {c.network === "fuji" ? "Avalanche Fuji" : (c.network ?? "—")}
                  {c.chain_id !== undefined && <span className="muted"> · {c.chain_id}</span>}
                </dd>
                <dt>Address</dt>
                <dd>{address ? <Hash value={address} full /> : <span className="muted">not deployed yet</span>}</dd>
                <dt>Explorer</dt>
                <dd>
                  {address && c.explorer ? (
                    <ExplorerLink explorer={c.explorer} kind="address" value={address} label="View on Snowtrace" />
                  ) : (
                    "—"
                  )}
                </dd>
              </dl>
            </div>
          </Card>
          {agentId !== undefined && (
            <Card title="Agent identity" meta="ERC-8004">
              <dl className="kvrows">
                <dt>Agent</dt>
                <dd>{s.agent.name ?? "—"}</dd>
                <dt>agentId</dt>
                <dd style={{ fontSize: 20, fontWeight: 700 }}>#{agentId}</dd>
                {c.identity_registry && (
                  <>
                    <dt>Registry</dt>
                    <dd>
                      <ExplorerLink explorer={c.explorer} kind="address" value={c.identity_registry} />
                    </dd>
                  </>
                )}
              </dl>
            </Card>
          )}
        </div>

        <Card title="Ledger" meta={`${cycles.length} cycles in state`}>
          {cycles.length === 0 ? (
            <Empty title={`Waiting for first cycle${countdown(s.agent.next_cycle_at_ms, now) ? ` — next in ${countdown(s.agent.next_cycle_at_ms, now)}` : ""}`}>
              Commit and reveal transactions appear here with Snowtrace links.
            </Empty>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th>Time</th>
                    <th>Commit tx</th>
                    <th>Reveal tx</th>
                    <th>Mode</th>
                    <th>Actions</th>
                    <th>Verified</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((x) => (
                    <Fragment key={x.id}>
                      <tr>
                        <td style={{ fontWeight: 600 }}>#{x.id}</td>
                        <td className="muted">{dayClock(x.decided_at_ms)}</td>
                        <td>{x.commit_tx ? <ExplorerLink explorer={c.explorer} kind="tx" value={x.commit_tx} /> : <span className="tag live">FAILED</span>}</td>
                        <td>{x.reveal_tx ? <ExplorerLink explorer={c.explorer} kind="tx" value={x.reveal_tx} /> : <span className="tag open">OPEN</span>}</td>
                        <td>
                          <ModeTag dry={x.dry_run} />
                        </td>
                        <td>{summary(x.decisions.map((d) => d.action))}</td>
                        <td>{x.verified === true ? "✅" : x.verified === false ? "❌" : <span className="dim">—</span>}</td>
                        <td className="r">
                          <button className="btn sm gold" aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? null : x.id)}>
                            Verify
                          </button>
                        </td>
                      </tr>
                      {open === x.id && (
                        <tr>
                          <td colSpan={8} style={{ background: "var(--bg)" }}>
                            <VerifyPanel cycle={x} rpc={hints.rpc} contract={address} demo={demo} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function summary(actions: (string | undefined)[]) {
  const counts = new Map<string, number>();
  for (const a of actions) counts.set(a ?? "?", (counts.get(a ?? "?") ?? 0) + 1);
  const keys = ["BUY", "SELL", "HOLD", ...[...counts.keys()].filter((k) => !["BUY", "SELL", "HOLD"].includes(k))];
  return keys
    .filter((k) => counts.has(k))
    .map((k) => `${counts.get(k)} ${k}`)
    .join(" · ");
}

function AvaxLogo() {
  return (
    <svg className="logo" width="40" height="40" viewBox="0 0 40 40" aria-label="Avalanche">
      <circle cx="20" cy="20" r="20" fill="var(--avax)" />
      <path d="M24.6 25.5h3.4c.8 0 1.2-.9.8-1.6l-1.7-2.9a.9.9 0 0 0-1.6 0l-1.7 2.9c-.4.7 0 1.6.8 1.6Z" fill="#fff" />
      <path d="M21.3 11.6a.9.9 0 0 0-1.6 0l-8.4 14.3c-.4.6 0 1.4.8 1.4h4.1c.6 0 1.1-.3 1.4-.8l5.2-9c.3-.5.3-1.2 0-1.7l-1.5-4.2Z" fill="#fff" />
    </svg>
  );
}
