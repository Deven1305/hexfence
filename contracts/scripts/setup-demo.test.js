// Local-chain tests only; generated wallets never leave this process.
const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const { setupDemo, demoErrorMessage, SINGLETON, FACTORY, P, GUARD_SLOT, MIN_BALANCE } = require('./setup-demo');

describe('setup-demo local chain', function () {
  let signer;
  beforeEach(async function () {
    await network.provider.send('hardhat_reset');
    [signer] = await ethers.getSigners();
    for (const [name, folder, address] of [['Safe', '', SINGLETON], ['SafeProxyFactory', 'proxies/', FACTORY]]) {
      const artifact = require(`@safe-global/safe-contracts/build/artifacts/contracts/${folder}${name}.sol/${name}.json`);
      const deployed = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer).deploy();
      await deployed.waitForDeployment();
      await network.provider.send('hardhat_setCode', [address, await ethers.provider.getCode(await deployed.getAddress())]);
    }
  });
  function provider() { return ethers.provider; }
  it('deploys, funds, configures, drills removal, and reuses supplied addresses without funding twice', async function () {
    const lines = [];
    const first = await setupDemo({ provider: provider(), signer, log: line => lines.push(line) });
    const guard = await ethers.getContractAt('HexFenceGuard', first.guardAddress);
    const safe = await ethers.getContractAt('Safe', first.safeAddress);
    expect(await safe.VERSION()).to.equal('1.4.1');
    expect(await safe.getOwners()).to.deep.equal([signer.address]);
    expect(await safe.getThreshold()).to.equal(1n);
    expect(await guard.payees(first.safeAddress)).to.deep.equal([P]);
    expect(await ethers.provider.getBalance(first.safeAddress)).to.equal(MIN_BALANCE);
    const rerun = await setupDemo({ provider: provider(), signer, ...first, log: line => lines.push(line) });
    expect(rerun.rows.map(r => r[0])).not.to.include.members(['Guard deployment tx', 'Safe creation tx', 'Safe funding tx', 'setGuard tx', 'approvePayee(P) tx']);
    expect(rerun.rows.filter(r => r[0].startsWith('Removal drill'))).to.have.length(2);
    expect(ethers.getAddress('0x' + (await ethers.provider.getStorage(first.safeAddress, GUARD_SLOT)).slice(-40))).to.equal(first.guardAddress);
    // Without DEMO_SAFE_ADDRESS the deterministic factory salt still reuses the existing Safe.
    const predicted = await setupDemo({ provider: provider(), signer, guardAddress: first.guardAddress, log() {} });
    expect(predicted.safeAddress).to.equal(first.safeAddress);
    expect(predicted.rows.map(r => r[0])).not.to.include('Safe creation tx');
    expect(lines).to.include("The deployer key is this Safe's only owner. The Pay wallet must use that same testnet-only key.");
    for (const line of lines.filter(line => line.startsWith('|'))) expect(line).to.match(/^\| [^|]+ \| (0x[0-9a-fA-F]{40}|0x[0-9a-fA-F]{64}|1\.4\.1) \|$/);
  });
  it('refuses a non-Sepolia RPC before spending', async function () {
    let error;
    try { await setupDemo({ provider: { getNetwork: async () => ({ chainId: 1n }) }, signer, log() {} }); } catch (e) { error = e; }
    expect(error.message).to.include('Only Sepolia');
    expect(demoErrorMessage(error)).to.equal('Only Sepolia chain ID 11155111 is allowed');
  });
  it('hides provider errors even when their messages contain an RPC URL', async function () {
    let error;
    try {
      await setupDemo({ provider: { getNetwork: async () => { throw new Error('request failed at https://rpc.invalid/private-path'); } }, signer, log() {} });
    } catch (e) { error = e; }
    expect(demoErrorMessage(error)).to.equal('Demo setup failed. Check the root .env, Sepolia funds and supplied contract addresses.');
    expect(demoErrorMessage(error)).not.to.include('rpc.invalid');
  });
  it('refuses missing supplied Guard and wrong Safe owner', async function () {
    let error;
    try { await setupDemo({ provider: provider(), signer, guardAddress: ethers.Wallet.createRandom().address, log() {} }); } catch (e) { error = e; }
    expect(error.message).to.include('no code');
    const first = await setupDemo({ provider: provider(), signer, log() {} });
    const [, other] = await ethers.getSigners();
    try { await setupDemo({ provider: provider(), signer: other, safeAddress: first.safeAddress, guardAddress: first.guardAddress, log() {} }); } catch (e) { error = e; }
    expect(error.message).to.include('owned by the deployer');
  });
});
