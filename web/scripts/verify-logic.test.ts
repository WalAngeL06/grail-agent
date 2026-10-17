// R-010 regression fixtures for the "Verify yourself" verdict. Run: npm test (node --test, TS type stripping).
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideVerdict, type VerdictInput } from "../src/verifyLogic.ts";

// Real cycle 1 on Fuji (R-010 table): payload/salt from the reveal, hash in storage.
const H = "0xd9064ac4000cae4637a50cd3f25b4ae7c9612e9c9600772f7468533371785a83";
const ok: VerdictInput = {
  usable: true,
  computed: H,
  stated: H,
  tampered: false,
  cycleOk: true,
  agentOk: true,
  rowsOk: true,
  stateClaimsReveal: true,
  chain: { kind: "ok", committed: true, commitHash: H, revealed: true },
  reveal: { kind: "ok", problems: [] },
};
const v = (patch: Partial<VerdictInput>) => decideVerdict({ ...ok, ...patch }).kind;

test("valid cycle, both reads ok → match", () => assert.equal(v({}), "match"));

// R-010-1: no on-chain proof → never green
test("primary + fallback RPC fail → unverified", () => assert.equal(v({ chain: { kind: "error", error: "Failed to fetch" } }), "unverified"));
test("HTTP 429 on both → unverified", () => assert.equal(v({ chain: { kind: "error", error: "429 Too Many Requests" } }), "unverified"));
test("agentId missing (no RPC call) → unverified", () => assert.equal(v({ chain: { kind: "error", error: "agent is not registered" } }), "unverified"));
test("reveal tx could not be read → unverified", () => assert.equal(v({ reveal: { kind: "error", error: "timeout" } }), "unverified"));
test("file claims reveal but it was not read → unverified", () => assert.equal(v({ reveal: { kind: "none" } }), "unverified"));

// already-correct negatives stay red
test("agentId=2, getter committed=false → mismatch", () =>
  assert.equal(v({ chain: { kind: "ok", committed: false, commitHash: "0x" + "0".repeat(64), revealed: false } }), "mismatch"));
test("payload cycle_id ≠ cycleId → mismatch", () => assert.equal(v({ cycleOk: false }), "mismatch"));

// R-010-2: identity and on-screen rows count
test("expected agent OTHER-AGENT, payload GRAIL-01 → mismatch", () => assert.equal(v({ agentOk: false }), "mismatch"));
test("screen shows SELL/999, sealed payload unchanged → mismatch", () => assert.equal(v({ rowsOk: false }), "mismatch"));

// R-010-3: reveal must be bound to ledger / agent / cycle / successful receipt
test("reveal call agent 99 / cycle 99 / to 0x0 → mismatch", () =>
  assert.equal(v({ reveal: { kind: "ok", problems: ["reveal went to another contract", "reveal is for agent 99", "reveal is for check-in 99"] } }), "mismatch"));
test("reverted reveal receipt → mismatch even if chain read failed", () =>
  assert.equal(v({ reveal: { kind: "ok", problems: ["reveal transaction failed"] }, chain: { kind: "error", error: "x" } }), "mismatch"));
test("file says opened, storage says not → mismatch", () =>
  assert.equal(v({ chain: { kind: "ok", committed: true, commitHash: H, revealed: false } }), "mismatch"));

// other paths
test("browser hash ≠ stored seal → mismatch", () =>
  assert.equal(v({ chain: { kind: "ok", committed: true, commitHash: "0x" + "1".repeat(64), revealed: true } }), "mismatch"));
test("browser hash ≠ agent file → mismatch", () => assert.equal(v({ stated: "0x" + "2".repeat(64) }), "mismatch"));
test("tampered → mismatch", () => assert.equal(v({ tampered: true }), "mismatch"));
test("demo check-in → demo, not match", () => assert.equal(v({ chain: { kind: "skipped-demo" }, reveal: { kind: "none" }, stateClaimsReveal: true }), "demo"));
test("placeholder salt → mock", () => assert.equal(v({ usable: false, computed: undefined }), "mock"));
test("not revealed yet → not-opened", () => assert.equal(v({ usable: false, computed: undefined, stateClaimsReveal: false, reveal: { kind: "none" } }), "not-opened"));
test("not-revealed cycle with valid seal is not a match", () =>
  assert.notEqual(v({ usable: false, computed: undefined, stateClaimsReveal: false, reveal: { kind: "none" } }), "match"));

// found in browser: chain-only check-in (salt only in the reveal calldata) while Avalanche is unreachable
test("no salt locally + chain unreachable → unverified, not 'sample data'", () =>
  assert.equal(
    v({ usable: false, computed: undefined, chain: { kind: "error", error: "Failed to fetch" }, reveal: { kind: "error", error: "Failed to fetch" } }),
    "unverified",
  ));
test("no salt locally + reveal unreadable → unverified", () =>
  assert.equal(v({ usable: false, computed: undefined, reveal: { kind: "error", error: "timeout" } }), "unverified"));
