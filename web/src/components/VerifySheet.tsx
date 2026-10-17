import { useEffect, useMemo, useRef, useState } from "react";
import type { Cycle } from "../state";
import { computeCommit, isHex32, payloadMatchesRows } from "../verify";
import { parseOrderIds, readDecision, readReveal, type ChainInfo, type OnChainDecision, type RevealCall } from "../chain";
import { ExplorerLink } from "./Bits";
import { clock, coin, shortHash } from "../format";

type Props = { cycle: Cycle; chain: ChainInfo; agentId?: string; agentName?: string; explorer?: string; demo?: boolean; onClose: () => void };
type Phase = "computing" | "reading" | "done";

/**
 * "Open the envelope yourself": fingerprint (keccak256 of payload ‖ salt) computed in the browser,
 * compared with what state.json says and with GrailLedger.decisions(agentId, cycleId) read from Fuji.
 * Payload + salt are taken from the reveal tx calldata when it exists (R-003-1), so state.json does not have to be trusted.
 */
export default function VerifySheet({ cycle, chain, agentId, agentName, explorer, demo, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("computing");
  const [reveal, setReveal] = useState<RevealCall | null>(null);
  const [onchain, setOnchain] = useState<OnChainDecision | null>(null);
  const [chainErr, setChainErr] = useState<string | null>(null);
  const [tamper, setTamper] = useState<{ payload: string; diff: string } | null>(null);

  const skipChain = demo && cycle.synthetic;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const cycleNo = cycle.cycle_id;

  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    (async () => {
      await new Promise((r) => setTimeout(r, 400)); // the hash is instant; 400 ms makes the moment visible
      if (!alive) return;
      setPhase("reading");
      if (skipChain || cycleNo === undefined || !agentId) {
        if (!skipChain) setChainErr(agentId ? "no cycle number" : "agent is not registered on-chain yet");
      } else {
        try {
          const [dec, rv] = await Promise.all([
            readDecision(chain, agentId, cycleNo),
            isHex32(cycle.reveal_tx) ? readReveal(chain, cycle.reveal_tx!) : Promise.resolve(null),
          ]);
          if (!alive) return;
          setOnchain(dec);
          setReveal(rv);
        } catch (e) {
          if (alive) setChainErr(e instanceof Error ? e.message : String(e));
        }
      }
      await new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - t0))));
      if (alive) setPhase("done");
    })();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [chain, agentId, cycleNo, cycle.reveal_tx, skipChain]);

  // Inputs: the reveal tx on Fuji wins over state.json (trustless); state.json is the fallback.
  const fromChain = !!reveal;
  const basePayload = reveal?.payloadUtf8 ?? cycle.payload_utf8;
  const salt = reveal?.saltHex ?? cycle.salt_hex;
  const payload = tamper?.payload ?? basePayload;
  const usable = !!payload && !!salt && /^0x[0-9a-fA-F]{64}$/.test(salt);

  const local = useMemo(() => (usable ? computeCommit(payload!, salt!, cycle.commit_hash) : null), [usable, payload, salt, cycle.commit_hash]);
  const computed = local?.ok ? local.computed : undefined;
  const onchainHash = onchain?.committed ? onchain.commitHash : undefined;
  const matchStated = !!computed && !!cycle.commit_hash && computed.toLowerCase() === cycle.commit_hash.toLowerCase();
  const matchChain = !!computed && !!onchainHash && computed.toLowerCase() === onchainHash.toLowerCase();

  const parsed = useMemo(() => {
    try {
      return payload ? (JSON.parse(payload) as { cycle_id?: unknown; agent?: unknown; decided_at_ms?: unknown; decisions?: unknown[] }) : null;
    } catch {
      return null;
    }
  }, [payload]);
  const cycleOk = parsed ? parsed.cycle_id === cycleNo : undefined;
  const agentOk = parsed && agentName ? parsed.agent === agentName : undefined;
  const rows = usable ? payloadMatchesRows(payload!, cycle.decisions) : null;
  const orders = reveal ? parseOrderIds(reveal.okxOrderId) : null;

  const verdict: "ok" | "bad" | "grey" = !usable
    ? "grey"
    : tamper || !matchStated || (onchain && !matchChain) || cycleOk === false
      ? "bad"
      : "ok";

  const pretty = (() => {
    try {
      return payload ? JSON.stringify(JSON.parse(payload), null, 2) : "";
    } catch {
      return payload ?? "";
    }
  })();

  const cheat = () => {
    if (!basePayload) return;
    try {
      const p = JSON.parse(basePayload) as { decisions: { action: string; size_usdt: string; inst_id: string }[] };
      const i = p.decisions.findIndex((d) => d.action === "BUY" || d.action === "SELL");
      let diff: string;
      if (i >= 0) {
        const old = p.decisions[i].size_usdt;
        p.decisions[i].size_usdt = (Number(old) * 10).toFixed(2);
        diff = `decisions[${i}].size_usdt "${old}" → "${p.decisions[i].size_usdt}" (${coin(p.decisions[i].inst_id)})`;
      } else {
        p.decisions[0].action = "BUY";
        p.decisions[0].size_usdt = "5";
        diff = `decisions[0].action "HOLD" → "BUY" (${coin(p.decisions[0].inst_id)})`;
      }
      // keep key order as-is: any change to the bytes is enough
      setTamper({ payload: JSON.stringify(p), diff });
    } catch {
      /* not JSON — nothing to tamper */
    }
  };

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={`Verify cycle ${cycle.id}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet">
        <header className="sheet-head">
          <div>
            <b>Open the sealed envelope yourself</b>
            <span className="muted"> · round #{cycle.id}</span>
          </div>
          <button className="btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="sheet-body">
          <p className="lead">
            GRAIL locked this decision on Avalanche before trading. Your browser now recomputes its fingerprint and compares it with the one
            stored on-chain. Nothing is sent to a server.
          </p>

          <ol className="checks-list">
            <CheckRow
              title="Fingerprint computed in your browser"
              tech="keccak256(payload ‖ salt)"
              value={phase === "computing" ? "computing…" : !usable ? "cannot compute — payload or salt is missing or a placeholder" : computed}
              mark={phase === "computing" || !usable ? undefined : matchStated}
              note={usable ? (fromChain ? "input read from the reveal transaction on Fuji" : "input taken from state.json") : undefined}
            />
            <CheckRow title="Fingerprint the agent reports" tech="state.json · commit_hash" value={cycle.commit_hash ?? "—"} />
            <CheckRow
              title="Fingerprint stored on Avalanche"
              tech={`GrailLedger.decisions(${agentId ?? "?"}, ${cycleNo ?? "?"})`}
              value={
                skipChain
                  ? "demo cycle — never sent to Fuji, nothing to read"
                  : phase !== "done"
                    ? phase === "reading"
                      ? "reading Fuji…"
                      : "waiting"
                    : chainErr
                      ? `could not read Fuji (${chainErr})`
                      : onchain && !onchain.committed
                        ? "not committed on-chain"
                        : onchainHash
              }
              mark={phase === "done" && onchain && usable ? (onchain.committed ? matchChain : false) : undefined}
              note={
                onchain?.committed
                  ? `sealed at ${clock(onchain.committedAt * 1000)} · ${onchain.revealed ? "opened (revealed)" : "not opened yet"} · contract ${shortHash(chain.ledger)}`
                  : undefined
              }
            />
            <CheckRow
              title="It is the right cycle"
              tech="payload.cycle_id == cycleId (R-003-4)"
              value={parsed ? `payload says cycle ${String(parsed.cycle_id)}${agentName ? `, agent ${String(parsed.agent)}` : ""}` : "—"}
              mark={phase === "done" && cycleOk !== undefined ? cycleOk && agentOk !== false : undefined}
            />
          </ol>

          {phase === "done" && (
            <div className={`result ${verdict}`}>
              <span className="result-mark" aria-hidden="true">
                {verdict === "ok" ? "✓" : verdict === "bad" ? "✕" : "–"}
              </span>
              <div>
                <b>
                  {verdict === "ok"
                    ? "Match — you didn't have to trust us"
                    : verdict === "bad"
                      ? "Mismatch"
                      : "Mock data — cannot verify"}
                </b>
                <p>
                  {verdict === "ok"
                    ? `All ${cycle.decisions.length} decisions in round #${cycle.id}${cycle.decisions.some((d) => d.action === "HOLD") ? ", holds included," : ""} are exactly what was sealed${onchain?.committed ? ` on Avalanche at ${clock(onchain.committedAt * 1000)}` : ""}, before any order was sent.${!onchain ? " (Avalanche could not be read, so this compares with state.json only.)" : ""}`
                    : verdict === "bad"
                      ? tamper
                        ? "The edited decision no longer matches the sealed fingerprint. One changed digit breaks the seal."
                        : "The decision text does not match the sealed fingerprint."
                      : "This state has placeholder values, so there is nothing real to check."}
                </p>
              </div>
            </div>
          )}

          {phase === "done" && usable && (
            <div className="cheat">
              <b>Try to cheat</b>
              <p className="muted">Change one number in the sealed decision and check again.</p>
              {tamper ? (
                <>
                  <p className="mono" style={{ color: "var(--sell)", fontSize: 12 }}>
                    edited: {tamper.diff}
                  </p>
                  <button className="btn sm" onClick={() => setTamper(null)}>
                    Restore original
                  </button>
                </>
              ) : (
                <button className="btn sm danger" onClick={cheat}>
                  Change one number
                </button>
              )}
            </div>
          )}

          {orders && (
            <section>
              <div className="label">What happened to the orders · from the reveal</div>
              {orders === "none" ? (
                <p className="muted">No order was sent in this cycle.</p>
              ) : (
                <table className="table" style={{ marginTop: 6 }}>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.inst}>
                        <td style={{ fontWeight: 600 }}>{coin(o.inst)}</td>
                        <td className="r mono">
                          {o.id === "simulated" ? (
                            <span style={{ color: "var(--warn)" }}>simulated (practice mode)</span>
                          ) : o.id === "unknown" ? (
                            <span style={{ color: "var(--warn)" }}>unknown — checked later</span>
                          ) : (
                            o.id
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="tech">okxOrderId (v0.6): {reveal!.okxOrderId === "" ? '""' : reveal!.okxOrderId}</p>
            </section>
          )}

          {rows && !rows.ok && <p style={{ color: "var(--danger)", fontSize: 13 }}>✕ {rows.note}</p>}

          <details className="math">
            <summary>Show the math</summary>
            <p className="mono small">fingerprint = keccak256( utf8(payload_utf8) ‖ bytes(salt_hex) )</p>
            <div className="kvrows">
              <dt>salt</dt>
              <dd className="mono small">{salt ?? "—"}</dd>
              <dt>commit tx</dt>
              <dd>
                <ExplorerLink explorer={explorer} kind="tx" value={cycle.commit_tx} />
              </dd>
              <dt>reveal tx</dt>
              <dd>{cycle.reveal_tx ? <ExplorerLink explorer={explorer} kind="tx" value={cycle.reveal_tx} /> : "not opened yet"}</dd>
            </div>
            <div className="label" style={{ marginTop: 12 }}>
              payload_utf8 · {payload ? new TextEncoder().encode(payload).length : 0} bytes {fromChain ? "· from reveal tx" : ""}
            </div>
            <pre className={tamper ? "tampered" : ""}>{pretty || "—"}</pre>
          </details>
        </div>
      </aside>
    </div>
  );
}

function CheckRow({ title, tech, value, mark, note }: { title: string; tech: string; value?: string; mark?: boolean; note?: string }) {
  return (
    <li className="check">
      <div>
        <div className="check-title">{title}</div>
        <div className="tech">{tech}</div>
        <div className="mono small check-value">{value ?? "—"}</div>
        {note && <div className="tech">{note}</div>}
      </div>
      {mark !== undefined && (
        <span className={`mark ${mark ? "ok" : "bad"}`} aria-label={mark ? "matches" : "does not match"}>
          {mark ? "✓" : "✕"}
        </span>
      )}
    </li>
  );
}
