// Creates a NEW isolated 1-of-1 Safe, with no funding or payment transfers.
// npx hardhat run scripts/setup-v2.js --network sepolia
const { ethers, artifacts } = require("hardhat");
const { getSafeSingletonDeployment, getProxyFactoryDeployment } = require("@safe-global/safe-deployments");
const fs = require("node:fs");
const path = require("node:path");
const Z = ethers.ZeroAddress;
const SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw Error("Sepolia only");
  const [owner] = await ethers.getSigners();
  if (!owner) throw Error("Existing testnet key required");
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "../deployments/v2-sepolia.json"), "utf8"));
  const guard = await ethers.getContractAt("HexFenceGuardV2", deployment.guard);
  const expected = await artifacts.readArtifact("HexFenceGuardV2");
  if (await ethers.provider.getCode(guard.target) !== expected.deployedBytecode) throw Error("V2 runtime differs from compiled artifact");
  const filter = { version: "1.4.1", network: "11155111" };
  const singletonInfo = getSafeSingletonDeployment(filter);
  const factoryInfo = getProxyFactoryDeployment(filter);
  if (!singletonInfo || !factoryInfo) throw Error("Official Safe 1.4.1 deployment unavailable");
  const singletonAddress = singletonInfo.networkAddresses[filter.network];
  const factoryAddress = factoryInfo.networkAddresses[filter.network];
  for (const [address, info] of [[singletonAddress, singletonInfo], [factoryAddress, factoryInfo]]) {
    const codeHash = ethers.keccak256(await ethers.provider.getCode(address));
    if (!Object.values(info.deployments).some(d => d.address.toLowerCase() === address.toLowerCase() && d.codeHash.toLowerCase() === codeHash.toLowerCase()))
      throw Error("Official deployment runtime hash mismatch");
  }
  const singleton = await ethers.getContractAt("Safe", singletonAddress);
  if (await singleton.VERSION() !== "1.4.1") throw Error("Expected Safe 1.4.1");
  const factory = await ethers.getContractAt("SafeProxyFactory", factoryAddress);
  const init = singleton.interface.encodeFunctionData("setup", [[owner.address], 1, Z, "0x", Z, Z, 0, Z]);
  const saltNonce = BigInt(ethers.id(`HexFenceGuardV2:${guard.target}`));
  const salt = ethers.keccak256(ethers.solidityPacked(["bytes32", "uint256"], [ethers.keccak256(init), saltNonce]));
  const creation = ethers.concat([await factory.proxyCreationCode(), ethers.zeroPadValue(singletonAddress, 32)]);
  const predicted = ethers.getCreate2Address(factoryAddress, salt, ethers.keccak256(creation));
  if (await ethers.provider.getCode(predicted) !== "0x") throw Error("Isolated V2 Safe already exists; refusing to change an existing Safe");
  const receipt = await (await factory.createProxyWithNonce(singletonAddress, init, saltNonce)).wait();
  const safe = await ethers.getContractAt("Safe", predicted);
  if (await safe.getThreshold() !== 1n || (await safe.getOwners()).length !== 1 || !(await safe.isOwner(owner.address))) throw Error("Expected isolated 1-of-1 Safe");
  const signature = ethers.solidityPacked(["uint256", "uint256", "uint8"], [BigInt(owner.address), 0, 1]);
  const transactions = { createSafe: receipt.hash };
  async function exec(label, to, data) {
    const rc = await (await safe.execTransaction(to, 0, data, 0, 0, 0, 0, Z, Z, signature)).wait();
    if (rc.status !== 1) throw Error("Safe setup execution failed");
    transactions[label] = rc.hash;
  }
  await exec("setGuard", safe.target, safe.interface.encodeFunctionData("setGuard", [guard.target]));
  await exec("enableAutoLearn", guard.target, guard.interface.encodeFunctionData("setAutoLearn", [true]));
  await exec("removeGuard", safe.target, safe.interface.encodeFunctionData("setGuard", [Z]));
  if (BigInt(await ethers.provider.getStorage(safe.target, SLOT)) !== 0n) throw Error("Removal drill failed");
  await exec("restoreGuard", safe.target, safe.interface.encodeFunctionData("setGuard", [guard.target]));
  if (ethers.getAddress("0x" + (await ethers.provider.getStorage(safe.target, SLOT)).slice(-40)) !== guard.target) throw Error("Guard restoration failed");
  const result = { chainId: 11155111, guard: guard.target, safe: safe.target, version: await safe.VERSION(), owner: owner.address,
    autoLearn: await guard.autoLearn(safe.target), known: Array.from(await guard.knownRecipients(safe.target)), transactions,
    balanceWei: String(await ethers.provider.getBalance(safe.target)), fundingPerformed: false,
    paymentDemo: "not run; no fund transfers authorized" };
  fs.writeFileSync(path.join(__dirname, "../deployments/v2-safe-sepolia.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => { console.error("Isolated V2 setup failed; check official deployments, configuration and existing balance. No Safe funding is performed. Provider details withheld."); process.exitCode = 1; });
