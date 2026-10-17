import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import { HardhatUserConfig, subtask, task } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, TASK_RUN } from "hardhat/builtin-tasks/task-names";
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
  .setAction(async (args, hre, runSuper) => {
    if (args.cycle === undefined) return runSuper(args);
    if (path.resolve(args.script) !== path.resolve(__dirname, "scripts/verify-cycle.ts")) {
      throw new Error("--cycle is only supported by scripts/verify-cycle.ts");
    }
    const { runVerifyCycle } = await import("./scripts/verify-cycle");
    await runVerifyCycle(hre, args.cycle);
  });

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, _hre, runSuper) => {
  if (solcVersion !== "0.8.20") return runSuper();
  return {
    compilerPath: require.resolve("solc/soljson.js"), isSolcJs: true,
    version: solcVersion, longVersion: require("solc").version().split(".Emscripten")[0],
  };
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
