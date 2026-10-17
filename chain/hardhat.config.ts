import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import { HardhatUserConfig, subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import dotenv from "dotenv";
import path from "node:path";

// One shared env file; never copy secrets into a worktree.
dotenv.config({
  path: process.env.GRAIL_ENV || path.resolve(__dirname, "../../../Agentic Hack/.env"),
  quiet: true,
});

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, _hre, runSuper) => {
  if (solcVersion !== "0.8.20") return runSuper();
  return {
    compilerPath: require.resolve("solc/soljson.js"), isSolcJs: true,
    version: solcVersion, longVersion: require("solc").version(),
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
};
export default config;
