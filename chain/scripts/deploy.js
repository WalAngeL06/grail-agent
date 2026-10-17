/**
 * ERC-8004 Deployment Script
 *
 * Deploys the Validation Registry and TaskAgent contract.
 * Identity and Reputation registries use the official ERC-8004 addresses
 * on Fuji and Avalanche mainnet — these are NOT deployed per-agent.
 */

const hre = require("hardhat");
const config = require("../config/agent.config.js");

// Official ERC-8004 registry addresses (enforced on public networks)
const OFFICIAL_REGISTRIES = {
  fuji: {
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
  avalanche: {
    identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  },
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const networkConfig = config.networks[network] || config.networks.fuji;

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           ERC-8004 Agent Deployment                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nNetwork: ${networkConfig.name} (${network})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} AVAX\n`);

  let identityRegistryAddress;
  let reputationRegistryAddress;
  let validationRegistryAddress = networkConfig.registries?.validation;

  // Resolve Identity & Reputation registries
  const official = OFFICIAL_REGISTRIES[network];
  if (official) {
    // Enforce official addresses on public networks
    identityRegistryAddress = official.identity;
    reputationRegistryAddress = official.reputation;
    console.log("1. Using official ERC-8004 Identity Registry (shared)");
    console.log(`   → ${identityRegistryAddress}`);
    console.log("\n2. Using official ERC-8004 Reputation Registry (shared)");
    console.log(`   → ${reputationRegistryAddress}`);
  } else {
    // Local / custom network — deploy fresh registries
    identityRegistryAddress = networkConfig.registries?.identity;
    reputationRegistryAddress = networkConfig.registries?.reputation;

    if (!identityRegistryAddress) {
      console.log("1. Deploying Identity Registry...");
      const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
      const identityRegistry = await IdentityRegistry.deploy();
      await identityRegistry.waitForDeployment();
      identityRegistryAddress = await identityRegistry.getAddress();
      console.log(`   ✓ Deployed to: ${identityRegistryAddress}`);
    } else {
      console.log(`1. Using existing Identity Registry: ${identityRegistryAddress}`);
    }

    if (!reputationRegistryAddress) {
      console.log("\n2. Deploying Reputation Registry...");
      const ReputationRegistry = await hre.ethers.getContractFactory("ReputationRegistry");
      const reputationRegistry = await ReputationRegistry.deploy(identityRegistryAddress);
      await reputationRegistry.waitForDeployment();
      reputationRegistryAddress = await reputationRegistry.getAddress();
      console.log(`   ✓ Deployed to: ${reputationRegistryAddress}`);
    } else {
      console.log(`\n2. Using existing Reputation Registry: ${reputationRegistryAddress}`);
    }
  }

  // 3. Deploy or use existing Validation Registry (always per-agent)
  if (!validationRegistryAddress) {
    console.log("\n3. Deploying Validation Registry...");
    const ValidationRegistry = await hre.ethers.getContractFactory("ValidationRegistry");
    const validationRegistry = await ValidationRegistry.deploy(identityRegistryAddress);
    await validationRegistry.waitForDeployment();
    validationRegistryAddress = await validationRegistry.getAddress();
    console.log(`   ✓ Deployed to: ${validationRegistryAddress}`);
  } else {
    console.log(`\n3. Using existing Validation Registry: ${validationRegistryAddress}`);
  }

  // 4. Deploy TaskAgent
  console.log("\n4. Deploying TaskAgent...");
  const TaskAgent = await hre.ethers.getContractFactory("TaskAgent");
  const taskAgent = await TaskAgent.deploy(
    identityRegistryAddress,
    reputationRegistryAddress,
    validationRegistryAddress
  );
  await taskAgent.waitForDeployment();
  const taskAgentAddress = await taskAgent.getAddress();
  console.log(`   ✓ Deployed to: ${taskAgentAddress}`);

  // 5. Register the agent
  console.log("\n5. Registering Agent Identity...");
  console.log(`   Name: ${config.agent.name}`);
  console.log(`   Description: ${config.agent.description}`);
  const tx = await taskAgent.registerAgent(
    config.agent.name,
    config.agent.description,
    config.agent.metadataURI
  );
  await tx.wait();
  const agentId = await taskAgent.agentId();
  console.log(`   ✓ Agent registered with ID: ${agentId.toString()}`);

  // 6. Set task prices
  console.log("\n6. Setting task prices...");
  for (const task of config.tasks.types) {
    const price = hre.ethers.parseEther(task.price);
    await (await taskAgent.setTaskPrice(task.id, price)).wait();
    console.log(`   ✓ ${task.name}: ${task.price} AVAX`);
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    DEPLOYMENT COMPLETE                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`
Contracts:
  Identity Registry:    ${identityRegistryAddress}${official ? "  (official)" : ""}
  Reputation Registry:  ${reputationRegistryAddress}${official ? "  (official)" : ""}
  Validation Registry:  ${validationRegistryAddress}
  TaskAgent:            ${taskAgentAddress}

Agent:
  ID: ${agentId.toString()}
  Name: ${config.agent.name}

Explorer:
  ${networkConfig.explorer}/address/${taskAgentAddress}

Frontend:
  http://localhost:3003/index.html?contract=${taskAgentAddress}
`);

  // Save deployment info
  const deploymentInfo = {
    network: network,
    chainId: networkConfig.chainId,
    deployer: deployer.address,
    contracts: {
      identityRegistry: identityRegistryAddress,
      reputationRegistry: reputationRegistryAddress,
      validationRegistry: validationRegistryAddress,
      taskAgent: taskAgentAddress,
    },
    agent: {
      id: agentId.toString(),
      name: config.agent.name,
      description: config.agent.description,
    },
    timestamp: new Date().toISOString(),
  };

  const fs = require("fs");
  fs.writeFileSync(
    `./deployment-${network}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment saved to: deployment-${network}.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
