import hre, { ethers } from "hardhat";
import { Wallet, getCreateAddress, keccak256, concat, toUtf8Bytes } from "ethers";
import type { Signer, TransactionRequest, TransactionReceipt } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { agent, productConfig, testVector } from "../config/agent";

type Step = { hash: string; nonce: number; address?: string; confirmed?: boolean };
type Journal = { chainId: number; agentWallet: string; steps: Record<string, Step> };

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const isFuji = hre.network.name === "fuji";
  if (isFuji ? chainId !== 43113 : chainId !== 31337) throw new Error("Unexpected network; deployment stopped");
  let signer: Signer;
  if (isFuji) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(process.env.AGENT_PRIVATE_KEY || "")) throw new Error("AGENT_PRIVATE_KEY missing or invalid");
    signer = new Wallet(process.env.AGENT_PRIVATE_KEY!, ethers.provider);
    if ((process.env.AGENT_ADDRESS || "").toLowerCase() !== (await signer.getAddress()).toLowerCase()) {
      throw new Error("AGENT_ADDRESS does not match the configured wallet");
    }
  } else [signer] = await ethers.getSigners();
  const wallet = await signer.getAddress();
  const balance = await ethers.provider.getBalance(wallet);
  console.log(`Network ${chainId}; wallet ${wallet}; balance ${ethers.formatEther(balance)} AVAX`);
  if (balance === 0n) throw new Error("Wallet has no gas funds");
  const journalPath = path.resolve(__dirname, `../deployments/${hre.network.name}.json`);
  const outputPath = isFuji ? path.resolve(__dirname, "../../contracts/chain.json")
    : path.resolve(__dirname, "../deployments/chain-local.json");
  const journal: Journal = isFuji && fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath, "utf8"))
    : { chainId, agentWallet: wallet, steps: {} };
  if (journal.chainId !== chainId || journal.agentWallet.toLowerCase() !== wallet.toLowerCase()) throw new Error("Journal wallet/network mismatch");
  fs.mkdirSync(path.dirname(journalPath), { recursive: true });
  const save = () => {
    fs.writeFileSync(journalPath + ".tmp", JSON.stringify(journal, null, 2) + "\n");
    fs.renameSync(journalPath + ".tmp", journalPath);
  };

  async function receiptFor(step: Step): Promise<TransactionReceipt> {
    // HardhatEthersProvider does not implement waitForTransaction.
    // Poll the recorded hash; an unresolved broadcast is never sent again.
    let receipt = await ethers.provider.getTransactionReceipt(step.hash);
    for (let attempt = 0; !receipt && attempt < 30; ++attempt) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      receipt = await ethers.provider.getTransactionReceipt(step.hash);
    }
    if (!receipt) throw new Error(`Unresolved transaction ${step.hash}; do not resend`);
    if (receipt.status !== 1) throw new Error(`Reverted transaction ${step.hash}; deployment stopped`);
    if (receipt.from.toLowerCase() !== wallet.toLowerCase()) throw new Error("Receipt sender mismatch");
    return receipt;
  }

  async function send(name: string, request: TransactionRequest, deployment = false): Promise<TransactionReceipt> {
    let step = journal.steps[name];
    if (!step) {
      // Nothing is broadcast until gas has been estimated and a durable intent exists.
      const gas = await signer.estimateGas(request);
      const fee = await ethers.provider.getFeeData();
      const gasPrice = fee.gasPrice;
      if (!gasPrice) throw new Error("RPC did not supply gas price");
      const gasLimit = gas * 12n / 10n;
      if (await ethers.provider.getBalance(wallet) < gasLimit * gasPrice) throw new Error(`Insufficient gas for ${name}`);
      const nonce = await ethers.provider.getTransactionCount(wallet, "pending");
      const txRequest = { ...request, chainId, nonce, gasLimit, gasPrice, type: 0 };
      if (signer instanceof Wallet) {
        const raw = await signer.signTransaction(txRequest);
        step = { hash: keccak256(raw), nonce, ...(deployment ? { address: getCreateAddress({ from: wallet, nonce }) } : {}) };
        journal.steps[name] = step;
        save(); // Hash/address persisted BEFORE sending; raw signature/key are never written.
        console.log(`${name}: broadcasting ${step.hash}; gas ceiling ${ethers.formatEther(gasLimit * gasPrice)} AVAX`);
        await ethers.provider.broadcastTransaction(raw);
      } else {
        // Disposable in-process Hardhat network only.
        const tx = await signer.sendTransaction(txRequest);
        step = { hash: tx.hash, nonce, ...(deployment ? { address: getCreateAddress({ from: wallet, nonce }) } : {}) };
        journal.steps[name] = step;
        save();
      }
    } else console.log(`${name}: checking existing transaction ${step.hash}`);
    const receipt = await receiptFor(step);
    step.confirmed = true;
    save();
    console.log(`${name}: confirmed block ${receipt.blockNumber}`);
    return receipt;
  }

  const contracts: Record<string, { address: string; deployTx: string; abi: unknown[] }> = {};
  for (const name of ["IdentityRegistry", "ReputationRegistry", "ValidationRegistry", "GrailLedger"]) {
    const factory = await ethers.getContractFactory(name, signer);
    const args = name === "IdentityRegistry" ? [] : [contracts.IdentityRegistry.address];
    const request = await factory.getDeployTransaction(...args);
    await send(name, request, true);
    const step = journal.steps[name];
    const address = step.address!;
    if (await ethers.provider.getCode(address) === "0x") throw new Error(`Missing code at ${address}`);
    const artifact = await hre.artifacts.readArtifact(name);
    contracts[name] = { address, deployTx: step.hash, abi: artifact.abi };
  }
  const identity = await ethers.getContractAt("IdentityRegistry", contracts.IdentityRegistry.address, signer);
  const metadata = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: agent.name, description: agent.description, active: true,
    supportedTrust: ["reputation", "validation"],
  };
  const agentURI = "data:application/json;base64," + Buffer.from(JSON.stringify(metadata)).toString("base64");
  const register = identity["register(string,(string,bytes)[])"];
  const request = await register.populateTransaction(agentURI, [
    { key: "name", value: toUtf8Bytes(agent.name) },
    { key: "description", value: toUtf8Bytes(agent.description) },
  ]);
  const registrationReceipt = await send("registerAgent", request);
  const registered = registrationReceipt.logs.map(log => {
    try { return identity.interface.parseLog(log); } catch { return null; }
  }).find(log => log?.name === "Registered");
  if (!registered) throw new Error("Registration event missing");
  const agentId = registered.args.agentId.toString();
  if ((await identity.ownerOf(agentId)).toLowerCase() !== wallet.toLowerCase()) throw new Error("Agent owner mismatch");
  const vector = testVector();
  const output = {
    network: isFuji ? "fuji" : "hardhat", chainId, explorer: "https://testnet.snowtrace.io",
    contractVersion: productConfig.contract_version, agentId, agentWallet: wallet,
    agentName: agent.name, registrationTx: registrationReceipt.hash, agentURI, contracts,
    testVector: { ...vector, commitHash: keccak256(concat([toUtf8Bytes(vector.payloadUtf8), vector.saltHex])) },
  };
  fs.writeFileSync(outputPath + ".tmp", JSON.stringify(output, null, 2) + "\n");
  fs.renameSync(outputPath + ".tmp", outputPath);
  console.log(`Agent ${agentId}; output ${path.relative(process.cwd(), outputPath)}`);
  console.log(`Ledger: https://testnet.snowtrace.io/address/${contracts.GrailLedger.address}`);
  console.log(`Remaining balance: ${ethers.formatEther(await ethers.provider.getBalance(wallet))} AVAX`);
}

main().catch(error => {
  // Never dump provider/config/wallet objects, which could contain credentials.
  console.error("Deploy stopped:", error.shortMessage || error.message || "unknown error");
  process.exitCode = 1;
});
