// npx hardhat run scripts/deploy.js --network sepolia
// Deploys HexFenceGuard (no constructor args, no owner). Testnet only.
const { ethers, network } = require("hardhat");

const SEPOLIA = 11155111n;

async function main() {
  // Refuse anything but Sepolia, so a mis-set RPC URL can never deploy to mainnet by accident.
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== SEPOLIA) throw new Error(`refusing to deploy: chain ${chainId} (${network.name}) is not Sepolia`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const guard = await ethers.deployContract("HexFenceGuard");
  const tx = guard.deploymentTransaction();
  await guard.waitForDeployment();
  const address = await guard.getAddress();

  // Sanity-check the live contract: Safe's setGuard() reverts GS300 unless this returns true.
  if (!(await guard.supportsInterface("0xe6d7a83a"))) throw new Error("deployed guard does not report the Guard interface");

  console.log("HexFenceGuard deployed at:", address);
  console.log("Deploy tx:", tx.hash);
  console.log(`Etherscan: https://sepolia.etherscan.io/address/${address}`);
  console.log("Next: in Safe{Wallet} Transaction Builder, call setGuard(<this address>) on your demo Safe (one call per transaction).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
