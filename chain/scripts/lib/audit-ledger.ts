import { Contract, Interface, toBeHex, zeroPadValue } from "ethers";
import type { Log, Provider } from "ethers";
import { parseCycle, verifyCycle } from "./verify-cycle";
import type { CycleDeployment, CycleResult } from "./verify-cycle";

export const PUBLICNODE_RPC = "https://avalanche-fuji-c-chain-rpc.publicnode.com";
export type AuditRow = CycleResult & {
  commitTime?: string;
  revealTime?: string;
  elapsedSeconds?: number;
  okxOrderId?: string;
  error?: string;
};
export type LedgerAudit = {
  agentId: string;
  chainId: number;
  ledger: string;
  deployBlock: number;
  snapshotBlock: number;
  snapshotHash: string;
  auditedAt: string;
  rows: AuditRow[];
  summary: { total: number; revealed: number; unopened: number; matches: number; mismatches: number; liveOrders: number };
};
type AuditOptions = {
  chunkSize?: number;
  pauseMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (from: number, to: number, head: number) => void;
};

class AuditReadError extends Error {}
const errorText = (error: unknown) => (error as any)?.shortMessage || (error as Error)?.message || "Unknown RPC failure";

/** Scan every agent event at one fixed head, then use the existing independent preimage verifier. */
export async function auditLedger(provider: Provider, deployment: CycleDeployment, options: AuditOptions = {}): Promise<LedgerAudit> {
  const chunkSize = options.chunkSize ?? 1000;
  const pauseMs = options.pauseMs ?? 150;
  const maxRetries = options.maxRetries ?? 4;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 1000
    || !Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 8
    || !Number.isFinite(pauseMs) || pauseMs < 0) throw new Error("Invalid audit scan options");

  async function read<T>(method: string, action: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await action();
        if (result == null) throw new Error("Missing RPC data");
        return result;
      } catch (error) {
        const details = `${errorText(error)} ${JSON.stringify((error as any)?.info?.error ?? {})}`;
        const throttled = (error as any)?.status === 429 || (error as any)?.response?.statusCode === 429
          || /429|too many requests|rate.?limit/i.test(details);
        if (!throttled || attempt >= maxRetries) throw new AuditReadError(`RPC read failed (${method}): ${errorText(error)}`);
        await sleep(500 * 2 ** attempt);
      }
    }
  }

  // Only public reads are memoized; the head is pinned for every per-cycle check.
  let snapshot: number | undefined;
  const cache = new Map<string, Promise<unknown>>();
  const cachedMethods = new Set(["getNetwork", "getBlockNumber", "getBlock", "getTransactionReceipt", "getTransaction", "call"]);
  const reader = new Proxy(provider, {
    get(target, prop) {
      if (prop === "getBlockNumber" && snapshot !== undefined) return async () => snapshot!;
      if (cachedMethods.has(String(prop))) return (...args: unknown[]) => {
        const key = `${String(prop)}:${JSON.stringify(args, (_key, value) => typeof value === "bigint" ? value.toString() : value)}`;
        if (!cache.has(key)) {
          const action = (target as any)[prop].bind(target);
          cache.set(key, read(String(prop), () => action(...args)));
        }
        return cache.get(key);
      };
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Provider;

  if ((await reader.getNetwork()).chainId !== BigInt(deployment.chainId)) throw new Error("Unexpected RPC network");
  const agentId = parseCycle(deployment.agentId);
  const entry = deployment.contracts.GrailLedger;
  const iface = new Interface(entry.abi);
  const ledger = new Contract(entry.address, entry.abi, reader);
  const deploy = await reader.getTransactionReceipt(entry.deployTx);
  if (!deploy || deploy.status !== 1 || deploy.contractAddress?.toLowerCase() !== entry.address.toLowerCase()) {
    throw new Error("Ledger deployment receipt/address not confirmed");
  }
  snapshot = await reader.getBlockNumber();
  if (snapshot < deploy.blockNumber) throw new Error("RPC head is before ledger deployment");
  const headBlock = await reader.getBlock(snapshot);
  if (!headBlock?.hash) throw new Error("Snapshot block missing");
  const expectedCommits: bigint = await ledger.commitCount(agentId, { blockTag: snapshot });
  const expectedReveals: bigint = await ledger.revealCount(agentId, { blockTag: snapshot });
  const groups = new Map<string, { commits: Log[]; reveals: Log[] }>();
  const topics = [iface.getEvent("DecisionCommitted")!.topicHash, iface.getEvent("DecisionRevealed")!.topicHash];

  for (let from = deploy.blockNumber; from <= snapshot; from += chunkSize) {
    const to = Math.min(snapshot, from + chunkSize - 1);
    const logs = await read("getLogs", () => provider.getLogs({
      address: entry.address, fromBlock: from, toBlock: to,
      topics: [topics, zeroPadValue(toBeHex(agentId), 32)],
    }));
    for (const log of logs) {
      const event = iface.parseLog(log);
      if (!event || !["DecisionCommitted", "DecisionRevealed"].includes(event.name)
        || log.removed || log.address.toLowerCase() !== entry.address.toLowerCase()
        || log.blockNumber < from || log.blockNumber > to || event.args.agentId !== agentId) {
        throw new Error("Unexpected event in ledger scan");
      }
      const id = event.args.cycleId.toString();
      const group = groups.get(id) ?? { commits: [], reveals: [] };
      (event.name === "DecisionCommitted" ? group.commits : group.reveals).push(log);
      groups.set(id, group);
    }
    options.onProgress?.(from, to, snapshot);
    if (to < snapshot && pauseMs) await sleep(pauseMs);
  }
  const commits = [...groups.values()].reduce((sum, group) => sum + group.commits.length, 0);
  const reveals = [...groups.values()].reduce((sum, group) => sum + group.reveals.length, 0);
  if (BigInt(commits) !== expectedCommits || BigInt(reveals) !== expectedReveals
    || [...groups.values()].some(group => group.commits.length !== 1 || group.reveals.length > 1)) {
    throw new Error(`Incomplete ledger scan: events ${commits}/${reveals}, storage counters ${expectedCommits}/${expectedReveals}; missing or duplicate events`);
  }

  const rows: AuditRow[] = [];
  for (const id of [...groups.keys()].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)) {
    const group = groups.get(id)!;
    const commit = group.commits[0];
    const reveal = group.reveals[0];
    const commitBlock = await reader.getBlock(commit.blockNumber);
    const revealBlock = reveal ? await reader.getBlock(reveal.blockNumber) : undefined;
    const row: AuditRow = {
      agentId: agentId.toString(), cycleId: id, status: "MISMATCH", commitTx: commit.transactionHash,
      revealTx: reveal?.transactionHash, commitHash: iface.parseLog(commit)!.args.commitHash,
      commitTime: new Date(commitBlock!.timestamp * 1000).toISOString(),
      revealTime: revealBlock ? new Date(revealBlock.timestamp * 1000).toISOString() : undefined,
      elapsedSeconds: revealBlock ? revealBlock.timestamp - commitBlock!.timestamp : undefined,
    };
    try {
      const result = await verifyCycle(reader, deployment, BigInt(id), { commitTx: commit.transactionHash, revealTx: reveal?.transactionHash });
      Object.assign(row, result);
      if (reveal) {
        const tx = await reader.getTransaction(reveal.transactionHash);
        row.okxOrderId = iface.parseTransaction({ data: tx!.data })!.args.okxOrderId;
      }
    } catch (error) {
      // Missing/unavailable RPC data invalidates the whole audit; integrity failures remain visible per row.
      if (error instanceof AuditReadError) throw error;
      row.status = "MISMATCH";
      row.error = errorText(error);
    }
    rows.push(row);
  }
  const canonicalHead = await read("getBlock", () => provider.getBlock(snapshot!));
  if (canonicalHead?.hash !== headBlock.hash) throw new Error("Snapshot block changed during audit; rerun against a canonical snapshot");

  return {
    agentId: agentId.toString(), chainId: deployment.chainId, ledger: entry.address,
    deployBlock: deploy.blockNumber, snapshotBlock: snapshot, snapshotHash: headBlock.hash,
    auditedAt: new Date().toISOString(), rows,
    summary: {
      total: rows.length, revealed: reveals, unopened: commits - reveals,
      matches: rows.filter(row => row.status === "MATCH").length,
      mismatches: rows.filter(row => row.status === "MISMATCH").length,
      liveOrders: rows.filter(row => row.status === "MATCH" && row.dryRun === false && row.okxOrderId)
        .reduce((sum, row) => sum + Object.values(JSON.parse(row.okxOrderId!))
          .filter(value => value !== "simulated" && value !== "unknown").length, 0),
    },
  };
}

function cell(value: unknown): string {
  return String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\|/g, "\\|").replace(/`/g, "&#96;").replace(/[\r\n]/g, " ");
}

export function renderAuditTable(audit: LedgerAudit): string {
  const lines = [
    "| Cycle | Commit tx | Commit time (UTC) | Reveal tx | Reveal time (UTC) | Seconds | Mode | Hash | okxOrderId |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of audit.rows) lines.push(`| ${[
    row.cycleId, row.commitTx, row.commitTime, row.revealTx, row.revealTime, row.elapsedSeconds,
    row.dryRun === undefined ? "UNKNOWN (unopened/invalid)" : row.dryRun ? "dry_run (SIMULATED)" : "LIVE",
    row.status, row.okxOrderId === "" ? '""' : row.okxOrderId,
  ].map(cell).join(" | ")} |`);
  return lines.join("\n");
}

export function renderAuditMarkdown(audit: LedgerAudit): string {
  const { summary: s } = audit;
  return [
    "# GRAIL ledger audit", "",
    `Audited at: ${audit.auditedAt}. Agent #${audit.agentId}, chain ${audit.chainId}.`,
    `Ledger: ${audit.ledger}. Blocks: ${audit.deployBlock}–${audit.snapshotBlock} (inclusive).`,
    `Snapshot block hash: ${audit.snapshotHash}.`, "",
    `Total: ${s.total} | Revealed: ${s.revealed} | Unopened: ${s.unopened} | MATCH: ${s.matches} | Mismatch: ${s.mismatches} | LIVE order IDs: ${s.liveOrders}`, "",
    renderAuditTable(audit), "",
    "| Cycle | On-chain commitHash | keccak(payload‖salt) | Validation error |",
    "| --- | --- | --- | --- |",
    ...audit.rows.map(row => `| ${[row.cycleId, row.commitHash, row.computedHash, row.error ?? ""].map(cell).join(" | ")} |`), "",
    "Salt and payload are decoded from reveal transaction calldata; no local state or private key is used.",
    "Unopened commitments have no public payload/salt, mode or order result; their hash is not yet verifiable.",
    "LIVE order IDs count verified dry_run=false results excluding simulated/unknown; this is not proof of exchange execution or fills.",
    "No transaction or OKX request is sent. Completeness is checked against commitCount/revealCount at the fixed snapshot block.", "",
  ].join("\n");
}
