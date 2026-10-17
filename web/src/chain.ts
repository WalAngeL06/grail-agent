// Read-only Fuji access for "Verify yourself" (R-003-1 / R-003-4). No wallet, no new packages:
// minimal ABI encoding/decoding by hand, keccak from @noble/hashes. Addresses come from contracts/chain.json.
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

export type ChainInfo = {
  rpc: string;
  explorer?: string;
  chainId?: number;
  ledger?: string;
  identityRegistry?: string;
  agentId?: string;
  agentName?: string;
  agentWallet?: string;
  registrationTx?: string;
  ledgerDeployTx?: string;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const s = (v: unknown) => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined);

/** contracts/chain.json (T-003 shape): { chainId, explorer, agentId, agentName, contracts: { GrailLedger: { address, abi } ... } } */
export function readChainJson(j: unknown): ChainInfo {
  const o = isObj(j) ? j : {};
  const cs = isObj(o.contracts) ? o.contracts : {};
  const led = isObj(cs.GrailLedger) ? cs.GrailLedger : {};
  const idr = isObj(cs.IdentityRegistry) ? cs.IdentityRegistry : {};
  return {
    rpc: s(o.rpc_url) ?? s(o.rpc) ?? FUJI_RPC,
    explorer: s(o.explorer),
    chainId: typeof o.chainId === "number" ? o.chainId : undefined,
    ledger: s(led.address),
    identityRegistry: s(idr.address),
    agentId: s(o.agentId),
    agentName: s(o.agentName),
    agentWallet: s(o.agentWallet),
    registrationTx: s(o.registrationTx),
    ledgerDeployTx: s(led.deployTx),
  };
}

const selector = (sig: string) => bytesToHex(keccak_256(utf8ToBytes(sig))).slice(0, 8);
const SEL = {
  decisions: selector("decisions(uint256,uint256)"),
  commitCount: selector("commitCount(uint256)"),
  revealCount: selector("revealCount(uint256)"),
  revealDecision: selector("revealDecision(uint256,uint256,bytes,bytes32,string)"),
};
const word = (n: bigint) => n.toString(16).padStart(64, "0");

// Public Fuji RPC rate-limits (HTML error pages); Routescan (Snowtrace's backend) proxy API is the fallback. Both CORS-open.
const ROUTESCAN = "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api";

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  try {
    return await jsonRpc<T>(url, method, params);
  } catch (e) {
    const q: Record<string, string> | null =
      method === "eth_call"
        ? { action: "eth_call", to: (params[0] as { to: string }).to, data: (params[0] as { data: string }).data, tag: "latest" }
        : method === "eth_getTransactionByHash" || method === "eth_getTransactionReceipt"
          ? { action: method, txhash: String(params[0]) }
          : null;
    if (!q) throw e;
    const res = await fetch(`${ROUTESCAN}?module=proxy&${new URLSearchParams(q)}`);
    const j = (await res.json()) as { result?: T; error?: { message?: string } };
    if (j.error || j.result === undefined) throw new Error(j.error?.message ?? (e instanceof Error ? e.message : "RPC error"));
    return j.result;
  }
}

async function jsonRpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    const j = (await res.json()) as { result?: T; error?: { message?: string } };
    if (j.error) throw new Error(j.error.message ?? "RPC error");
    return j.result as T;
  } finally {
    window.clearTimeout(t);
  }
}

const toBig = (v: string | number) => BigInt(v);

export type OnChainDecision = { commitHash: string; committedAt: number; committed: boolean; revealed: boolean };

/** GrailLedger.decisions(agentId, cycleId) → (bytes32 commitHash, uint256 committedAt, bool committed, bool revealed) */
/** R-010-5: cycle ids travel as JS numbers; refuse anything that a Number cannot hold exactly. */
export function safeCycle(v: bigint | number): number {
  const n = typeof v === "bigint" ? Number(v) : v;
  if (!Number.isSafeInteger(n) || n < 0 || (typeof v === "bigint" && BigInt(n) !== v)) throw new Error(`check-in id ${String(v)} is outside the supported range`);
  return n;
}

export async function readDecision(c: ChainInfo, agentId: string, cycleId: number): Promise<OnChainDecision> {
  safeCycle(cycleId);
  if (!c.ledger) throw new Error("no GrailLedger address in chain.json");
  const data = "0x" + SEL.decisions + word(toBig(agentId)) + word(BigInt(cycleId));
  const out = await rpc<string>(c.rpc, "eth_call", [{ to: c.ledger, data }, "latest"]);
  const h = (out ?? "0x").slice(2);
  if (h.length < 256) throw new Error("unexpected eth_call result");
  return {
    commitHash: "0x" + h.slice(0, 64),
    committedAt: Number(BigInt("0x" + h.slice(64, 128))),
    committed: BigInt("0x" + h.slice(128, 192)) !== 0n,
    revealed: BigInt("0x" + h.slice(192, 256)) !== 0n,
  };
}

export async function readCounts(c: ChainInfo, agentId: string): Promise<{ commits: number; reveals: number }> {
  if (!c.ledger) throw new Error("no GrailLedger address in chain.json");
  const call = (sel: string) => rpc<string>(c.rpc, "eth_call", [{ to: c.ledger, data: "0x" + sel + word(toBig(agentId)) }, "latest"]);
  const [a, b] = await Promise.all([call(SEL.commitCount), call(SEL.revealCount)]);
  return { commits: Number(BigInt(a)), reveals: Number(BigInt(b)) };
}

export type RevealCall = { agentId: string; cycleId: string; payloadUtf8: string; saltHex: string; okxOrderId: string; to?: string; from?: string };

/** Decode revealDecision(uint256 agentId, uint256 cycleId, bytes payload, bytes32 salt, string okxOrderId) from the reveal tx input. */
export async function readReveal(c: ChainInfo, revealTx: string): Promise<RevealCall | null> {
  const tx = await rpc<{ input?: string; to?: string; from?: string } | null>(c.rpc, "eth_getTransactionByHash", [revealTx]);
  if (!tx?.input) return null;
  const h = tx.input.replace(/^0x/, "");
  if (h.slice(0, 8) !== SEL.revealDecision) throw new Error("reveal tx is not a revealDecision call");
  const body = h.slice(8);
  const w = (i: number) => body.slice(i * 64, (i + 1) * 64);
  const dyn = (offWord: string) => {
    const off = Number(BigInt("0x" + offWord)) * 2;
    const len = Number(BigInt("0x" + body.slice(off, off + 64)));
    return hexToBytes(body.slice(off + 64, off + 64 + len * 2));
  };
  const dec = new TextDecoder();
  return {
    agentId: BigInt("0x" + w(0)).toString(),
    cycleId: BigInt("0x" + w(1)).toString(),
    payloadUtf8: dec.decode(dyn(w(2))),
    saltHex: "0x" + w(3),
    okxOrderId: dec.decode(dyn(w(4))),
    to: tx.to,
    from: tx.from,
  };
}

/** v0.6: okxOrderId is canonical JSON {"BTC-USDT":"<ordId>|simulated|unknown"} per cycle; "" = no order. */
export function parseOrderIds(raw: string): { inst: string; id: string }[] | "none" | null {
  if (raw === "") return "none";
  try {
    const o = JSON.parse(raw);
    if (!isObj(o)) return null;
    return Object.entries(o).map(([inst, id]) => ({ inst, id: String(id) }));
  } catch {
    return null;
  }
}

// ---- full on-chain history from event logs (Routescan logs API; Fuji public RPC caps eth_getLogs at 100 blocks) ----
const LEDGER_DEPLOY_BLOCK = 59595834; // R-003-6: GrailLedger deploy block (chain.json has no deployBlock yet)
const topic = (sig: string) => "0x" + bytesToHex(keccak_256(utf8ToBytes(sig)));
const T_COMMIT = topic("DecisionCommitted(uint256,uint256,bytes32,uint256)");
const T_REVEAL = topic("DecisionRevealed(uint256,uint256,bytes,string)");

export type ChainCycle = {
  cycleId: number;
  commitTx?: string;
  commitHash?: string;
  committedAt?: number; // ms
  revealTx?: string;
  payloadUtf8?: string;
  okxOrderId?: string;
};

type Log = { topics: string[]; data: string; transactionHash: string; timeStamp?: string };

export async function readLedgerHistory(c: ChainInfo, agentId: string): Promise<ChainCycle[]> {
  if (!c.ledger) throw new Error("no GrailLedger address in chain.json");
  const t1 = "0x" + word(toBig(agentId));
  const get = async (t0: string) => {
    const q = new URLSearchParams({
      module: "logs",
      action: "getLogs",
      address: c.ledger!,
      fromBlock: String(LEDGER_DEPLOY_BLOCK),
      toBlock: "latest",
      nocache: String(Date.now()), // R-010-4: Routescan GETs were served stale from the CDN cache
      topic0: t0,
      topic1: t1,
      topic0_1_opr: "and",
    });
    const res = await fetch(`${ROUTESCAN}?${q}`);
    const j = (await res.json()) as { status?: string; result?: Log[] | string; message?: string };
    if (!Array.isArray(j.result)) {
      if (j.message === "No records found") return [];
      throw new Error(typeof j.result === "string" ? j.result : (j.message ?? "logs error"));
    }
    return j.result;
  };
  const [commits, reveals] = await Promise.all([get(T_COMMIT), get(T_REVEAL)]);
  const out = new Map<number, ChainCycle>();
  const at = (id: number) => out.get(id) ?? (out.set(id, { cycleId: id }), out.get(id)!);
  for (const l of commits) {
    const id = safeCycle(BigInt(l.topics[2]));
    const d = l.data.replace(/^0x/, "");
    Object.assign(at(id), { commitTx: l.transactionHash, commitHash: "0x" + d.slice(0, 64), committedAt: Number(BigInt("0x" + d.slice(64, 128))) * 1000 });
  }
  const dec = new TextDecoder();
  for (const l of reveals) {
    const id = safeCycle(BigInt(l.topics[2]));
    const d = l.data.replace(/^0x/, "");
    const dyn = (offHex: string) => {
      const off = Number(BigInt("0x" + offHex)) * 2;
      const len = Number(BigInt("0x" + d.slice(off, off + 64)));
      return dec.decode(hexToBytes(d.slice(off + 64, off + 64 + len * 2)));
    };
    try {
      Object.assign(at(id), { revealTx: l.transactionHash, payloadUtf8: dyn(d.slice(0, 64)), okxOrderId: dyn(d.slice(64, 128)) });
    } catch {
      Object.assign(at(id), { revealTx: l.transactionHash });
    }
  }
  return [...out.values()].sort((a, b) => b.cycleId - a.cycleId);
}


type Receipt = { status?: string; to?: string; from?: string; logs?: { address?: string; topics?: string[] }[] };

/**
 * R-010-3 (mirrors chain/scripts/lib/verify-cycle.ts): a reveal only counts if its transaction went to the GrailLedger
 * from chain.json, calls revealDecision for this agent and check-in, succeeded (receipt status 1), was sent by the
 * agent wallet, and emitted DecisionRevealed(agentId, cycleId) from the ledger. Returns the decoded call + problems.
 */
export async function checkReveal(c: ChainInfo, revealTx: string, agentId: string, cycleId: number): Promise<{ call: RevealCall | null; problems: string[] }> {
  const [call, receipt] = await Promise.all([readReveal(c, revealTx), rpc<Receipt | null>(c.rpc, "eth_getTransactionReceipt", [revealTx])]);
  const problems: string[] = [];
  const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  if (!call) problems.push("reveal transaction not found");
  if (!receipt) problems.push("reveal receipt not found (pending or dropped)");
  else if (receipt.status !== "0x1") problems.push("reveal transaction failed (receipt status is not 1)");
  if (!c.ledger) problems.push("no ledger address in chain.json");
  if (call) {
    if (!same(call.to, c.ledger) || (receipt && !same(receipt.to, c.ledger))) problems.push("reveal went to another contract");
    if (call.agentId !== String(BigInt(agentId))) problems.push(`reveal is for agent ${call.agentId}`);
    if (call.cycleId !== String(cycleId)) problems.push(`reveal is for check-in ${call.cycleId}`);
    if (c.agentWallet && !same(call.from, c.agentWallet)) problems.push("reveal was not sent by the agent wallet");
  }
  if (receipt && receipt.status === "0x1") {
    const t1 = "0x" + word(toBig(agentId));
    const t2 = "0x" + word(BigInt(cycleId));
    const ev = (receipt.logs ?? []).some(
      (l) => same(l.address, c.ledger) && l.topics?.[0] === T_REVEAL && same(l.topics?.[1], t1) && same(l.topics?.[2], t2),
    );
    if (!ev) problems.push("no DecisionRevealed event for this agent and check-in");
  }
  return { call, problems };
}
