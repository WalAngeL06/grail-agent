import { useEffect, useMemo, useState } from "react";
import type { Cycle } from "../state";
import { checkOnChain, computeCommit, isVerifiable, payloadMatchesRows, type ChainResult } from "../verify";

type Props = { cycle: Cycle; rpc: string; contract?: string; demo?: boolean };

/** "Verify yourself" (ui-brief §1.3): hash computed in this browser, compared with the stated hash and the commit tx on Fuji. */
export default function VerifyPanel({ cycle, rpc, contract, demo }: Props) {
  const original = cycle.payload_utf8 ?? "";
  const salt = cycle.salt_hex ?? "";
  const [payload, setPayload] = useState(original);
  const [computing, setComputing] = useState(true);
  const [chain, setChain] = useState<ChainResult | "loading" | null>(null);
  const verifiable = isVerifiable(cycle.payload_utf8, cycle.salt_hex);

  const local = useMemo(() => (verifiable ? computeCommit(payload, salt, cycle.commit_hash) : null), [verifiable, payload, salt, cycle.commit_hash]);
  const origLocal = useMemo(() => (verifiable ? computeCommit(original, salt, cycle.commit_hash) : null), [verifiable, original, salt, cycle.commit_hash]);
  const rows = useMemo(() => (verifiable ? payloadMatchesRows(payload, cycle.decisions) : null), [verifiable, payload, cycle.decisions]);

  useEffect(() => {
    // The hash takes <1 ms; the 400 ms pause makes the moment visible in the demo (brief §1.3).
    const t = window.setTimeout(() => setComputing(false), 400);
    let alive = true;
    if (demo) setChain({ kind: "skipped", why: "demo data — tx ids are made up, nothing to read on Fuji" });
    else if (verifiable && origLocal?.ok) {
      setChain("loading");
      checkOnChain(cycle.commit_tx, origLocal.computed, rpc, contract).then((r) => alive && setChain(r));
    }
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);

  if (!verifiable) {
    const notRevealed = !cycle.reveal_tx && !cycle.payload_utf8;
    return (
      <div className="verify" role="region" aria-label="Verify yourself">
        <p className="formula">commit_hash = keccak256( utf8(payload) ‖ salt )</p>
        <div className="verdict grey">
          {notRevealed ? "Not revealed yet — cannot verify" : "Mock data — cannot verify"}
        </div>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
          {notRevealed
            ? "The salt stays secret until the reveal transaction. Until then this commit is counted as open on the ledger, so it can't be quietly dropped."
            : "This state has placeholder payload/salt values (e.g. \"0x5a...\"), so there is nothing real to hash."}
        </p>
      </div>
    );
  }

  const edited = payload !== original;
  const localOk = local?.ok === true && local.matches;
  const chainLine = chainText(chain, origLocal?.ok ? origLocal.computed : undefined);
  const chainBad = chain && chain !== "loading" && (chain.kind === "mismatch" || chain.kind === "not_found" || chain.kind === "wrong_contract");

  return (
    <div className="verify" role="region" aria-label="Verify yourself">
      <h4>Verify yourself · cycle #{cycle.cycle_id ?? "?"}</h4>
      <p className="formula">commit_hash = keccak256( utf8(payload) ‖ salt ) — computed in your browser</p>

      {computing ? (
        <div className="verdict grey">computing…</div>
      ) : (
        <>
          <div className="lines">
            <span className="muted">computed</span>
            <span className="mono">{local?.ok ? local.computed : local && !local.ok ? local.error : "—"}</span>
            <span>{local?.ok ? (local.matches ? "✅" : "❌") : ""}</span>
            <span className="muted">stated</span>
            <span className="mono">{cycle.commit_hash ?? "—"}</span>
            <span />
            <span className="muted">on-chain</span>
            <span className="mono" style={{ color: chainBad ? "var(--danger)" : chain && chain !== "loading" && chain.kind === "match" ? undefined : "var(--muted)" }}>
              {chainLine}
            </span>
            <span>{chain && chain !== "loading" ? (chain.kind === "match" ? "✅" : chainBad ? "❌" : "") : ""}</span>
          </div>

          {localOk && !chainBad ? (
            <div className="verdict ok">
              ✅ Match — you didn't have to trust us
              {chain && chain !== "loading" && chain.kind !== "match" && <small>(on-chain check unavailable)</small>}
            </div>
          ) : (
            <div className="verdict bad">
              ❌ Mismatch
              <small>
                {edited
                  ? "You changed the payload — one character is enough to break the seal."
                  : !localOk
                    ? "The payload or salt is not what was committed."
                    : "The commit transaction on Fuji does not carry this hash."}
              </small>
            </div>
          )}
          {rows && (
            <p className={rows.ok ? "muted" : ""} style={{ margin: "8px 0 0", fontSize: 13, color: rows.ok ? undefined : "var(--danger)" }}>
              {rows.ok ? "✓ " : "✕ "}
              {rows.note}
            </p>
          )}
        </>
      )}

      <details className="tamper">
        <summary>Try tampering with the payload</summary>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          spellCheck={false}
          aria-label="Payload to hash"
        />
        {edited && (
          <button className="btn sm" onClick={() => setPayload(original)}>
            Restore original
          </button>
        )}
      </details>
    </div>
  );
}

function chainText(r: ChainResult | "loading" | null, hash?: string): string {
  if (r === null) return "—";
  if (r === "loading") return "reading Fuji…";
  switch (r.kind) {
    case "match":
      return `${hash} (in commit tx calldata${r.block ? `, block ${r.block}` : ""})`;
    case "mismatch":
      return "commit tx found, but it does not carry this hash";
    case "wrong_contract":
      return `commit tx went to another contract (${r.to})`;
    case "not_found":
      return "commit tx not found on Fuji";
    case "unreachable":
      return `Fuji RPC unreachable (${r.error})`;
    case "skipped":
      return r.why;
  }
}
