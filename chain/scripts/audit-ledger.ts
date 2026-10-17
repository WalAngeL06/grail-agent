import fs from "node:fs";
import path from "node:path";
import { FetchRequest, JsonRpcProvider } from "ethers";
import { auditLedger, PUBLICNODE_RPC, renderAuditMarkdown } from "./lib/audit-ledger";
import type { CycleDeployment } from "./lib/verify-cycle";

export function resolveAuditRpc(args: string[], env: NodeJS.ProcessEnv = process.env): string {
  let selected: string | undefined;
  for (let i = 0; i < args.length; i++) {
    let value: string | undefined;
    if (args[i] === "--rpc") value = args[++i];
    else if (args[i].startsWith("--rpc=")) value = args[i].slice(6);
    else throw new Error("Usage: npm run audit -- [--rpc URL]");
    if (!value || value.startsWith("--") || selected !== undefined) throw new Error("Usage: npm run audit -- [--rpc URL]");
    selected = value;
  }
  const rpc = selected || env.GRAIL_AUDIT_RPC_URL || env.FUJI_RPC_URL || PUBLICNODE_RPC;
  if (!["https:", "http:"].includes(new URL(rpc).protocol)) throw new Error("Audit RPC must use HTTP or HTTPS");
  return rpc;
}

export function auditRpcLabel(rpc: string): string {
  // Custom RPC URLs may contain credentials in their path/query; log only the origin.
  return new URL(rpc).origin;
}

async function main(): Promise<void> {
  // Standalone reader: does not import Hardhat config, dotenv, Wallet or a signer.
  const deployment: CycleDeployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../contracts/chain.json"), "utf8"));
  if (deployment.chainId !== 43113 || deployment.agentId !== "1") throw new Error("Audit requires Fuji 43113 and agent #1");
  const rpc = resolveAuditRpc(process.argv.slice(2));
  const label = auditRpcLabel(rpc);
  const request = new FetchRequest(rpc);
  request.timeout = 20_000;
  request.retryFunc = async () => false; // Bounded 429 retries belong to the audit reader.
  const provider = new JsonRpcProvider(request, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
  try {
    console.log(`Read-only audit of agent #1 via ${label}`);
    let chunks = 0;
    const audit = await auditLedger(provider, deployment, {
      onProgress: (from, to, head) => {
        if (++chunks % 10 === 0 || to === head) console.error(`Scanned through block ${to}/${head} (${chunks} chunks; latest ${from}–${to})`);
      },
    });
    const report = renderAuditMarkdown(audit);
    const output = path.resolve(__dirname, "../runtime/audit-latest.md");
    const temporary = `${output}.tmp`;
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(temporary, `RPC origin: ${label}\n\n${report}`, "utf8");
    fs.renameSync(temporary, output);
    console.log(report);
    console.log(`Saved ${output}`);
    if (audit.summary.mismatches) process.exitCode = 1;
  } catch (error) {
    const failure = error as { shortMessage?: string; message?: string };
    console.error("Ledger audit failed:", (failure.shortMessage || failure.message || "Unknown error").split(rpc).join(label));
    process.exitCode = 1;
  } finally {
    provider.destroy();
  }
}

if (require.main === module) main().catch(error => {
  console.error("Ledger audit failed:", error.shortMessage || error.message || "Unknown error");
  process.exitCode = 1;
});
