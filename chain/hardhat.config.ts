import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import { HardhatUserConfig, subtask, task } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, TASK_RUN } from "hardhat/builtin-tasks/task-names";
import { TASK_VERIFY_ETHERSCAN_GET_MINIMAL_INPUT, TASK_VERIFY_ETHERSCAN_ATTEMPT_VERIFICATION } from "@nomicfoundation/hardhat-verify/internal/task-names";
import dotenv from "dotenv";
import path from "node:path";

// One shared env file; never copy secrets into a worktree.
dotenv.config({
  path: process.env.GRAIL_ENV || path.resolve(__dirname, "../../../Agentic Hack/.env"),
  quiet: true,
});

// Hardhat 2's run task normally rejects script arguments. Keep --cycle scoped
// to this reader and execute it in-process so the value is never lost to a child.
task(TASK_RUN).addOptionalParam("cycle", "Cycle ID for scripts/verify-cycle.ts")
  .addOptionalParam("commitTx", "Known commit tx identity; skips log scanning")
  .addOptionalParam("revealTx", "Known reveal tx identity; skips log scanning")
  .setAction(async (args, hre, runSuper) => {
    if (args.cycle === undefined && !args.commitTx && !args.revealTx) return runSuper(args);
    if (path.resolve(args.script) !== path.resolve(__dirname, "scripts/verify-cycle.ts")) {
      throw new Error("--cycle is only supported by scripts/verify-cycle.ts");
    }
    const { runVerifyCycle } = await import("./scripts/verify-cycle");
    try { await runVerifyCycle(hre, args.cycle, { commitTx: args.commitTx, revealTx: args.revealTx }); }
    catch (error) {
      console.error("Cycle verification failed:", (error as Error).message);
      process.exitCode = 1;
    }
  });

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, _hre, runSuper) => {
  if (solcVersion !== "0.8.20") return runSuper();
  return {
    compilerPath: require.resolve("solc/soljson.js"), isSolcJs: true,
    version: solcVersion, longVersion: require("solc").version().split(".Emscripten")[0],
  };
});

// A stuck minimal-input explorer job can be retried with the original build's
// complete standard JSON. This changes source submission, never deployed code.
subtask(TASK_VERIFY_ETHERSCAN_GET_MINIMAL_INPUT).setAction(async ({ sourceName }, hre, runSuper) => {
  if (process.env.GRAIL_VERIFY_FULL_INPUT !== "1") return runSuper({ sourceName });
  const fqn = `${sourceName}:${path.basename(sourceName, ".sol")}`;
  const build = await hre.artifacts.getBuildInfo(fqn);
  if (!build) throw new Error(`Build info missing for ${fqn}`);
  return structuredClone(build.input);
});

// The default plugin polls a pending queue forever. Keep the public request GUID
// visible and bound the wait, so a source/API failure remains reviewable.
subtask(TASK_VERIFY_ETHERSCAN_ATTEMPT_VERIFICATION).setAction(async (args, _hre, runSuper) => {
  const explorer = args.verificationInterface;
  const original = explorer.getVerificationStatus;
  let checks = 0;
  explorer.getVerificationStatus = async function (guid: string) {
    if (checks++ === 0) console.log(`Explorer source request GUID: ${guid}`);
    if (checks > 40) throw new Error(`Explorer source status remains pending; GUID ${guid}; check getsourcecode before resubmitting`);
    return original.call(this, guid);
  };
  try { return await runSuper(args); }
  finally { explorer.getVerificationStatus = original; }
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "paris" },
  },
  networks: {
    hardhat: { chainId: 31337 },
    fuji: {
      url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      // Deployment creates an ethers Wallet after validating the env in memory.
      // Keeping accounts empty prevents Hardhat config errors from echoing a key.
      accounts: [],
      timeout: 60_000,
    },
  },
  etherscan: {
    // Routescan's public verification API requires no secret API key.
    apiKey: { fuji: "routescan" },
    customChains: [{
      network: "fuji",
      chainId: 43113,
      urls: {
        apiURL: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan",
        browserURL: "https://testnet.snowtrace.io",
      },
    }],
  },
  sourcify: { enabled: false },
};
export default config;
