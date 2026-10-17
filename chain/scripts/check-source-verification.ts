import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

async function main() {
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../contracts/chain.json"), "utf8"));
  const results: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(deployment.contracts) as [string, { address: string }][]) {
    const url = new URL("https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api");
    url.search = new URLSearchParams({ module: "contract", action: "getsourcecode", address: entry.address }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Explorer HTTP ${response.status} for ${name}`);
    const body = await response.json() as { status: string; result: any[] };
    const source = body.result?.[0];
    if (body.status !== "1" || !source?.SourceCode || source.ContractName !== name
      || !source.ABI || source.ABI.startsWith("Contract source code not verified")) {
      throw new Error(`${name}: source verification not confirmed by explorer API`);
    }
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
  const outputPath = path.resolve(__dirname, "../deployments/source-verification.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    network: "fuji", chainId: 43113, checkedAt: new Date().toISOString(), contracts: results,
  }, null, 2) + "\n");
}
main().catch(error => {
  console.error("Source verification check failed:", error.message);
  process.exitCode = 1;
});
