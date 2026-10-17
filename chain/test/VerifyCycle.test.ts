import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract, Provider } from "ethers";
import { verifyCycle, parseCycle } from "../scripts/lib/verify-cycle";

async function rejects(action: () => Promise<unknown>, fragment: string) {
  let failure: unknown;
  try { await action(); } catch (error) { failure = error; }
  expect(failure).to.be.instanceOf(Error);
  expect((failure as Error).message).to.contain(fragment);
}

describe("Read-only cycle verification", function () {
  let ledger: Contract;
  let deployment: { chainId: number; agentId: string; agentName: string; agentWallet: string; contracts: { GrailLedger: { address: string; deployTx: string; abi: any[] } } };
  const payload = ethers.toUtf8Bytes('{"agent":"GRAIL-01","cycle_id":7,"decisions":[],"dry_run":true}');
  const salt = "0x" + "ab".repeat(32);
  const hash = ethers.keccak256(ethers.concat([payload, salt]));
  const provider = ethers.provider;

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

  it("reads the salt from reveal calldata and returns MATCH without requesting a signer or sending a transaction", async function () {
    await ledger.commitDecision(1, 7, hash);
    const reveal = await ledger.revealDecision(1, 7, payload, salt, "");
    await reveal.wait();
    const head = await provider.getBlockNumber();
    const result = await verifyCycle(provider, deployment, 7n);
    expect(result.status).to.equal("MATCH");
    expect(result.saltHex).to.equal(salt);
    expect(result.commitHash).to.equal(hash);
    expect(result.computedHash).to.equal(hash);
    expect(result.payloadHex).to.equal(ethers.hexlify(payload));
    expect(result.revealTx).to.equal(reveal.hash);
    expect(await provider.getBlockNumber()).to.equal(head);
  });

  it("reports PENDING when a commitment has not been revealed", async function () {
    await ledger.commitDecision(1, 7, hash);
    const result = await verifyCycle(provider, deployment, 7n);
    expect(result.status).to.equal("PENDING");
    expect(result.saltHex).to.equal(undefined);
  });

  it("reports NOT_FOUND and ignores other agents and cycles", async function () {
    await ledger.commitDecision(1, 8, hash);
    expect((await verifyCycle(provider, deployment, 7n)).status).to.equal("NOT_FOUND");
  });

  it("rejects a mismatched network before reading logs", async function () {
    await rejects(() => verifyCycle(provider, { ...deployment, chainId: 43113 }, 7n), "network");
  });

  it("rejects altered reveal calldata instead of printing MATCH", async function () {
    await ledger.commitDecision(1, 7, hash);
    const reveal = await ledger.revealDecision(1, 7, payload, salt, "");
    const changed = ledger.interface.encodeFunctionData("revealDecision", [1, 7, payload, "0x" + "cd".repeat(32), ""]);
    const dishonest = new Proxy(provider, {
      get(target, prop) {
        if (prop === "getTransaction") return async (tx: string) => {
          const original = await target.getTransaction(tx);
          return tx === reveal.hash ? { ...original!, data: changed } : original;
        };
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as Provider;
    expect((await verifyCycle(dishonest, deployment, 7n)).status).to.equal("MISMATCH");
  });

  it("rejects a reveal transaction directed at another contract", async function () {
    await ledger.commitDecision(1, 7, hash);
    await ledger.revealDecision(1, 7, payload, salt, "");
    const dishonest = new Proxy(provider, {
      get(target, prop) {
        if (prop === "getTransaction") return async (tx: string) => ({ ...(await target.getTransaction(tx))!, to: ethers.ZeroAddress });
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as Provider;
    await rejects(() => verifyCycle(dishonest, deployment, 7n), "target");
  });

  it("parses cycle IDs as uint256 decimal strings without rounding", function () {
    expect(parseCycle("9007199254740993")).to.equal(9007199254740993n);
    for (const invalid of ["-1", "1.5", "1e3", "", "abc", (2n ** 256n).toString()]) {
      expect(() => parseCycle(invalid)).to.throw("cycle");
    }
  });

  it("scans in windows of at most 100 blocks on Fuji public RPCs", async function () {
    await ledger.commitDecision(1, 7, hash);
    await ledger.revealDecision(1, 7, payload, salt, "");
    await provider.send("hardhat_mine", ["0xc9"]);
    let queries = 0;
    const limited = new Proxy(provider, {
      get(target, prop) {
        if (prop === "getLogs") return async (filter: any) => {
          expect(filter.toBlock - filter.fromBlock + 1).to.be.at.most(100);
          ++queries;
          return target.getLogs(filter);
        };
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as Provider;
    expect((await verifyCycle(limited, deployment, 7n)).status).to.equal("MATCH");
    expect(queries).to.be.at.least(3);
  });

  it("verifies supplied tx identities without any eth_getLogs request", async function () {
    const commit = await ledger.commitDecision(1, 7, hash);
    const reveal = await ledger.revealDecision(1, 7, payload, salt, "");
    const direct = new Proxy(provider, {
      get(target, prop) {
        if (prop === "getLogs") return () => { throw new Error("Log scanning is unavailable"); };
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as Provider;
    const result = await verifyCycle(direct, deployment, 7n, { commitTx: commit.hash, revealTx: reveal.hash });
    expect(result.status).to.equal("MATCH");
    expect(result.dryRun).to.equal(true);
  });

  it("rejects payload agent/cycle mismatches even when their hash is valid", async function () {
    for (const object of [{ agent: "OTHER", cycle_id: 7 }, { agent: "GRAIL-01", cycle_id: 8 }]) {
      const badPayload = ethers.toUtf8Bytes(JSON.stringify({ ...object, decisions: [], dry_run: true }));
      const badHash = ethers.keccak256(ethers.concat([badPayload, salt]));
      const cycle = object.agent === "OTHER" ? 7n : 8n;
      // Each on-chain cycle has a deliberately different payload identity.
      const callCycle = cycle === 8n ? 9n : cycle;
      await ledger.commitDecision(1, callCycle, badHash);
      await ledger.revealDecision(1, callCycle, badPayload, salt, "");
      await rejects(() => verifyCycle(provider, deployment, callCycle), "payload");
    }
  });

  it("rejects noncanonical order mappings and accepts simulated BUY results", async function () {
    const buyPayload = ethers.toUtf8Bytes(JSON.stringify({
      agent: "GRAIL-01", cycle_id: 7, dry_run: true, decisions: [{ inst_id: "BTC-USDT", action: "BUY" }],
    }));
    const buyHash = ethers.keccak256(ethers.concat([buyPayload, salt]));
    await ledger.commitDecision(1, 7, buyHash);
    await ledger.revealDecision(1, 7, buyPayload, salt, '{"BTC-USDT":"simulated"}');
    expect((await verifyCycle(provider, deployment, 7n)).status).to.equal("MATCH");
    const spaced = ethers.toUtf8Bytes(JSON.stringify({
      agent: "GRAIL-01", cycle_id: 8, dry_run: true, decisions: [{ inst_id: "BTC-USDT", action: "BUY" }],
    }));
    await ledger.commitDecision(1, 8, ethers.keccak256(ethers.concat([spaced, salt])));
    await ledger.revealDecision(1, 8, spaced, salt, '{ "BTC-USDT": "simulated" }');
    await rejects(() => verifyCycle(provider, deployment, 8n), "order");
  });

  it("rejects failed, wrong-sender and noncanonical receipts", async function () {
    const commit = await ledger.commitDecision(1, 7, hash);
    const reveal = await ledger.revealDecision(1, 7, payload, salt, "");
    for (const changed of [{ status: 0 }, { from: ethers.ZeroAddress }, { blockHash: ethers.ZeroHash }]) {
      const dishonest = new Proxy(provider, {
        get(target, prop) {
          if (prop === "getTransactionReceipt") return async (tx: string) => {
            const receipt = await target.getTransactionReceipt(tx);
            return tx === reveal.hash ? { ...receipt!, logs: receipt!.logs, ...changed } : receipt;
          };
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as Provider;
      await rejects(() => verifyCycle(dishonest, deployment, 7n, { commitTx: commit.hash, revealTx: reveal.hash }), "receipt");
    }
  });

  it("matches payload cycle IDs above JavaScript's safe integer limit without rounding", async function () {
    const cycle = 9007199254740993n;
    const bytes = ethers.toUtf8Bytes('{"agent":"GRAIL-01","cycle_id":9007199254740993,"decisions":[],"dry_run":true}');
    await ledger.commitDecision(1, cycle, ethers.keccak256(ethers.concat([bytes, salt])));
    await ledger.revealDecision(1, cycle, bytes, salt, "");
    expect((await verifyCycle(provider, deployment, cycle)).status).to.equal("MATCH");
  });
});
