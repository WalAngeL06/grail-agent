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
  stateReadMode: "latest";
  maxCycle?: string;
  counterCheck: { beforeCommits: string; beforeReveals: string; afterCommits: string; afterReveals: string };
  auditedAt: string;
  rows: AuditRow[];
  summary: { total: number; revealed: number; unopened: number; matches: number; mismatches: number; liveOrders: number };
};
type AuditOptions = {
  chunkSize?: number;
  pauseMs?: number;
  maxRetries?: number;
  maxCycle?: bigint;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (from: number, to: number, head: number) => void;
};

class AuditReadError extends Error {}
const errorText = (error: unknown) => (error as any)?.shortMessage || (error as Error)?.message || "Unknown RPC failure";

/** Audit a fixed starting cohort; later append-only cycles are explicitly excluded. */
export async function auditLedger(provider: Provider, deployment: CycleDeployment, options: AuditOptions = {}): Promise<LedgerAudit> {
  const chunkSize = options.chunkSize ?? 1000;
  const pauseMs = options.pauseMs ?? 150;
  const maxRetries = options.maxRetries ?? 4;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 1000
    || !Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 8
    || !Number.isFinite(pauseMs) || pauseMs < 0
    || (options.maxCycle !== undefined && (typeof options.maxCycle !== "bigint"
      || options.maxCycle < 0n || options.maxCycle >= 2n ** 256n))) throw new Error("Invalid audit scan options");

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

  const entry = deployment.contracts.GrailLedger;
  const iface = new Interface(entry.abi);
  const decisionSelector = iface.getFunction("decisions")!.selector;
  const decisionReads = new Map<string, { args: unknown[]; value: string }>();
  // Immutable transaction/block reads may be cached. Latest state calls must
  // reach the RPC again, including the final counter and selected-record checks.
  let snapshot: number | undefined;
  const cache = new Map<string, Promise<unknown>>();
  const cachedMethods = new Set(["getNetwork", "getBlockNumber", "getBlock", "getTransactionReceipt", "getTransaction"]);
  const reader = new Proxy(provider, {
    get(target, prop) {
      if (prop === "getBlockNumber" && snapshot !== undefined) return async () => snapshot!;
      if (prop === "call") return async (...args: unknown[]) => {
        const value: string = await read("call", () => (target.call as any)(...args));
        const data = (args[0] as { data?: string }).data;
        if (data?.startsWith(decisionSelector) && !decisionReads.has(data)) decisionReads.set(data, { args, value });
        return value;
      };
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
  const ledger = new Contract(entry.address, entry.abi, reader);
  const deploy = await reader.getTransactionReceipt(entry.deployTx);
  if (!deploy || deploy.status !== 1 || deploy.contractAddress?.toLowerCase() !== entry.address.toLowerCase()) {
    throw new Error("Ledger deployment receipt/address not confirmed");
  }
  // Bracket the starting head with fresh latest counters. This closes the race
  // between selecting N and reading its log boundary without historical eth_call.
  let expectedCommits: bigint = await ledger.commitCount(agentId, { blockTag: "latest" });
  let expectedReveals: bigint = await ledger.revealCount(agentId, { blockTag: "latest" });
  for (let attempt = 0; ; attempt++) {
    snapshot = await read("getBlockNumber", () => provider.getBlockNumber());
    if (snapshot < deploy.blockNumber) throw new Error("RPC head is before ledger deployment");
    const commits: bigint = await ledger.commitCount(agentId, { blockTag: "latest" });
    const reveals: bigint = await ledger.revealCount(agentId, { blockTag: "latest" });
    if (commits < expectedCommits || reveals < expectedReveals) throw new Error("INCOMPLETE: ledger counter decreased while selecting the starting cohort");
    if (commits === expectedCommits && reveals === expectedReveals) {
      if (reveals > commits) throw new Error("INCOMPLETE: invalid ledger counters (reveals exceed commits)");
      break;
    }
    if (attempt >= 2) throw new Error("INCOMPLETE: unable to select a consistent starting cohort; retry");
    expectedCommits = commits;
    expectedReveals = reveals;
  }
  const headBlock = await reader.getBlock(snapshot);
  if (!headBlock?.hash) throw new Error("Snapshot block missing");
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
    throw new Error(`INCOMPLETE: Incomplete ledger scan: events ${commits}/${reveals}, latest counters ${expectedCommits}/${expectedReveals}; missing/duplicate events or ledger changed; retry`);
  }

  const rows: AuditRow[] = [];
  const selectedIds = [...groups.keys()].filter(id => options.maxCycle === undefined || BigInt(id) <= options.maxCycle)
    .sort((a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
  for (const id of selectedIds) {
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
      const result = await verifyCycle(reader, deployment, BigInt(id), {
        commitTx: commit.transactionHash, revealTx: reveal?.transactionHash, stateBlockTag: "latest",
      });
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
  // A larger ledger is safe, but a changed record inside the selected cohort is
  // not. Re-read each selected decisions() result without the reader's cache.
  for (const [data, first] of decisionReads) {
    const latest = await read("call", () => (provider.call as any)(...first.args));
    if (latest !== first.value) {
      const cycle = iface.decodeFunctionData("decisions", data)[1];
      throw new Error(`INCOMPLETE: Selected cycle ${cycle} changed during audit; retry`);
    }
  }
  const canonicalHead = await read("getBlock", () => provider.getBlock(snapshot!));
  if (canonicalHead?.hash !== headBlock.hash) throw new Error("Snapshot block changed during audit; rerun against a canonical snapshot");
  // Read reveals first: a concurrent commit+reveal between these calls cannot
  // make the sampled reveal count exceed the subsequently sampled commit count.
  const afterReveals: bigint = await ledger.revealCount(agentId, { blockTag: "latest" });
  const afterCommits: bigint = await ledger.commitCount(agentId, { blockTag: "latest" });
  if (afterCommits < expectedCommits || afterReveals < expectedReveals) {
    throw new Error(`INCOMPLETE: ledger counter decreased; before ${expectedCommits}/${expectedReveals}, after ${afterCommits}/${afterReveals}`);
  }
  if (afterReveals > afterCommits) throw new Error("INCOMPLETE: invalid ledger counters (reveals exceed commits)");
  const selectedReveals = rows.filter(row => row.revealTx !== undefined).length;

  return {
    agentId: agentId.toString(), chainId: deployment.chainId, ledger: entry.address,
    deployBlock: deploy.blockNumber, snapshotBlock: snapshot, snapshotHash: headBlock.hash,
    stateReadMode: "latest",
    maxCycle: options.maxCycle?.toString(),
    counterCheck: {
      beforeCommits: expectedCommits.toString(), beforeReveals: expectedReveals.toString(),
      afterCommits: afterCommits.toString(), afterReveals: afterReveals.toString(),
    },
    auditedAt: new Date().toISOString(), rows,
    summary: {
      total: rows.length, revealed: selectedReveals, unopened: rows.length - selectedReveals,
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
    "| Cycle | Commit tx | Commit time (UTC) | Reveal tx | Reveal time (UTC) | Seconds | Mode | Hash | okxOrderId (not hashed) |",
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
    `Scan head block hash: ${audit.snapshotHash}.`,
    `State reads: ${audit.stateReadMode}; fresh counters before ${audit.counterCheck.beforeCommits}/${audit.counterCheck.beforeReveals}, after ${audit.counterCheck.afterCommits}/${audit.counterCheck.afterReveals} (commits/reveals).`, "",
    `Scope: starting ledger ${audit.counterCheck.beforeCommits} cycles${audit.maxCycle === undefined ? "; all starting cycles" : `; max-cycle ${audit.maxCycle} (inclusive)`}. Audited ${s.total} cycles; excluded cycles are not verified.`,
    ...(BigInt(audit.counterCheck.afterCommits) > BigInt(audit.counterCheck.beforeCommits)
      ? [`Audited ${s.total} cycles; ledger grew to ${audit.counterCheck.afterCommits} during the scan (new cycles not included)`] : []), "",
    `Total: ${s.total} | Revealed: ${s.revealed} | Unopened: ${s.unopened} | MATCH: ${s.matches} | Mismatch: ${s.mismatches} | LIVE order IDs: ${s.liveOrders}`, "",
    renderAuditTable(audit), "",
    "| Cycle | On-chain commitHash | keccak(payload‖salt) | Validation error |",
    "| --- | --- | --- | --- |",
    ...audit.rows.map(row => `| ${[row.cycleId, row.commitHash, row.computedHash, row.error ?? ""].map(cell).join(" | ")} |`), "",
    "Salt and payload are decoded from reveal transaction calldata; no local state or private key is used.",
    "Unopened commitments have no public payload/salt, mode or order result; their hash is not yet verifiable.",
    "LIVE order IDs count verified dry_run=false results excluding simulated/unknown; this is not proof of exchange execution or fills.",
    "okxOrderId is revealed alongside the payload but is not part of the committed hash; it is not proof of exchange execution.",
    "No transaction or OKX request is sent. Starting event counts must match the starting counters. Later cycles are excluded; growth is allowed. Counter decreases, selected-record changes, missing/duplicate events or RPC failures invalidate the audit.", "",
  ].join("\n");
}
