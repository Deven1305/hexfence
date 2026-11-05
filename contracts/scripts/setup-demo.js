// Run from contracts/: node scripts/setup-demo.js
// Only public values and fixed operational guidance are logged.
const path = require('node:path');
const hre = require('hardhat');
const { ethers } = hre;
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Safe's official v1.4.1 Sepolia deployments (safe-global/safe-deployments).
const SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a';
const FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';
const P = '0x4E185e251Ac7fB83E9DE10723EAda46cadE74120';
const GUARD_SLOT = '0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8';
const MIN_BALANCE = ethers.parseEther('0.002');

class DemoSetupError extends Error {}
function demoErrorMessage(error) {
  return error instanceof DemoSetupError
    ? error.message
    : 'Demo setup failed. Check the root .env, Sepolia funds and supplied contract addresses.';
}

async function setupDemo({ provider, signer, guardAddress, safeAddress, log = console.log }) {
  if ((await provider.getNetwork()).chainId !== 11155111n) throw new DemoSetupError('Only Sepolia chain ID 11155111 is allowed');
  const owner = await signer.getAddress();
  const rows = [];
  const record = (label, value) => { rows.push([label, value]); log(`| ${label} | ${value} |`); };
  async function requireCode(address) {
    if ((await provider.getCode(address)) === '0x') throw new DemoSetupError('Required contract has no code');
  }
  const safeAbi = (await hre.artifacts.readArtifact('Safe')).abi;
  const guardArtifact = await hre.artifacts.readArtifact('HexFenceGuard');
  // Validate a supplied Safe before spending anything or changing its configuration.
  let safe;
  if (safeAddress) {
    safeAddress = ethers.getAddress(safeAddress);
    await requireCode(safeAddress);
    safe = new ethers.Contract(safeAddress, safeAbi, signer);
    if (await safe.VERSION() !== '1.4.1') throw new DemoSetupError('Expected Safe VERSION 1.4.1');
    const owners = await safe.getOwners();
    if (await safe.getThreshold() !== 1n || owners.length !== 1 || owners[0].toLowerCase() !== owner.toLowerCase()) {
      throw new DemoSetupError('Expected a 1-of-1 Safe owned by the deployer');
    }
  }
  let guard;
  if (guardAddress) {
    guardAddress = ethers.getAddress(guardAddress);
    await requireCode(guardAddress);
    // A compatible-but-different Guard must not silently be accepted as HexFenceGuard.
    if ((await provider.getCode(guardAddress)).toLowerCase() !== guardArtifact.deployedBytecode.toLowerCase()) {
      throw new DemoSetupError('Supplied Guard bytecode differs from the compiled HexFenceGuard');
    }
    guard = new ethers.Contract(guardAddress, guardArtifact.abi, signer);
  } else {
    guard = await new ethers.ContractFactory(guardArtifact.abi, guardArtifact.bytecode, signer).deploy();
    await guard.waitForDeployment();
    guardAddress = await guard.getAddress();
    record('Guard deployment tx', guard.deploymentTransaction().hash);
  }
  if (!(await guard.supportsInterface('0xe6d7a83a'))) throw new DemoSetupError('Guard interface check failed');
  record('HexFenceGuard (Sepolia)', guardAddress);
  if (!safe) {
    await requireCode(SINGLETON); await requireCode(FACTORY);
    const singleton = new ethers.Contract(SINGLETON, safeAbi, signer);
    if (await singleton.VERSION() !== '1.4.1') throw new DemoSetupError('Expected singleton VERSION 1.4.1');
    const factory = new ethers.Contract(FACTORY, (await hre.artifacts.readArtifact('SafeProxyFactory')).abi, signer);
    const init = singleton.interface.encodeFunctionData('setup', [[owner], 1, ethers.ZeroAddress, '0x', ethers.ZeroAddress, ethers.ZeroAddress, 0, ethers.ZeroAddress]);
    // Deterministic per owner: re-runs also reuse the Safe if its address was not supplied.
    const saltNonce = BigInt(owner);
    const salt = ethers.keccak256(ethers.solidityPacked(['bytes32', 'uint256'], [ethers.keccak256(init), saltNonce]));
    const deployment = ethers.concat([await factory.proxyCreationCode(), ethers.zeroPadValue(SINGLETON, 32)]);
    safeAddress = ethers.getCreate2Address(FACTORY, salt, ethers.keccak256(deployment));
    if ((await provider.getCode(safeAddress)) === '0x') {
      const tx = await factory.createProxyWithNonce(SINGLETON, init, saltNonce);
      await tx.wait(); record('Safe creation tx', tx.hash);
    }
    safe = new ethers.Contract(safeAddress, safeAbi, signer);
  }
  record('Demo Safe', safeAddress);
  if (await safe.VERSION() !== '1.4.1') throw new DemoSetupError('Expected Safe VERSION 1.4.1');
  const owners = await safe.getOwners();
  if (await safe.getThreshold() !== 1n || owners.length !== 1 || owners[0].toLowerCase() !== owner.toLowerCase()) throw new DemoSetupError('Expected a 1-of-1 Safe owned by the deployer');
  record('VERSION()', await safe.VERSION());
  record('Deployer / sole owner', owner);
  log('The deployer key is this Safe\'s only owner. The Pay wallet must use that same testnet-only key.');
  record('Approved payee P (synthetic recipient)', P);
  async function currentGuard() { return ethers.getAddress('0x' + (await provider.getStorage(safeAddress, GUARD_SLOT)).slice(-40)); }
  const current = await currentGuard();
  if (current !== ethers.ZeroAddress && current.toLowerCase() !== guardAddress.toLowerCase()) throw new DemoSetupError('Safe has a different Guard; supply its address explicitly');
  // Top up to a small target, rather than sending another fixed amount on each run.
  const balance = await provider.getBalance(safeAddress);
  if (balance < MIN_BALANCE) {
    const tx = await signer.sendTransaction({ to: safeAddress, value: MIN_BALANCE - balance });
    await tx.wait(); record('Safe funding tx', tx.hash);
  }
  // Safe's documented prevalidated signature: msg.sender is the one owner (v=1).
  const signature = ethers.solidityPacked(['uint256', 'uint256', 'uint8'], [BigInt(owner), 0, 1]);
  async function exec(label, to, data) {
    const tx = await safe.execTransaction(to, 0, data, 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, signature);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new DemoSetupError('Safe transaction failed');
    record(label, tx.hash);
  }
  if (current === ethers.ZeroAddress) await exec('setGuard tx', safeAddress, safe.interface.encodeFunctionData('setGuard', [guardAddress]));
  const payees = await guard.payees(safeAddress);
  if (!payees.some(a => a.toLowerCase() === P.toLowerCase())) await exec('approvePayee(P) tx', guardAddress, guard.interface.encodeFunctionData('approvePayee', [P]));
  await exec('Removal drill setGuard(0) tx', safeAddress, safe.interface.encodeFunctionData('setGuard', [ethers.ZeroAddress]));
  if (await currentGuard() !== ethers.ZeroAddress) throw new DemoSetupError('Removal drill did not clear Guard');
  await exec('Removal drill re-enable tx', safeAddress, safe.interface.encodeFunctionData('setGuard', [guardAddress]));
  if ((await currentGuard()).toLowerCase() !== guardAddress.toLowerCase()) throw new DemoSetupError('Removal drill did not restore Guard');
  return { guardAddress, safeAddress, rows };
}

async function main() {
  const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, VITE_GUARD_ADDRESS, DEMO_SAFE_ADDRESS } = process.env;
  if (!SEPOLIA_RPC_URL || !DEPLOYER_PRIVATE_KEY) throw new DemoSetupError('Root .env needs SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY');
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL, undefined, { cacheTimeout: -1, pollingInterval: 100 });
  const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  try {
    if ((await provider.getNetwork()).chainId !== 11155111n) throw new DemoSetupError('Only Sepolia is allowed');
    await hre.run('compile');
    await setupDemo({ provider, signer, guardAddress: VITE_GUARD_ADDRESS, safeAddress: DEMO_SAFE_ADDRESS });
  } finally { provider.destroy(); }
}
module.exports = { setupDemo, demoErrorMessage, SINGLETON, FACTORY, P, GUARD_SLOT, MIN_BALANCE };
if (require.main === module) main().catch((error) => {
  // Provider errors may contain credentials in URLs or request objects. Never dump them.
  console.error(demoErrorMessage(error));
  process.exitCode = 1;
});
