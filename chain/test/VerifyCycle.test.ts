import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract, Provider } from "ethers";
import { verifyCycle, parseCycle } from "../scripts/lib/verify-cycle";

describe("Read-only cycle verification", function () {
  let ledger: Contract;
  let deployment: { chainId: number; agentId: string; contracts: { GrailLedger: { address: string; deployTx: string; abi: any[] } } };
  const payload = ethers.toUtf8Bytes('{"cycle_id":7,"decisions":[],"dry_run":true}');
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
      chainId: 31337, agentId: "1",
      contracts: { GrailLedger: {
        address: await ledger.getAddress(), deployTx: ledger.deploymentTransaction()!.hash,
        abi: JSON.parse(ledger.interface.formatJson()),
      } },
    };
  });

  it("reads the salt from reveal calldata and returns MATCH without requesting a signer or sending a transaction", async function () {
    await ledger.commitDecision(1, 7, hash);
    const reveal = await ledger.revealDecision(1, 7, payload, salt, '{"BTC-USDT":"simulated"}');
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
    try {
      await verifyCycle(provider, { ...deployment, chainId: 43113 }, 7n);
      expect.fail("Expected network mismatch");
    } catch (error) { expect((error as Error).message).to.contain("network"); }
  });

  it("rejects altered reveal calldata instead of printing MATCH", async function () {
    await ledger.commitDecision(1, 7, hash);
    await ledger.revealDecision(1, 7, payload, salt, "");
    const changed = ledger.interface.encodeFunctionData("revealDecision", [1, 7, payload, "0x" + "cd".repeat(32), ""]);
    const dishonest = new Proxy(provider, {
      get(target, prop) {
        if (prop === "getTransaction") return async (tx: string) => ({ ...(await target.getTransaction(tx))!, data: changed });
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
    try { await verifyCycle(dishonest, deployment, 7n); expect.fail("Expected wrong target rejection"); }
    catch (error) { expect((error as Error).message).to.contain("target"); }
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
});
