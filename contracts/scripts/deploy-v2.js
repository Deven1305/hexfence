// npx hardhat run scripts/deploy-v2.js --network sepolia
const { ethers } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw Error("Sepolia only");
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw Error("Existing testnet key required");
  const factory = await ethers.getContractFactory("HexFenceGuardV2");
  const gas = await ethers.provider.estimateGas({ ...await factory.getDeployTransaction(), from: deployer.address });
  const fees = await ethers.provider.getFeeData();
  const price = fees.maxFeePerGas ?? fees.gasPrice;
  if (!price || await ethers.provider.getBalance(deployer.address) < gas * price * 12n / 10n) throw Error("Insufficient existing balance");
  const guard = await factory.deploy(); await guard.waitForDeployment();
  if (!await guard.supportsInterface("0xe6d7a83a")) throw Error("Guard interface missing");
  const result = { chainId: 11155111, guard: guard.target, transactionHash: guard.deploymentTransaction().hash };
  fs.mkdirSync(path.join(__dirname, "../deployments"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "../deployments/v2-sepolia.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => { console.error("V2 deployment failed; check Sepolia configuration and existing balance. Provider details withheld."); process.exitCode = 1; });
