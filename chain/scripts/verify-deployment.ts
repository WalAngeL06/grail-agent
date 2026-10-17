import hre, { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

async function main() {
  const outputPath = process.env.GRAIL_CHAIN_JSON || path.resolve(__dirname, "../../contracts/chain.json");
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(Number((await ethers.provider.getNetwork()).chainId), output.chainId);
  for (const [name, entry] of Object.entries(output.contracts) as [string, any][]) {
    const receipt = await ethers.provider.getTransactionReceipt(entry.deployTx);
    assert(receipt && receipt.status === 1, `${name}: deployment receipt missing/reverted`);
    assert.equal(receipt.contractAddress?.toLowerCase(), entry.address.toLowerCase());
    assert.equal(receipt.from.toLowerCase(), output.agentWallet.toLowerCase());
    const code = await ethers.provider.getCode(entry.address);
    assert.notEqual(code, "0x", `${name}: code missing`);
    const artifact = await hre.artifacts.readArtifact(name);
    assert.deepEqual(entry.abi, artifact.abi, `${name}: ABI differs from build`);
    const build = await hre.artifacts.getBuildInfo(`${artifact.sourceName}:${name}`);
    assert(build, `${name}: build info missing; compile first`);
    const runtime = build.output.contracts[artifact.sourceName][name].evm.deployedBytecode;
    let actual = code.slice(2);
    // Constructor-injected immutables differ; registry addresses are checked below.
    for (const ranges of Object.values(runtime.immutableReferences || {})) {
      for (const { start, length } of ranges) {
        actual = actual.slice(0, start * 2) + "0".repeat(length * 2) + actual.slice((start + length) * 2);
      }
    }
    assert.equal(actual.toLowerCase(), runtime.object.toLowerCase(), `${name}: deployed bytecode mismatch`);
    console.log(`${name}: receipt, ABI and bytecode verified; ${entry.address}`);
  }
  const identityAddress = output.contracts.IdentityRegistry.address;
  const identity = await ethers.getContractAt("IdentityRegistry", identityAddress);
  assert.equal((await identity.ownerOf(output.agentId)).toLowerCase(), output.agentWallet.toLowerCase());
  assert.equal(await identity.isAuthorized(output.agentId, output.agentWallet), true);
  assert.equal(await identity.tokenURI(output.agentId), output.agentURI);
  assert.equal(ethers.toUtf8String(await identity.getMetadata(output.agentId, "name")), output.agentName);
  const metadata = JSON.parse(Buffer.from(output.agentURI.split(",")[1], "base64").toString());
  assert.equal(metadata.name, output.agentName);
  assert(metadata.description.includes("OKX TR (dry_run + guarded live)"));
  for (const name of ["ReputationRegistry", "ValidationRegistry", "GrailLedger"]) {
    const registry = await ethers.getContractAt(name, output.contracts[name].address);
    assert.equal((await registry.identityRegistry()).toLowerCase(), identityAddress.toLowerCase());
  }
  const registration = await ethers.provider.getTransactionReceipt(output.registrationTx);
  assert(registration && registration.status === 1, "Registration receipt missing/reverted");
  const registered = registration.logs.map(log => {
    try { return identity.interface.parseLog(log); } catch { return null; }
  }).find(log => log?.name === "Registered");
  assert(registered && registered.args.agentId.toString() === output.agentId, "Registration event mismatch");
  const { payloadUtf8, saltHex, commitHash } = output.testVector;
  assert.equal(ethers.keccak256(ethers.concat([ethers.toUtf8Bytes(payloadUtf8), saltHex])), commitHash);
  const payload = JSON.parse(payloadUtf8);
  assert.equal(payload.dry_run, true);
  assert.equal(payload.decisions[0].llm_flag, "skipped");
  const ledger = await ethers.getContractAt("GrailLedger", output.contracts.GrailLedger.address);
  console.log(`Agent ${output.agentId}: owner, metadata, registration event, registry links and test vector verified`);
  console.log(`Counters: commits=${await ledger.commitCount(output.agentId)}, reveals=${await ledger.revealCount(output.agentId)}`);
}
main().catch(error => {
  console.error("Verification failed:", error.shortMessage || error.message || "unknown error");
  process.exitCode = 1;
});
