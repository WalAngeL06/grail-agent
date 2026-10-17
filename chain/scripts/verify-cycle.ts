import type { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "node:fs";
import path from "node:path";
import { parseCycle, verifyCycle } from "./lib/verify-cycle";

export async function runVerifyCycle(hre: HardhatRuntimeEnvironment, cycle: string | undefined): Promise<void> {
  const cycleId = parseCycle(cycle);
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../contracts/chain.json"), "utf8"));
  if (hre.network.name !== "fuji" || deployment.chainId !== 43113) throw new Error("Cycle CLI requires --network fuji (43113)");
  const result = await verifyCycle(hre.ethers.provider, deployment, cycleId);
  console.log(`${result.status} agent=${result.agentId} cycle=${result.cycleId}`);
  if (result.commitHash) console.log(`commitHash=${result.commitHash}`);
  if (result.computedHash) console.log(`keccak(payload||salt)=${result.computedHash}`);
  if (result.saltHex) console.log(`salt(calldata)=${result.saltHex}`);
  for (const hash of [result.commitTx, result.revealTx]) {
    if (hash) console.log(`https://testnet.snowtrace.io/tx/${hash}`);
  }
  if (result.status !== "MATCH") process.exitCode = result.status === "MISMATCH" ? 1 : 2;
}

if (require.main === module) {
  runVerifyCycle(require("hardhat"), undefined).catch(error => {
    console.error("Cycle verification failed:", error.shortMessage || error.message);
    process.exitCode = 1;
  });
}
