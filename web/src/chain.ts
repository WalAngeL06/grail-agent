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
        : method === "eth_getTransactionByHash"
          ? { action: "eth_getTransactionByHash", txhash: String(params[0]) }
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
export async function readDecision(c: ChainInfo, agentId: string, cycleId: number): Promise<OnChainDecision> {
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

export type RevealCall = { agentId: string; cycleId: number; payloadUtf8: string; saltHex: string; okxOrderId: string; to?: string };

/** Decode revealDecision(uint256 agentId, uint256 cycleId, bytes payload, bytes32 salt, string okxOrderId) from the reveal tx input. */
export async function readReveal(c: ChainInfo, revealTx: string): Promise<RevealCall | null> {
  const tx = await rpc<{ input?: string; to?: string } | null>(c.rpc, "eth_getTransactionByHash", [revealTx]);
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
    cycleId: Number(BigInt("0x" + w(1))),
    payloadUtf8: dec.decode(dyn(w(2))),
    saltHex: "0x" + w(3),
    okxOrderId: dec.decode(dyn(w(4))),
    to: tx.to,
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
