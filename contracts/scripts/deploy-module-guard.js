// npx hardhat run scripts/deploy-module-guard.js --network sepolia
const { ethers } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
const v2 = require("../deployments/v2-sepolia.json");
async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw Error("Sepolia only");
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw Error("Existing testnet key required");
  const factory = await ethers.getContractFactory("HexFenceModuleGuard");
  const gas = await ethers.provider.estimateGas({ ...await factory.getDeployTransaction(v2.guard), from: deployer.address });
  const fees = await ethers.provider.getFeeData();
  const price = fees.maxFeePerGas ?? fees.gasPrice;
  if (!price || await ethers.provider.getBalance(deployer.address) < gas * price * 12n / 10n) throw Error("Insufficient existing balance");
  const moduleGuard = await factory.deploy(v2.guard); await moduleGuard.waitForDeployment();
  if (!await moduleGuard.supportsInterface("0x58401ed8")) throw Error("Module guard interface missing");
  const result = { chainId: 11155111, moduleGuard: moduleGuard.target, v2Guard: v2.guard, transactionHash: moduleGuard.deploymentTransaction().hash };
  fs.writeFileSync(path.join(__dirname, "../deployments/module-guard-sepolia.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => { console.error("Module guard deployment failed; check Sepolia configuration and existing balance. Provider details withheld."); process.exitCode = 1; });
