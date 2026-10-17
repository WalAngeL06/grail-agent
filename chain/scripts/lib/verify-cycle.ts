import { Contract, Interface, concat, keccak256, toBeHex, toUtf8String, zeroPadValue } from "ethers";
import type { InterfaceAbi, Provider, Log } from "ethers";

export type CycleDeployment = {
  chainId: number;
  agentId: string;
  agentName: string;
  agentWallet: string;
  contracts: { GrailLedger: { address: string; deployTx: string; abi: InterfaceAbi } };
};
export type CycleResult = {
  status: "MATCH" | "MISMATCH" | "PENDING" | "NOT_FOUND";
  agentId: string;
  cycleId: string;
  commitTx?: string;
  revealTx?: string;
  commitHash?: string;
  computedHash?: string;
  payloadHex?: string;
  saltHex?: string;
  dryRun?: boolean;
};
export type CycleHints = { commitTx?: string; revealTx?: string };

export function parseCycle(value: string | undefined): bigint {
  if (value === undefined || !/^\d+$/.test(value) || BigInt(value) >= 2n ** 256n) {
    throw new Error("cycle must be a decimal uint256; usage: --cycle N");
  }
  return BigInt(value);
}

/** Reads only public RPC data. The salt always comes from reveal transaction calldata. */
export async function verifyCycle(provider: Provider, deployment: CycleDeployment, cycleId: bigint, hints: CycleHints = {}): Promise<CycleResult> {
  hints = { commitTx: hints.commitTx?.toLowerCase(), revealTx: hints.revealTx?.toLowerCase() };
  parseCycle(cycleId.toString());
  const agentId = parseCycle(deployment.agentId);
  if ((await provider.getNetwork()).chainId !== BigInt(deployment.chainId)) throw new Error("Unexpected RPC network");
  const entry = deployment.contracts.GrailLedger;
  const iface = new Interface(entry.abi);
  const ledger = new Contract(entry.address, entry.abi, provider);
  const deploy = await provider.getTransactionReceipt(entry.deployTx);
  if (!deploy || deploy.status !== 1 || deploy.contractAddress?.toLowerCase() !== entry.address.toLowerCase()) {
    throw new Error("Ledger deployment receipt/address not confirmed");
  }
  const head = await provider.getBlockNumber();
  if (head < deploy.blockNumber) throw new Error("RPC head is before ledger deployment");
  const events: Log[] = [];
  if (hints.commitTx || hints.revealTx) {
    if (!hints.commitTx || [hints.commitTx, hints.revealTx].some(hash => hash && !/^0x[0-9a-fA-F]{64}$/.test(hash))) {
      throw new Error("Valid --commit-tx is required when supplying transaction identities");
    }
    for (const hash of [hints.commitTx, hints.revealTx]) {
      if (!hash) continue;
      const receipt = await provider.getTransactionReceipt(hash);
      if (!receipt || receipt.status !== 1) throw new Error("Supplied transaction receipt is missing or failed");
      events.push(...receipt.logs.filter(log => log.address.toLowerCase() === entry.address.toLowerCase()
        && [iface.getEvent("DecisionCommitted")!.topicHash, iface.getEvent("DecisionRevealed")!.topicHash].includes(log.topics[0])));
    }
  } else {
  // Public Fuji RPCs cap log ranges; scan from the actual deployment, in bounded chunks.
  for (let toBlock = head; toBlock >= deploy.blockNumber; toBlock -= 100) {
    const filter = {
      address: entry.address, fromBlock: Math.max(deploy.blockNumber, toBlock - 99), toBlock,
      topics: [
        [iface.getEvent("DecisionCommitted")!.topicHash, iface.getEvent("DecisionRevealed")!.topicHash],
        zeroPadValue(toBeHex(agentId), 32), zeroPadValue(toBeHex(cycleId), 32),
      ],
    };
    // Retry rate-limited reads once, never transaction submission.
    try { events.push(...await provider.getLogs(filter)); }
    catch (error) {
      const message = (error as Error).message;
      if (!/429|too many requests|rate.?limit/i.test(message)) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500));
      events.push(...await provider.getLogs(filter));
    }
    // Ledger storage enforces one commit/reveal per pair, so older blocks cannot
    // contain another valid pair after both have been located.
    if (events.some(log => log.topics[0] === iface.getEvent("DecisionCommitted")!.topicHash)
      && events.some(log => log.topics[0] === iface.getEvent("DecisionRevealed")!.topicHash)) break;
    if (toBlock - 100 >= deploy.blockNumber) await new Promise(resolve => setTimeout(resolve, 500));
  }
  }

  async function confirmedTransaction(hash: string, log: Log) {
    const tx = await provider.getTransaction(hash);
    if (!tx || tx.to?.toLowerCase() !== entry.address.toLowerCase()) throw new Error("Transaction target mismatch");
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt || receipt.status !== 1 || receipt.hash !== hash || receipt.blockHash !== log.blockHash
      || receipt.to?.toLowerCase() !== entry.address.toLowerCase()
      || receipt.from.toLowerCase() !== deployment.agentWallet.toLowerCase()
      || tx.from.toLowerCase() !== receipt.from.toLowerCase() || receipt.blockNumber > head
      || receipt.blockNumber !== log.blockNumber || tx.blockNumber !== receipt.blockNumber) {
      throw new Error("Transaction receipt status/from/to/block mismatch");
    }
    const block = await provider.getBlock(receipt.blockNumber);
    if (!block || block.hash !== receipt.blockHash || tx.blockHash !== block.hash) {
      throw new Error("Transaction receipt is not in the canonical block");
    }
    if (!receipt.logs.some(item => item.index === log.index && item.data === log.data
      && item.topics.join() === log.topics.join())) throw new Error("Event missing from receipt");
    return tx;
  }
  const parsed = events.map(log => {
    const event = iface.parseLog(log);
    if (!event || log.removed || log.address.toLowerCase() !== entry.address.toLowerCase()
      || event.args.agentId !== agentId || event.args.cycleId !== cycleId) throw new Error("Unexpected ledger event");
    return { log, event };
  });
  const commits = parsed.filter(({ event }) => event.name === "DecisionCommitted");
  const reveals = parsed.filter(({ event }) => event.name === "DecisionRevealed");
  const stored = await ledger.decisions(agentId, cycleId, { blockTag: head });
  const base = { agentId: agentId.toString(), cycleId: cycleId.toString() };
  if (commits.length === 0) {
    if (stored.committed || reveals.length) throw new Error("Commit event missing from RPC results");
    return { ...base, status: "NOT_FOUND" };
  }
  if (commits.length !== 1 || reveals.length > 1) throw new Error("Duplicate ledger events");
  const commit = commits[0];
  if (hints.commitTx && commit.log.transactionHash !== hints.commitTx) throw new Error("Commit transaction identity mismatch");
  const commitTx = await confirmedTransaction(commit.log.transactionHash, commit.log);
  const commitCall = iface.parseTransaction({ data: commitTx.data });
  if (!commitCall || commitCall.name !== "commitDecision" || commitCall.args.agentId !== agentId
    || commitCall.args.cycleId !== cycleId || commitCall.args.commitHash !== stored.commitHash) {
    throw new Error("Commit calldata identity/hash mismatch");
  }
  const committed = { ...base, commitHash: stored.commitHash as string, commitTx: commit.log.transactionHash };
  if (!stored.committed || stored.commitHash !== commit.event.args.commitHash
    || stored.committedAt !== commit.event.args.timestamp) throw new Error("Commit event/storage mismatch");
  if (reveals.length === 0) {
    if (stored.revealed) throw new Error("Reveal event missing from RPC results");
    return { ...committed, status: "PENDING" };
  }
  const reveal = reveals[0];
  if (hints.revealTx && reveal.log.transactionHash !== hints.revealTx) throw new Error("Reveal transaction identity mismatch");
  if (!stored.revealed || commit.log.blockNumber > reveal.log.blockNumber
    || (commit.log.blockNumber === reveal.log.blockNumber && commit.log.index >= reveal.log.index)) {
    throw new Error("Invalid commit/reveal order or storage state");
  }
  const tx = await confirmedTransaction(reveal.log.transactionHash, reveal.log);
  const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
  if (!decoded || decoded.name !== "revealDecision" || decoded.args.agentId !== agentId || decoded.args.cycleId !== cycleId) {
    throw new Error("Reveal calldata function/agent/cycle mismatch");
  }
  const payloadHex = decoded.args.payload as string;
  const saltHex = decoded.args.salt as string;
  const computedHash = keccak256(concat([payloadHex, saltHex]));
  const matches = computedHash === stored.commitHash && payloadHex === reveal.event.args.payload
    && decoded.args.okxOrderId === reveal.event.args.okxOrderId;
  let dryRun: boolean | undefined;
  if (matches) {
    let payload: any;
    try {
      payload = JSON.parse(toUtf8String(payloadHex), (key, value, context?: { source: string }) => {
        if (key === "cycle_id" && typeof value === "number" && !Number.isSafeInteger(value)) {
          if (!context || !/^\d+$/.test(context.source)) throw new Error("Invalid cycle_id");
          return BigInt(context.source);
        }
        return value;
      });
    } catch { throw new Error("Invalid JSON payload"); }
    if (!payload || payload.agent !== deployment.agentName || String(payload.cycle_id) !== cycleId.toString()
      || !["number", "bigint"].includes(typeof payload.cycle_id) || typeof payload.dry_run !== "boolean"
      || !Array.isArray(payload.decisions)) throw new Error("Committed payload agent/cycle/dry_run mismatch");
    dryRun = payload.dry_run;
    const raw = decoded.args.okxOrderId as string;
    if (raw !== "") {
      let orders: Record<string, unknown>;
      try { orders = JSON.parse(raw); } catch { throw new Error("Invalid order results JSON"); }
      if (!orders || Array.isArray(orders) || typeof orders !== "object" || !Object.keys(orders).length) {
        throw new Error("Empty order results must use an empty string");
      }
      const canonical = JSON.stringify(Object.fromEntries(Object.entries(orders).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))
        .replace(/[\u007f-\uffff]/g, char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
      if (raw !== canonical) throw new Error("Noncanonical order results JSON");
      for (const [inst, value] of Object.entries(orders)) {
        if (typeof value !== "string" || value.length === 0 || !payload.decisions.some((decision: any) =>
          decision.inst_id === inst && ["BUY", "SELL"].includes(decision.action))) throw new Error("Invalid order results instrument/value");
        if (dryRun && !["simulated", "unknown"].includes(value)) throw new Error("dry_run order results must be simulated or unknown");
      }
    }
  }
  return {
    ...committed, status: matches ? "MATCH" : "MISMATCH", computedHash, payloadHex, saltHex, dryRun,
    revealTx: reveal.log.transactionHash,
  };
}
