// Run from contracts: npx hardhat run scripts/deploy-alerts.js --network sepolia
const { ethers } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
// Official simulation forwarder directory, checked 06 Nov 2026:
// https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts
const FORWARDER = "0x15fC6ae953E024d975e77382eEeC56A9101f9F88";
async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw Error("Sepolia only");
  if (await ethers.provider.getCode(FORWARDER) === "0x") throw Error("Simulation forwarder has no code");
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw Error("Existing testnet deployer key required");
  const factory = await ethers.getContractFactory("HexFenceAlerts");
  const tx = await factory.getDeployTransaction(FORWARDER);
  const gas = await ethers.provider.estimateGas({ ...tx, from: deployer.address });
  const fees = await ethers.provider.getFeeData();
  const price = fees.maxFeePerGas ?? fees.gasPrice;
  if (!price || await ethers.provider.getBalance(deployer.address) < gas * price * 12n / 10n)
    throw Error("Insufficient existing Sepolia balance; do not request a faucet");
  const alerts = await factory.deploy(FORWARDER);
  await alerts.waitForDeployment();
  const address = await alerts.getAddress();
  const receipt = await alerts.deploymentTransaction().wait();
  const result = { chainId: 11155111, address, forwarder: FORWARDER, mode: "simulation", transactionHash: receipt.hash };
  fs.mkdirSync(path.join(__dirname, "../../sentinel/deployments"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "../../sentinel/deployments/sepolia.json"), JSON.stringify(result, null, 2) + "\n");
  const config = {
    chainSelectorName: "ethereum-testnet-sepolia", guardVersion: "v1",
    guard: process.env.SENTINEL_GUARD_ADDRESS, alerts: address,
    safes: [process.env.SENTINEL_SAFE_ADDRESS],
    tokens: [{ address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 }],
    telegram: { enabled: false, chatId: "" }, notificationGapBlocks: 300,
  };
  if (config.guard && config.safes[0]) fs.writeFileSync(path.join(__dirname, "../../sentinel/hexfence-sentinel/config.json"), JSON.stringify(config, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => { console.error("Alerts deployment failed; check Sepolia configuration, code and existing balance. Provider errors withheld to avoid exposing credentials."); process.exitCode = 1; });
