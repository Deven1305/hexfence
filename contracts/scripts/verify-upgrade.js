// Public source verification using Sourcify v2. No signing key needed.
// node scripts/verify-upgrade.js HexFenceAlerts ADDRESS CREATION_TX
// Official API: https://docs.sourcify.dev/docs/api/
const hre = require("hardhat");
const { ethers } = require("ethers");
async function main() {
  const [name, address, creationTransactionHash] = process.argv.slice(2);
  if (!["HexFenceAlerts", "HexFenceGuardV2"].includes(name) || !ethers.isAddress(address) || !ethers.isHexString(creationTransactionHash, 32))
    throw Error("Usage: node scripts/verify-upgrade.js HexFenceAlerts|HexFenceGuardV2 ADDRESS CREATION_TX");
  const contractIdentifier = `contracts/${name}.sol:${name}`;
  const info = await hre.artifacts.getBuildInfo(contractIdentifier);
  if (!info) throw Error("Compile the contract first");
  async function request(path, options = {}) {
    const response = await fetch(`https://sourcify.dev/server${path}`, {
      ...options, headers: { "Content-Type": "application/json", "User-Agent": "HexFence/2.0" },
    });
    const result = await response.json();
    if (response.status === 409) return request(`/v2/contract/11155111/${address}`);
    if (!response.ok) throw Error(`Sourcify HTTP ${response.status}`);
    return result;
  }
  const job = await request(`/v2/verify/11155111/${address}`, {
    method: "POST", body: JSON.stringify({ stdJsonInput: info.input, compilerVersion: info.solcLongVersion.replace(/\.Emscripten\.clang$/, ""), contractIdentifier, creationTransactionHash }),
  });
  if (job.runtimeMatch && job.creationMatch) { console.log(JSON.stringify(job)); return; }
  console.log("Sourcify job:", job.verificationId);
  for (let i = 0; i < 40; i++) {
    const result = await request(`/v2/verify/${job.verificationId}`);
    if (result.isJobCompleted) {
      console.log(JSON.stringify({ verificationId: result.verificationId, contract: result.contract, error: result.error?.message }));
      if (!result.contract?.runtimeMatch || !result.contract?.creationMatch) process.exitCode = 1;
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw Error("Verification pending; poll the public job ID");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
