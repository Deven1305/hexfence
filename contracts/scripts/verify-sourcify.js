// Keyless fallback for Hardhat 2's verifier, whose Sourcify v1 endpoint was retired.
// Official API: https://docs.sourcify.dev/docs/api/
// Usage from contracts/: node scripts/verify-sourcify.js ADDRESS CREATION_TX_HASH
const hre = require('hardhat');
const { ethers } = require('ethers');

async function main() {
  const [address, creationTransactionHash] = process.argv.slice(2);
  if (!ethers.isAddress(address) || !ethers.isHexString(creationTransactionHash, 32)) {
    throw new Error('Usage: node scripts/verify-sourcify.js ADDRESS CREATION_TX_HASH');
  }
  const contractIdentifier = 'contracts/HexFenceGuard.sol:HexFenceGuard';
  const info = await hre.artifacts.getBuildInfo(contractIdentifier);
  if (!info) throw new Error('Compile the Guard first');
  const headers = { 'Content-Type': 'application/json',
    'User-Agent': 'HexFence/1.0 (https://github.com/Deven1305/hexfence)' };
  async function request(url, options = {}) {
    const response = await fetch('https://sourcify.dev/server' + url, { headers, ...options });
    const result = await response.json();
    if (response.status === 409 && result.customCode === 'already_verified') {
      return request(`/v2/contract/11155111/${address}`);
    }
    if (!response.ok) throw new Error(`Sourcify HTTP ${response.status}: ${JSON.stringify(result)}`);
    return result;
  }
  const job = await request(`/v2/verify/11155111/${address}`, {
    method: 'POST', body: JSON.stringify({ stdJsonInput: info.input,
      compilerVersion: info.solcLongVersion, contractIdentifier, creationTransactionHash }),
  });
  if (job.runtimeMatch && job.creationMatch) {
    console.log(JSON.stringify(job, null, 2));
    return;
  }
  console.log('Sourcify verification job:', job.verificationId);
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = await request(`/v2/verify/${job.verificationId}`);
    if (result.isJobCompleted) {
      console.log(JSON.stringify(result, null, 2));
      if (!result.contract?.runtimeMatch || !result.contract?.creationMatch) process.exitCode = 1;
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error('Verification still pending; poll the public job ID');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
