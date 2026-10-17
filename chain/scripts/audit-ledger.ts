import fs from "node:fs";
import path from "node:path";
import { FetchRequest, JsonRpcProvider } from "ethers";
import { auditLedger, PUBLICNODE_RPC, renderAuditMarkdown } from "./lib/audit-ledger";
import type { CycleDeployment } from "./lib/verify-cycle";

async function main(): Promise<void> {
  // Standalone reader: does not import Hardhat config, dotenv, Wallet or a signer.
  const deployment: CycleDeployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../contracts/chain.json"), "utf8"));
  if (deployment.chainId !== 43113 || deployment.agentId !== "1") throw new Error("Audit requires Fuji 43113 and agent #1");
  const request = new FetchRequest(PUBLICNODE_RPC);
  request.timeout = 20_000;
  request.retryFunc = async () => false; // Bounded 429 retries belong to the audit reader.
  const provider = new JsonRpcProvider(request, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
  try {
    console.log(`Read-only audit of agent #1 via ${PUBLICNODE_RPC}`);
    let chunks = 0;
    const audit = await auditLedger(provider, deployment, {
      onProgress: (from, to, head) => {
        if (++chunks % 10 === 0 || to === head) console.error(`Scanned through block ${to}/${head} (${chunks} chunks; latest ${from}–${to})`);
      },
    });
    const report = renderAuditMarkdown(audit);
    const output = path.resolve(__dirname, "../deployments/audit-latest.md");
    const temporary = `${output}.tmp`;
    fs.writeFileSync(temporary, `RPC: ${PUBLICNODE_RPC}\n\n${report}`, "utf8");
    fs.renameSync(temporary, output);
    console.log(report);
    console.log(`Saved ${output}`);
    if (audit.summary.mismatches) process.exitCode = 1;
  } finally {
    provider.destroy();
  }
}

if (require.main === module) main().catch(error => {
  console.error("Ledger audit failed:", error.shortMessage || error.message || "Unknown error");
  process.exitCode = 1;
});
