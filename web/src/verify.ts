// "Kendin Doğrula": commitHash = keccak256(utf8(payload) ‖ salt)  (contracts/decision.md)
// Tamamen tarayıcıda; sunucuya güven yok. Zincir okuması salt-okunur JSON-RPC (cüzdan gerekmez).
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

export const isHex32 = (v?: string) => !!v && /^0x[0-9a-fA-F]{64}$/.test(v);
export const isAddress = (v?: string) => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

export type LocalResult =
  | { ok: true; computed: string; matches: boolean; saltBytes: number }
  | { ok: false; error: string };

export function computeCommit(payloadUtf8: string, saltHex: string, expected?: string): LocalResult {
  const clean = saltHex.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0 || clean.length === 0)
    return { ok: false, error: "salt_hex is not valid hex" };
  const payload = utf8ToBytes(payloadUtf8);
  const salt = hexToBytes(clean);
  const buf = new Uint8Array(payload.length + salt.length);
  buf.set(payload, 0);
  buf.set(salt, payload.length);
  const computed = "0x" + bytesToHex(keccak_256(buf));
  return {
    ok: true,
    computed,
    matches: !!expected && computed.toLowerCase() === expected.trim().toLowerCase(),
    saltBytes: salt.length,
  };
}

export type RowCheck = { ok: boolean; note: string } | null;

/** Do the decisions inside the sealed payload match the rows shown on screen (action + size, per coin)? */
export function payloadMatchesRows(payloadUtf8: string, rows: { inst_id?: string; action?: string; size_usdt?: string }[]): RowCheck {
  let p: unknown;
  try {
    p = JSON.parse(payloadUtf8);
  } catch {
    return { ok: false, note: "payload is not valid JSON" };
  }
  const list = (p as { decisions?: unknown })?.decisions;
  if (!Array.isArray(list)) return null;
  const bad: string[] = [];
  for (const r of rows) {
    const d = list.find((x) => (x as { inst_id?: unknown })?.inst_id === r.inst_id) as { action?: string; size_usdt?: string } | undefined;
    if (!d) bad.push(`${r.inst_id ?? "?"} missing`);
    else if ((r.action && d.action !== r.action) || (r.size_usdt && d.size_usdt !== undefined && Number(d.size_usdt) !== Number(r.size_usdt)))
      bad.push(`${r.inst_id}: payload says ${d.action} ${d.size_usdt}, screen shows ${r.action} ${r.size_usdt}`);
  }
  return bad.length
    ? { ok: false, note: bad.join("; ") }
    : { ok: true, note: `all ${rows.length} decisions on screen match the sealed payload` };
}

/** Mock placeholders like "0x5a..." can't be hashed; say so instead of showing a red ❌. */
export function isVerifiable(payloadUtf8?: string, saltHex?: string): boolean {
  if (!payloadUtf8 || !saltHex) return false;
  if (!/^0x[0-9a-fA-F]+$/.test(saltHex.trim()) || saltHex.trim().length % 2 !== 0) return false;
  try {
    JSON.parse(payloadUtf8);
    return true;
  } catch {
    return false;
  }
}

export type ChainResult =
  | { kind: "match"; to?: string; block?: number }
  | { kind: "mismatch"; to?: string }
  | { kind: "not_found" }
  | { kind: "wrong_contract"; to?: string }
  | { kind: "unreachable"; error: string }
  | { kind: "skipped"; why: string };

/** Commit tx'inin calldata'sı commit_hash'i içeriyor mu? ABI'ye bağlı değil: bytes32 argüman calldata'da aynen durur. */
export async function checkOnChain(
  commitTx: string | undefined,
  commitHash: string,
  rpcUrl: string,
  contract?: string,
): Promise<ChainResult> {
  if (!isHex32(commitTx)) return { kind: "skipped", why: "commit_tx is not a valid transaction hash" };
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [commitTx] }),
      signal: ctrl.signal,
    });
    window.clearTimeout(t);
    const j = (await res.json()) as { result?: { input?: string; to?: string; blockNumber?: string } | null; error?: { message?: string } };
    if (j.error) return { kind: "unreachable", error: j.error.message ?? "RPC error" };
    if (!j.result) return { kind: "not_found" };
    const input = (j.result.input ?? "").toLowerCase();
    const to = j.result.to ?? undefined;
    if (isAddress(contract) && to && to.toLowerCase() !== contract!.toLowerCase()) return { kind: "wrong_contract", to };
    const needle = commitHash.toLowerCase().replace(/^0x/, "");
    const block = j.result.blockNumber ? parseInt(j.result.blockNumber, 16) : undefined;
    return input.includes(needle) ? { kind: "match", to, block } : { kind: "mismatch", to };
  } catch (e) {
    return { kind: "unreachable", error: e instanceof Error ? e.message : String(e) };
  }
}

/** chain.json shape is not final yet (T-003): pick RPC / contract / agentId tolerantly. */
export function chainHints(chainJson: unknown): { rpc: string; address?: string; agentId?: string } {
  const o = (typeof chainJson === "object" && chainJson) || {};
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const parts = k.split(".");
      let cur: unknown = o;
      for (const p of parts) cur = typeof cur === "object" && cur ? (cur as Record<string, unknown>)[p] : undefined;
      if (typeof cur === "string" && cur) return cur;
      if (typeof cur === "number") return String(cur);
    }
    return undefined;
  };
  return {
    rpc: pick("rpc_url", "rpc", "rpcUrl", "network.rpc_url") ?? FUJI_RPC,
    address: pick("ledger.address", "GrailLedger.address", "contracts.GrailLedger.address", "ledger_address", "address"),
    agentId: pick("agent_id", "agentId", "identity.agent_id", "erc8004.agent_id"),
  };
}
