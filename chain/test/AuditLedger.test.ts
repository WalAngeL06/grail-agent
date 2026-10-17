import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract, Provider } from "ethers";
import { auditLedger, renderAuditMarkdown, renderAuditTable } from "../scripts/lib/audit-ledger";
import type { CycleDeployment } from "../scripts/lib/verify-cycle";

async function rejects(action: () => Promise<unknown>, fragment: string) {
  let failure: unknown;
  try { await action(); } catch (error) { failure = error; }
  expect(failure).to.be.instanceOf(Error);
  expect((failure as Error).message).to.contain(fragment);
}

describe("Full read-only ledger audit", function () {
  let ledger: Contract;
  let deployment: CycleDeployment;
  const provider = ethers.provider;
  const salt = "0x" + "ce".repeat(32);
  const noWait = { chunkSize: 25, pauseMs: 0, sleep: async (_ms: number) => {} };

  function override(method: string, action: (...args: any[]) => any): Provider {
    return new Proxy(provider, {
      get(target, prop) {
        if (["getSigner", "broadcastTransaction", "sendTransaction"].includes(String(prop))) {
          throw new Error("Audit must never request a signer or send transactions");
        }
        if (prop === method) return action;
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as Provider;
  }

  async function cycle(id: bigint, dryRun: boolean, results: string, reveal = true) {
    const payload = ethers.toUtf8Bytes(`{"agent":"GRAIL-01","cycle_id":${id},"decisions":[{"inst_id":"BTC-USDT","action":"BUY"},{"inst_id":"ETH-USDT","action":"SELL"}],"dry_run":${dryRun}}`);
    const hash = ethers.keccak256(ethers.concat([payload, salt]));
    const before = (await provider.getBlock("latest"))!.timestamp;
    await provider.send("evm_setNextBlockTimestamp", [before + 10]);
    const commit = await ledger.commitDecision(1, id, hash);
    await commit.wait();
    if (!reveal) return { commit, hash, reveal: undefined };
    await provider.send("evm_setNextBlockTimestamp", [before + 22]);
    const opened = await ledger.revealDecision(1, id, payload, salt, results);
    await opened.wait();
    return { commit, hash, reveal: opened };
  }

  beforeEach(async function () {
    const identity = await (await ethers.getContractFactory("IdentityRegistry")).deploy();
    await identity.waitForDeployment();
    await identity["register()"]();
    ledger = await (await ethers.getContractFactory("GrailLedger")).deploy(await identity.getAddress()) as unknown as Contract;
    await ledger.waitForDeployment();
    deployment = {
      chainId: 31337, agentId: "1", agentName: "GRAIL-01", agentWallet: (await ethers.getSigners())[0].address,
      contracts: { GrailLedger: {
        address: await ledger.getAddress(), deployTx: ledger.deploymentTransaction()!.hash,
        abi: JSON.parse(ledger.interface.formatJson()),
      } },
    };
  });

  it("audits every cycle, including a gap, uint256 IDs, LIVE orders and an unopened commitment", async function () {
    const first = await cycle(7n, true, '{"BTC-USDT":"simulated"}');
    await cycle(11n, false, '{"BTC-USDT":"123456789","ETH-USDT":"unknown"}');
    await cycle(12n, false, "", false);
    await cycle(9007199254740993n, false, "");
    const head = await provider.getBlockNumber();
    const readOnly = override("getLogs", filter => provider.getLogs(filter));
    const audit = await auditLedger(readOnly, deployment, noWait);
    expect(audit.rows.map(row => row.cycleId)).to.deep.equal(["7", "11", "12", "9007199254740993"]);
    expect(audit.summary).to.deep.equal({ total: 4, revealed: 3, unopened: 1, matches: 3, mismatches: 0, liveOrders: 1 });
    expect(audit.rows[0].commitTx).to.equal(first.commit.hash);
    expect(audit.rows[0].revealTx).to.equal(first.reveal!.hash);
    expect(audit.rows[0].commitHash).to.equal(first.hash);
    expect(audit.rows[0].computedHash).to.equal(first.hash);
    expect(audit.rows[0].elapsedSeconds).to.equal(12);
    expect(audit.rows[0].dryRun).to.equal(true);
    expect(audit.rows[1].dryRun).to.equal(false);
    expect(audit.rows[1].okxOrderId).to.equal('{"BTC-USDT":"123456789","ETH-USDT":"unknown"}');
    expect(audit.rows[2].status).to.equal("PENDING");
    expect(audit.rows[2].dryRun).to.equal(undefined);
    expect(audit.rows[2].elapsedSeconds).to.equal(undefined);
    expect(audit.snapshotBlock).to.equal(head);
    expect(await provider.getBlockNumber()).to.equal(head);
  });

  it("returns zero totals for an empty ledger", async function () {
    const audit = await auditLedger(provider, deployment, noWait);
    expect(audit.rows).to.deep.equal([]);
    expect(audit.summary).to.deep.equal({ total: 0, revealed: 0, unopened: 0, matches: 0, mismatches: 0, liveOrders: 0 });
  });

  it("works without historical eth_call and freshly reads both counters before and after verification", async function () {
    await cycle(7n, true, "");
    const selectors: string[] = [];
    const latestOnly = override("call", async tx => {
      if (tx.blockTag !== "latest") throw new Error("historical eth_call unavailable");
      selectors.push(tx.data.slice(0, 10));
      return provider.call(tx);
    });
    const audit = await auditLedger(latestOnly, deployment, noWait);
    expect(audit.summary.matches).to.equal(1);
    for (const name of ["commitCount", "revealCount"]) {
      expect(selectors.filter(selector => selector === ledger.interface.getFunction(name)!.selector)).to.have.length(2);
    }
    expect(selectors).to.include(ledger.interface.getFunction("decisions")!.selector);
  });

  it("rejects a ledger that gains a cycle during the scan instead of returning a complete summary", async function () {
    await cycle(7n, true, "");
    let appended = false;
    const moving = override("getLogs", async filter => {
      const logs = await provider.getLogs(filter);
      if (!appended) { appended = true; await cycle(8n, true, ""); }
      return logs;
    });
    await rejects(() => auditLedger(moving, deployment, noWait), "INCOMPLETE");
  });

  it("rejects a reveal arriving after the fixed log head even when the commit count is unchanged", async function () {
    await cycle(7n, true, "", false);
    let opened = false;
    const moving = override("getLogs", async filter => {
      const logs = await provider.getLogs(filter);
      if (!opened) {
        opened = true;
        const payload = ethers.toUtf8Bytes('{"agent":"GRAIL-01","cycle_id":7,"decisions":[{"inst_id":"BTC-USDT","action":"BUY"},{"inst_id":"ETH-USDT","action":"SELL"}],"dry_run":true}');
        await (await ledger.revealDecision(1, 7, payload, salt, "")).wait();
      }
      return logs;
    });
    await rejects(() => auditLedger(moving, deployment, noWait), "INCOMPLETE");
  });

  it("covers deployBlock through the fixed head without gaps or scanning other agents", async function () {
    await cycle(7n, true, "");
    await provider.send("hardhat_mine", ["0x69"]);
    const ranges: [number, number][] = [];
    const paged = override("getLogs", async filter => {
      expect(filter.toBlock - filter.fromBlock + 1).to.be.at.most(25);
      expect(filter.topics[1]).to.equal(ethers.zeroPadValue(ethers.toBeHex(1), 32));
      expect(filter.topics.length).to.equal(2);
      ranges.push([filter.fromBlock, filter.toBlock]);
      return provider.getLogs(filter);
    });
    const audit = await auditLedger(paged, deployment, noWait);
    expect(ranges[0][0]).to.equal(audit.deployBlock);
    expect(ranges.at(-1)![1]).to.equal(audit.snapshotBlock);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).to.equal(ranges[i - 1][1] + 1);
    expect(audit.summary.matches).to.equal(1);
  });

  it("retries 429 responses with bounded exponential backoff and fails after exhaustion", async function () {
    const sleeps: number[] = [];
    let calls = 0;
    const throttled = override("getLogs", async filter => {
      if (++calls <= 2) throw new Error("429 Too Many Requests");
      return provider.getLogs(filter);
    });
    const audit = await auditLedger(throttled, deployment, { ...noWait, sleep: async ms => { sleeps.push(ms); } });
    expect(audit.summary.total).to.equal(0);
    expect(sleeps).to.deep.equal([500, 1000]);
    let failedCalls = 0;
    const blocked = override("getLogs", async () => { failedCalls++; throw new Error("429 rate limit"); });
    await rejects(() => auditLedger(blocked, deployment, { ...noWait, maxRetries: 2 }), "RPC read failed");
    expect(failedCalls).to.equal(3);
  });

  it("rejects incomplete log responses by comparing snapshot counters", async function () {
    await cycle(7n, true, "");
    await rejects(() => auditLedger(override("getLogs", async () => []), deployment, noWait), "Incomplete ledger scan");
  });

  it("counts a wrong salt as mismatch and continues auditing other cycles", async function () {
    const bad = await cycle(7n, false, '{"BTC-USDT":"123"}');
    await cycle(8n, true, "");
    const altered = override("getTransaction", async hash => {
      const tx = await provider.getTransaction(hash);
      if (hash !== bad.reveal!.hash) return tx;
      const call = ledger.interface.parseTransaction({ data: tx!.data })!;
      return { ...tx!, data: ledger.interface.encodeFunctionData("revealDecision", [1, 7, call.args.payload, ethers.ZeroHash, call.args.okxOrderId]) };
    });
    const audit = await auditLedger(altered, deployment, noWait);
    expect(audit.rows.map(row => row.status)).to.deep.equal(["MISMATCH", "MATCH"]);
    expect(audit.summary.mismatches).to.equal(1);
    expect(audit.summary.liveOrders).to.equal(0);
  });

  it("does not convert missing RPC data into a successful audit or a cryptographic mismatch", async function () {
    await cycle(7n, true, "");
    const unavailable = override("getTransaction", async () => { throw new Error("connection lost"); });
    await rejects(() => auditLedger(unavailable, deployment, noWait), "RPC read failed");
  });

  it("rejects a changed snapshot block instead of mixing chain histories", async function () {
    let headReads = 0;
    const head = await provider.getBlockNumber();
    const reorg = override("getBlock", async block => {
      const original = await provider.getBlock(block);
      if (block === head && ++headReads > 1) return { ...original!, hash: ethers.ZeroHash };
      return original;
    });
    await rejects(() => auditLedger(reorg, deployment, noWait), "Snapshot block changed");
  });

  it("fails on a wrong network before reading any ledger logs", async function () {
    const wrong = { ...deployment, chainId: 43113 };
    await rejects(() => auditLedger(override("getLogs", () => { throw new Error("must not scan"); }), wrong, noWait), "network");
  });

  it("renders times, tx links, hashes, labels and the exact order-results string", async function () {
    await cycle(7n, false, '{"BTC-USDT":"123"}');
    const audit = await auditLedger(provider, deployment, noWait);
    const markdown = renderAuditMarkdown(audit);
    expect(markdown).to.contain("LIVE").and.contain("MATCH").and.contain("12");
    expect(markdown).to.contain(audit.rows[0].commitTx!).and.contain(audit.rows[0].revealTx!);
    expect(markdown).to.contain(audit.rows[0].commitHash!).and.contain(audit.rows[0].computedHash!);
    expect(markdown).to.contain('{"BTC-USDT":"123"}');
    expect(markdown).to.contain("not proof of exchange execution");
    expect(markdown).to.contain("okxOrderId is revealed alongside the payload but is not part of the committed hash; it is not proof of exchange execution");
    expect(markdown).to.contain("latest").and.contain("before").and.contain("after");
    expect(renderAuditTable(audit)).to.contain("LIVE").and.contain("123").and.contain(audit.rows[0].commitTx!);
  });
});
