import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { AbiCoder } from "ethers";

async function main() {
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../contracts/chain.json"), "utf8"));
  const results: Record<string, unknown> = {};
  const pending: string[] = [];
  for (const [name, entry] of Object.entries(deployment.contracts) as [string, { address: string }][]) {
    const url = new URL("https://api.routescan.io/v2/network/testnet/evm/43113/etherscan");
    url.search = new URLSearchParams({ module: "contract", action: "getsourcecode", address: entry.address }).toString();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000), cache: "no-store", headers: { "cache-control": "no-cache" },
    });
    if (!response.ok) throw new Error(`Explorer HTTP ${response.status} for ${name}`);
    const body = await response.json() as { status: string; result: any[] };
    const source = body.result?.[0];
    if (body.status !== "1" || !source?.SourceCode || source.ContractName?.split(":").pop() !== name
      || !source.ABI || source.ABI.startsWith("Contract source code not verified")) {
      pending.push(`${name} ${entry.address}`);
      console.log(`PENDING ${name} ${entry.address}; explorer contract=${source?.ContractName || "none"}, sourceBytes=${source?.SourceCode?.length || 0}`);
      continue;
    }
    assert.equal(source.CompilerVersion, "v0.8.20+commit.a1b79de6", `${name}: compiler mismatch`);
    assert.equal(source.OptimizationUsed, "1", `${name}: optimizer mismatch`);
    assert.equal(source.Runs, "200", `${name}: optimizer runs mismatch`);
    const expectedArgs = name === "IdentityRegistry" ? "" : AbiCoder.defaultAbiCoder().encode(
      ["address"], [deployment.contracts.IdentityRegistry.address],
    ).slice(2).toLowerCase();
    assert.equal((source.ConstructorArguments || "").replace(/^0x/, "").toLowerCase(), expectedArgs, `${name}: constructor mismatch`);
    assert.deepEqual(JSON.parse(source.ABI), deployment.contracts[name].abi, `${name}: explorer ABI mismatch`);
    const browser = `https://testnet.snowtrace.io/address/${entry.address}#code`;
    results[name] = {
      address: entry.address, status: "VERIFIED", contractName: source.ContractName,
      compilerVersion: source.CompilerVersion, optimizationUsed: source.OptimizationUsed,
      runs: source.Runs, constructorArguments: source.ConstructorArguments,
      sourceCodeSha256: createHash("sha256").update(source.SourceCode).digest("hex"),
      abiEntries: JSON.parse(source.ABI).length, explorer: browser,
    };
    console.log(`VERIFIED ${name}: ${browser}`);
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  if (pending.length) throw new Error(`Source verification not confirmed: ${pending.join(", ")}`);
  const outputPath = path.resolve(__dirname, "../deployments/source-verification.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    network: "fuji", chainId: 43113, checkedAt: new Date().toISOString(), contracts: results,
  }, null, 2) + "\n");
}
main().catch(error => {
  console.error("Source verification check failed:", error.message);
  process.exitCode = 1;
});
