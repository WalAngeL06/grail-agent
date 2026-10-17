/**
 * ERC-8004 Agent CLI
 *
 * Utility commands for managing your agent
 *
 * Usage:
 *   npx hardhat run scripts/agent-cli.js --network fuji
 *
 * Or with arguments:
 *   COMMAND=status npx hardhat run scripts/agent-cli.js --network fuji
 *   COMMAND=complete TASK_ID=1 npx hardhat run scripts/agent-cli.js --network fuji
 */

const hre = require("hardhat");

// Load deployment info
let deployment;
try {
  deployment = require(`../deployment-${hre.network.name}.json`);
} catch (e) {
  console.error(`Error: deployment-${hre.network.name}.json not found`);
  process.exit(1);
}

const TASK_STATUS = ["Pending", "InProgress", "Completed", "Disputed", "Cancelled"];
const TASK_TYPES = ["Summarization", "CodeReview", "DataAnalysis", "Translation", "Custom"];

async function getContracts() {
  const TaskAgent = await hre.ethers.getContractFactory("TaskAgent");
  const ReputationRegistry = await hre.ethers.getContractFactory("ReputationRegistry");

  return {
    taskAgent: TaskAgent.attach(deployment.contracts.taskAgent),
    reputationRegistry: ReputationRegistry.attach(deployment.contracts.reputationRegistry),
  };
}

async function showStatus() {
  const { taskAgent, reputationRegistry } = await getContracts();

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║          Agent Status                ║");
  console.log("╚══════════════════════════════════════╝\n");

  const agentId = await taskAgent.agentId();
  const agentName = await taskAgent.agentName();
  const totalTasks = await taskAgent.getTotalTasks();
  const [feedbackCount, avgRating] = await taskAgent.getReputationSummary();
  const [validationCount, avgScore] = await taskAgent.getValidationSummary();

  console.log(`Agent: ${agentName} (ID: ${agentId})`);
  console.log(`Contract: ${deployment.contracts.taskAgent}`);
  console.log(`\nStatistics:`);
  console.log(`  Total Tasks: ${totalTasks}`);
  console.log(`  Feedback: ${feedbackCount} reviews`);
  console.log(`  Avg Rating: ${feedbackCount > 0 ? hre.ethers.formatUnits(avgRating, 18) : "N/A"}`);
  console.log(`  Validations: ${validationCount}`);
}

async function listTasks() {
  const { taskAgent } = await getContracts();

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║            Task List                 ║");
  console.log("╚══════════════════════════════════════╝\n");

  const taskIds = await taskAgent.getAllTaskIds();

  if (taskIds.length === 0) {
    console.log("No tasks found.");
    return;
  }

  for (const taskId of taskIds) {
    const task = await taskAgent.getTask(taskId);
    const status = TASK_STATUS[Number(task.status)];
    const type = TASK_TYPES[Number(task.taskType)];

    console.log(`Task #${task.taskId} [${status}]`);
    console.log(`  Type: ${type}`);
    console.log(`  Requester: ${task.requester}`);
    console.log(`  Payment: ${hre.ethers.formatEther(task.payment)} AVAX`);
    if (task.outputURI) {
      console.log(`  Output: ${task.outputURI}`);
    }
    console.log();
  }
}

async function completeTask(taskId) {
  const { taskAgent } = await getContracts();

  console.log(`\nCompleting task #${taskId}...`);

  const task = await taskAgent.getTask(taskId);

  if (task.status === 0n) {
    console.log("  Starting task...");
    await (await taskAgent.startTask(taskId)).wait();
  }

  if (task.status <= 1n) {
    console.log("  Completing task...");
    const outputHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Task completed via CLI"));
    await (await taskAgent.completeTask(taskId, "cli://completed", outputHash)).wait();
    console.log("  Done!");
  } else {
    console.log(`  Task already ${TASK_STATUS[Number(task.status)]}`);
  }
}

async function showFeedback() {
  const { taskAgent, reputationRegistry } = await getContracts();
  const agentId = await taskAgent.agentId();

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║          Agent Feedback              ║");
  console.log("╚══════════════════════════════════════╝\n");

  const clients = await reputationRegistry.getClients(agentId);

  if (clients.length === 0) {
    console.log("No feedback yet.");
    return;
  }

  for (const client of clients) {
    const lastIndex = await reputationRegistry.getLastIndex(agentId, client);

    for (let i = 1n; i <= lastIndex; i++) {
      const feedback = await reputationRegistry.readFeedback(agentId, client, i);

      if (!feedback.isRevoked) {
        console.log(`From: ${client}`);
        console.log(`  Rating: ${feedback.value}/5`);
        console.log(`  Tag: ${feedback.tag1}`);
        console.log(`  Comment: ${feedback.tag2 || "(none)"}`);
        console.log();
      }
    }
  }
}

async function withdraw() {
  const { taskAgent } = await getContracts();

  const balance = await hre.ethers.provider.getBalance(deployment.contracts.taskAgent);
  console.log(`\nContract balance: ${hre.ethers.formatEther(balance)} AVAX`);

  if (balance > 0n) {
    console.log("Withdrawing...");
    await (await taskAgent.withdraw()).wait();
    console.log("Done!");
  } else {
    console.log("Nothing to withdraw.");
  }
}

async function main() {
  const command = process.env.COMMAND || "status";

  switch (command) {
    case "status":
      await showStatus();
      break;
    case "tasks":
      await listTasks();
      break;
    case "complete":
      const taskId = process.env.TASK_ID;
      if (!taskId) {
        console.error("Error: TASK_ID required");
        process.exit(1);
      }
      await completeTask(taskId);
      break;
    case "feedback":
      await showFeedback();
      break;
    case "withdraw":
      await withdraw();
      break;
    default:
      console.log(`
Available commands:
  COMMAND=status    - Show agent status
  COMMAND=tasks     - List all tasks
  COMMAND=complete TASK_ID=N - Complete a task
  COMMAND=feedback  - Show all feedback
  COMMAND=withdraw  - Withdraw earnings
      `);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
