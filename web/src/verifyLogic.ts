// Final verdict of "Verify yourself" (R-010). Pure, no imports, so `node --test scripts/` can run it directly.
// Rule: green "Match" only when the seal was read from Avalanche and every check passed.
// Any failed check → Mismatch. Any check that could not run (network, missing agent id, unverified reveal) → Unverified.

export type ChainRead =
  | { kind: "skipped-demo" } // made-up demo check-in, never sent to Fuji
  | { kind: "error"; error: string } // RPC + fallback failed, HTTP 429, no agent id, …
  | { kind: "ok"; committed: boolean; commitHash: string; revealed: boolean };

export type RevealRead =
  | { kind: "none" } // the file does not claim a reveal tx
  | { kind: "error"; error: string } // could not read the reveal tx / receipt
  | { kind: "ok"; problems: string[] }; // read; problems = binding failures (target, agent, cycle, receipt, event, sender)

export type VerdictInput = {
  usable: boolean; // payload + 32-byte salt available
  computed?: string; // keccak256(payload ‖ salt) computed in the browser
  stated?: string; // commit_hash the agent reported
  tampered: boolean; // user pressed "Change one number"
  cycleOk?: boolean; // payload.cycle_id == cycleId
  agentOk?: boolean; // payload.agent == expected agent name
  rowsOk?: boolean | null; // decisions on screen == sealed payload
  stateClaimsReveal: boolean;
  chain: ChainRead;
  reveal: RevealRead;
};

export type VerdictKind = "match" | "mismatch" | "unverified" | "demo" | "mock" | "not-opened";
export type Verdict = { kind: VerdictKind; reasons: string[] };

const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function decideVerdict(v: VerdictInput): Verdict {
  const bad: string[] = [];
  // Failed checks first: any of them makes the result a Mismatch, whatever else could or could not be read.
  if (v.reveal.kind === "ok") bad.push(...v.reveal.problems);
  if (v.tampered) bad.push("the decision text was edited");
  if (v.usable && v.computed) {
    if (v.stated && !eq(v.computed, v.stated)) bad.push("browser fingerprint differs from the agent's file");
    if (v.chain.kind === "ok") {
      if (!v.chain.committed) bad.push("this check-in is not sealed on Avalanche");
      else if (!eq(v.computed, v.chain.commitHash)) bad.push("browser fingerprint differs from the seal on Avalanche");
    }
  }
  if (v.chain.kind === "ok" && v.chain.committed && v.stateClaimsReveal && !v.chain.revealed) bad.push("the file says opened, Avalanche says not opened");
  if (v.cycleOk === false) bad.push("the sealed text is for another check-in");
  if (v.agentOk === false) bad.push("the sealed text names another agent");
  if (v.rowsOk === false) bad.push("decisions on screen differ from the sealed text");
  if (bad.length) return { kind: "mismatch", reasons: bad };

  if (!v.usable || !v.computed) {
    // nothing to hash locally: if that is because Avalanche (where the opening lives) was unreachable, say so
    if (v.chain.kind === "error") return { kind: "unverified", reasons: [`seal not checked: ${v.chain.error}`] };
    if (v.reveal.kind === "error") return { kind: "unverified", reasons: [`opening not checked: ${v.reveal.error}`] };
    return { kind: v.stateClaimsReveal ? "mock" : "not-opened", reasons: [] };
  }
  if (v.chain.kind === "skipped-demo") return { kind: "demo", reasons: ["demo check-in, not on Avalanche"] };
  if (v.chain.kind === "error") return { kind: "unverified", reasons: [`seal not checked: ${v.chain.error}`] };
  if (v.reveal.kind === "error") return { kind: "unverified", reasons: [`opening not checked: ${v.reveal.error}`] };
  if (v.stateClaimsReveal && v.reveal.kind === "none") return { kind: "unverified", reasons: ["opening not checked"] };
  return { kind: "match", reasons: [] };
}
