import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract, Signer } from "ethers";

describe("GrailLedger", function () {
  let registry: Contract, ledger: Contract;
  let owner: Signer, operator: Signer, stranger: Signer;
  const agentId = 1n, cycleId = 12n;
  const payload = ethers.toUtf8Bytes('{"action":"HOLD","cycle_id":12,"dry_run":true}');
  const salt = "0x" + "11".repeat(32);
  const hash = ethers.keccak256(ethers.concat([payload, salt]));
  const as = (contract: Contract, signer: Signer): Contract => contract.connect(signer) as Contract;

  beforeEach(async function () {
    [owner, operator, stranger] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory("IdentityRegistry")).deploy() as unknown as Contract;
    await registry.waitForDeployment();
    await (await registry["register(string)"]("data:application/json,{}")).wait();
    ledger = await (await ethers.getContractFactory("GrailLedger")).deploy(await registry.getAddress()) as unknown as Contract;
    await ledger.waitForDeployment();
  });

  it("reveals an exact preimage, emits audit events, and tracks open commitments", async function () {
    const tx = await ledger.commitDecision(agentId, cycleId, hash);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    await expect(tx).to.emit(ledger, "DecisionCommitted").withArgs(agentId, cycleId, hash, block!.timestamp);
    expect(await ledger.commitCount(agentId)).to.equal(1);
    expect(await ledger.revealCount(agentId)).to.equal(0);
    await expect(ledger.revealDecision(agentId, cycleId, payload, salt, "dry-run-12"))
      .to.emit(ledger, "DecisionRevealed").withArgs(agentId, cycleId, ethers.hexlify(payload), "dry-run-12");
    expect(await ledger.revealCount(agentId)).to.equal(1);
    const decision = await ledger.decisions(agentId, cycleId);
    expect(decision.commitHash).to.equal(hash);
    expect(decision.revealed).to.equal(true);
  });

  it("rejects wrong salt or changed payload without consuming the commitment", async function () {
    await ledger.commitDecision(agentId, cycleId, hash);
    await expect(ledger.revealDecision(agentId, cycleId, payload, "0x" + "22".repeat(32), ""))
      .to.be.revertedWithCustomError(ledger, "HashMismatch");
    await expect(ledger.revealDecision(agentId, cycleId, ethers.toUtf8Bytes("changed"), salt, ""))
      .to.be.revertedWithCustomError(ledger, "HashMismatch");
    expect(await ledger.revealCount(agentId)).to.equal(0);
    await ledger.revealDecision(agentId, cycleId, payload, salt, "");
  });

  it("rejects a second commit before and after reveal", async function () {
    await ledger.commitDecision(agentId, cycleId, hash);
    await expect(ledger.commitDecision(agentId, cycleId, hash)).to.be.revertedWithCustomError(ledger, "AlreadyCommitted");
    await ledger.revealDecision(agentId, cycleId, payload, salt, "");
    await expect(ledger.commitDecision(agentId, cycleId, hash)).to.be.revertedWithCustomError(ledger, "AlreadyCommitted");
    expect(await ledger.commitCount(agentId)).to.equal(1);
  });

  it("rejects reveal without commit and duplicate reveal", async function () {
    await expect(ledger.revealDecision(agentId, cycleId, payload, salt, "")).to.be.revertedWithCustomError(ledger, "NotCommitted");
    await ledger.commitDecision(agentId, cycleId, hash);
    await ledger.revealDecision(agentId, cycleId, payload, salt, "first");
    await expect(ledger.revealDecision(agentId, cycleId, payload, salt, "changed-result"))
      .to.be.revertedWithCustomError(ledger, "AlreadyRevealed");
    expect(await ledger.revealCount(agentId)).to.equal(1);
  });

  it("rejects an unregistered agent and unauthorized callers on both writes", async function () {
    await expect(ledger.commitDecision(999, cycleId, hash)).to.be.reverted;
    await expect(ledger.revealDecision(999, cycleId, payload, salt, "")).to.be.reverted;
    await expect(as(ledger, stranger).commitDecision(agentId, cycleId, hash))
      .to.be.revertedWithCustomError(ledger, "Unauthorized");
    await ledger.commitDecision(agentId, cycleId, hash);
    await expect(as(ledger, stranger).revealDecision(agentId, cycleId, payload, salt, ""))
      .to.be.revertedWithCustomError(ledger, "Unauthorized");
  });

  it("allows NFT approved operators and immediately enforces approval revocation", async function () {
    await registry.setApprovalForAll(await operator.getAddress(), true);
    await as(ledger, operator).commitDecision(agentId, cycleId, hash);
    await registry.setApprovalForAll(await operator.getAddress(), false);
    await expect(as(ledger, operator).revealDecision(agentId, cycleId, payload, salt, ""))
      .to.be.revertedWithCustomError(ledger, "Unauthorized");
    await registry.approve(await operator.getAddress(), agentId);
    await as(ledger, operator).revealDecision(agentId, cycleId, payload, salt, "");
  });

  it("isolates cycles and agents, including the zero hash sentinel case", async function () {
    await ledger.commitDecision(agentId, 0, ethers.ZeroHash);
    await expect(ledger.commitDecision(agentId, 0, hash)).to.be.revertedWithCustomError(ledger, "AlreadyCommitted");
    await ledger.commitDecision(agentId, cycleId, hash);
    await registry["register()"]();
    await ledger.commitDecision(2, cycleId, hash);
    expect(await ledger.commitCount(agentId)).to.equal(2);
    expect(await ledger.commitCount(2)).to.equal(1);
  });

  it("tracks current NFT ownership while preserving the committed history", async function () {
    await ledger.commitDecision(agentId, cycleId, hash);
    await registry.transferFrom(await owner.getAddress(), await stranger.getAddress(), agentId);
    await expect(ledger.revealDecision(agentId, cycleId, payload, salt, "")).to.be.revertedWithCustomError(ledger, "Unauthorized");
    await as(ledger, stranger).revealDecision(agentId, cycleId, payload, salt, "");
  });
});
