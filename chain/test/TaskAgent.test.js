const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC-8004 TaskAgent Demo", function () {
  let identityRegistry;
  let reputationRegistry;
  let validationRegistry;
  let taskAgent;
  let owner;
  let user1;
  let user2;
  let validator;

  beforeEach(async function () {
    [owner, user1, user2, validator] = await ethers.getSigners();

    // Deploy Identity Registry
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    // Deploy Reputation Registry
    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistry.deploy(await identityRegistry.getAddress());
    await reputationRegistry.waitForDeployment();

    // Deploy Validation Registry
    const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
    validationRegistry = await ValidationRegistry.deploy(await identityRegistry.getAddress());
    await validationRegistry.waitForDeployment();

    // Deploy TaskAgent
    const TaskAgent = await ethers.getContractFactory("TaskAgent");
    taskAgent = await TaskAgent.deploy(
      await identityRegistry.getAddress(),
      await reputationRegistry.getAddress(),
      await validationRegistry.getAddress()
    );
    await taskAgent.waitForDeployment();
  });

  describe("Identity Registry", function () {
    it("Should register agent with metadata", async function () {
      await taskAgent.registerAgent(
        "TaskAgent Demo",
        "A demo AI agent for ERC-8004",
        "ipfs://QmTestURI"
      );

      expect(await taskAgent.isRegistered()).to.be.true;
      expect(await taskAgent.agentName()).to.equal("TaskAgent Demo");

      const agentId = await taskAgent.agentId();
      expect(agentId).to.be.gt(0);

      // Check Identity Registry
      const tokenURI = await identityRegistry.tokenURI(agentId);
      expect(tokenURI).to.equal("ipfs://QmTestURI");
    });

    it("Should prevent double registration", async function () {
      await taskAgent.registerAgent("Agent", "Desc", "ipfs://URI");
      await expect(
        taskAgent.registerAgent("Agent2", "Desc2", "ipfs://URI2")
      ).to.be.revertedWith("Already registered");
    });
  });

  describe("Task Management", function () {
    beforeEach(async function () {
      await taskAgent.registerAgent("TaskAgent", "Demo Agent", "ipfs://agent");
    });

    it("Should request a task with payment", async function () {
      const inputHash = ethers.keccak256(ethers.toUtf8Bytes("test input"));
      const payment = ethers.parseEther("0.001");

      await expect(
        taskAgent.connect(user1).requestTask(
          0, // TextSummarization
          "ipfs://input",
          inputHash,
          { value: payment }
        )
      ).to.emit(taskAgent, "TaskRequested");

      const task = await taskAgent.getTask(1);
      expect(task.requester).to.equal(user1.address);
      expect(task.status).to.equal(0); // Pending
      expect(task.payment).to.equal(payment);
    });

    it("Should reject insufficient payment", async function () {
      const inputHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await expect(
        taskAgent.connect(user1).requestTask(0, "ipfs://input", inputHash, {
          value: ethers.parseEther("0.0001"), // Less than required
        })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should complete task workflow", async function () {
      const inputHash = ethers.keccak256(ethers.toUtf8Bytes("input"));
      const outputHash = ethers.keccak256(ethers.toUtf8Bytes("output"));

      // Request task
      await taskAgent.connect(user1).requestTask(0, "ipfs://input", inputHash, {
        value: ethers.parseEther("0.001"),
      });

      // Start task
      await taskAgent.startTask(1);
      let task = await taskAgent.getTask(1);
      expect(task.status).to.equal(1); // InProgress

      // Complete task
      await taskAgent.completeTask(1, "ipfs://output", outputHash);
      task = await taskAgent.getTask(1);
      expect(task.status).to.equal(2); // Completed
      expect(task.outputURI).to.equal("ipfs://output");
      expect(task.outputHash).to.equal(outputHash);
    });

    it("Should allow requester to cancel pending task", async function () {
      const inputHash = ethers.keccak256(ethers.toUtf8Bytes("input"));
      const payment = ethers.parseEther("0.001");

      await taskAgent.connect(user1).requestTask(0, "ipfs://input", inputHash, {
        value: payment,
      });

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await taskAgent.connect(user1).cancelTask(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      // Check refund (accounting for gas)
      expect(balanceAfter + gasUsed).to.be.closeTo(balanceBefore + payment, ethers.parseEther("0.0001"));

      const task = await taskAgent.getTask(1);
      expect(task.status).to.equal(4); // Cancelled
    });
  });

  describe("Reputation System", function () {
    beforeEach(async function () {
      await taskAgent.registerAgent("TaskAgent", "Demo Agent", "ipfs://agent");

      // Complete a task first
      const inputHash = ethers.keccak256(ethers.toUtf8Bytes("input"));
      await taskAgent.connect(user1).requestTask(0, "ipfs://input", inputHash, {
        value: ethers.parseEther("0.001"),
      });
      await taskAgent.startTask(1);
      await taskAgent.completeTask(1, "ipfs://output", ethers.keccak256(ethers.toUtf8Bytes("output")));
    });

    it("Should allow feedback after task completion", async function () {
      await expect(
        taskAgent.connect(user1).giveFeedback(1, 5, "Great work!")
      ).to.emit(reputationRegistry, "NewFeedback");
    });

    it("Should track reputation summary", async function () {
      await taskAgent.connect(user1).giveFeedback(1, 5, "Excellent!");

      const [count, avgRating] = await taskAgent.getReputationSummary();
      expect(count).to.equal(1);
      // Rating is normalized to 18 decimals: 5 * 10^18
      expect(avgRating).to.equal(ethers.parseUnits("5", 18));
    });

    it("Should prevent feedback from non-requester", async function () {
      await expect(
        taskAgent.connect(user2).giveFeedback(1, 5, "Fake feedback")
      ).to.be.revertedWith("Not the requester");
    });
  });

  describe("Validation System", function () {
    beforeEach(async function () {
      await taskAgent.registerAgent("TaskAgent", "Demo Agent", "ipfs://agent");
    });

    it("Should request validation", async function () {
      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("validation-request"));

      await expect(
        taskAgent.requestValidation(validator.address, "ipfs://validation-request", requestHash)
      ).to.emit(validationRegistry, "ValidationRequest");
    });

    it("Should allow validator to respond", async function () {
      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("validation-request"));
      const responseHash = ethers.keccak256(ethers.toUtf8Bytes("validation-response"));

      await taskAgent.requestValidation(validator.address, "ipfs://request", requestHash);

      await expect(
        validationRegistry.connect(validator).validationResponse(
          requestHash,
          85, // Score 0-100
          "ipfs://response",
          responseHash,
          "capability-test"
        )
      ).to.emit(validationRegistry, "ValidationResponse");

      const [validatorAddr, agentId, response] = await validationRegistry.getValidationStatus(requestHash);
      expect(validatorAddr).to.equal(validator.address);
      expect(response).to.equal(85);
    });

    it("Should track validation summary", async function () {
      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("validation"));
      const responseHash = ethers.keccak256(ethers.toUtf8Bytes("response"));

      await taskAgent.requestValidation(validator.address, "ipfs://request", requestHash);
      await validationRegistry.connect(validator).validationResponse(
        requestHash,
        90,
        "ipfs://response",
        responseHash,
        "test"
      );

      const [count, avgScore] = await taskAgent.getValidationSummary();
      expect(count).to.equal(1);
      expect(avgScore).to.equal(90);
    });
  });

  describe("Owner Operations", function () {
    beforeEach(async function () {
      await taskAgent.registerAgent("TaskAgent", "Demo Agent", "ipfs://agent");
    });

    it("Should allow owner to withdraw funds", async function () {
      const inputHash = ethers.keccak256(ethers.toUtf8Bytes("input"));

      // Request and complete multiple tasks
      for (let i = 0; i < 3; i++) {
        await taskAgent.connect(user1).requestTask(0, "ipfs://input", inputHash, {
          value: ethers.parseEther("0.001"),
        });
        await taskAgent.startTask(i + 1);
        await taskAgent.completeTask(i + 1, "ipfs://output", ethers.keccak256(ethers.toUtf8Bytes("output")));
      }

      const contractBalance = await ethers.provider.getBalance(await taskAgent.getAddress());
      expect(contractBalance).to.equal(ethers.parseEther("0.003"));

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await taskAgent.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(ownerBalanceAfter + gasUsed - ownerBalanceBefore).to.equal(contractBalance);
    });

    it("Should allow owner to update task prices", async function () {
      const newPrice = ethers.parseEther("0.01");
      await taskAgent.setTaskPrice(0, newPrice);
      expect(await taskAgent.taskPrices(0)).to.equal(newPrice);
    });

    it("Should allow owner to update agent URI", async function () {
      const newURI = "ipfs://newAgentMetadata";
      await taskAgent.updateAgentURI(newURI);
      expect(await taskAgent.agentURI()).to.equal(newURI);
    });
  });
});
