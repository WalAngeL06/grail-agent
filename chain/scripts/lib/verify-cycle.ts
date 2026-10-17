import { Contract, Interface, concat, keccak256, toBeHex, zeroPadValue } from "ethers";
import type { InterfaceAbi, Provider, Log } from "ethers";

export type CycleDeployment = {
  chainId: number;
  agentId: string;
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
};

export function parseCycle(value: string | undefined): bigint {
  if (value === undefined || !/^\d+$/.test(value) || BigInt(value) >= 2n ** 256n) {
    throw new Error("cycle must be a decimal uint256; usage: --cycle N");
  }
  return BigInt(value);
}

/** Reads only public RPC data. The salt always comes from reveal transaction calldata. */
export async function verifyCycle(provider: Provider, deployment: CycleDeployment, cycleId: bigint): Promise<CycleResult> {
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
  const committed = { ...base, commitHash: stored.commitHash as string, commitTx: commit.log.transactionHash };
  if (!stored.committed || stored.commitHash !== commit.event.args.commitHash) throw new Error("Commit event/storage mismatch");
  if (reveals.length === 0) {
    if (stored.revealed) throw new Error("Reveal event missing from RPC results");
    return { ...committed, status: "PENDING" };
  }
  const reveal = reveals[0];
  if (!stored.revealed || commit.log.blockNumber > reveal.log.blockNumber
    || (commit.log.blockNumber === reveal.log.blockNumber && commit.log.index >= reveal.log.index)) {
    throw new Error("Invalid commit/reveal order or storage state");
  }
  const [tx, receipt] = await Promise.all([
    provider.getTransaction(reveal.log.transactionHash), provider.getTransactionReceipt(reveal.log.transactionHash),
  ]);
  if (!tx || tx.to?.toLowerCase() !== entry.address.toLowerCase()) throw new Error("Reveal transaction target mismatch");
  if (!receipt || receipt.status !== 1 || receipt.blockHash !== reveal.log.blockHash
    || receipt.to?.toLowerCase() !== entry.address.toLowerCase()) throw new Error("Reveal receipt is not confirmed");
  const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
  if (!decoded || decoded.name !== "revealDecision" || decoded.args.agentId !== agentId || decoded.args.cycleId !== cycleId) {
    throw new Error("Reveal calldata function/agent/cycle mismatch");
  }
  const payloadHex = decoded.args.payload as string;
  const saltHex = decoded.args.salt as string;
  const computedHash = keccak256(concat([payloadHex, saltHex]));
  const matches = computedHash === stored.commitHash && payloadHex === reveal.event.args.payload
    && decoded.args.okxOrderId === reveal.event.args.okxOrderId;
  return {
    ...committed, status: matches ? "MATCH" : "MISMATCH", computedHash, payloadHex, saltHex,
    revealTx: reveal.log.transactionHash,
  };
}
