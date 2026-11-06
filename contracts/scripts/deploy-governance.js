// npx hardhat run scripts/deploy-governance.js --network sepolia
const { ethers } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw Error("Sepolia only");
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw Error("Existing testnet key required");
  const factory = await ethers.getContractFactory("HexFenceGovernanceGuardV2");
  const gas = await ethers.provider.estimateGas({ ...await factory.getDeployTransaction(), from: deployer.address });
  const fees = await ethers.provider.getFeeData();
  const price = fees.maxFeePerGas ?? fees.gasPrice;
  if (!price || await ethers.provider.getBalance(deployer.address) < gas * price * 12n / 10n) throw Error("Insufficient existing balance");
  const guard = await factory.deploy();
  // Public transaction information supports recovery if a later RPC call fails.
  console.log(JSON.stringify({ status: "submitted", guard: guard.target, transactionHash: guard.deploymentTransaction().hash }));
  const receipt = await guard.deploymentTransaction().wait();
  const result = { chainId: 11155111, contract: "HexFenceGovernanceGuardV2", guard: guard.target, transactionHash: receipt.hash, blockNumber: receipt.blockNumber, runtimeCodeHash: ethers.keccak256(await ethers.provider.getCode(guard.target)) };
  fs.mkdirSync(path.join(__dirname, "../deployments"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "../deployments/governance-sepolia.json"), JSON.stringify(result, null, 2) + "\n");
  if (!await guard.supportsInterface("0xe6d7a83a")) throw Error("Guard interface missing");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => { console.error("Governance deployment failed; check Sepolia configuration and existing balance. Provider details withheld."); process.exitCode = 1; });
