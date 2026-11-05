// npx hardhat run scripts/deploy.js --network sepolia
const { ethers } = require("hardhat");
async function main() {
  const guard = await ethers.deployContract("HexFenceGuard");
  await guard.waitForDeployment();
  console.log("HexFenceGuard deployed at:", await guard.getAddress());
  console.log("Next: in Safe{Wallet} Transaction Builder, call setGuard(<this address>) on your demo Safe (one call per transaction).");
}
main().catch((e) => { console.error(e); process.exit(1); });
