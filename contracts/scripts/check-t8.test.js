const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const { setupDemo, SINGLETON, FACTORY, P } = require('./setup-demo');
const { checkT8, parseOptions, innerRecipient, GUARD_SLOT } = require('./check-t8');
const fs = require('node:fs');
const { createServer } = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const L = '0x4E185a3FC4B530244aB9ed0dE38167b403344120';

describe('T8 checker against real local Safe contracts', function () {
  let signer, safe, opts, signature;
  async function payment(to, { data = '0x', value = 1n, safeTxGas = 0, gasLimit = 300000 } = {}) {
    const encoded = safe.interface.encodeFunctionData('execTransaction', [to, value, data, 0, safeTxGas, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, signature]);
    const tx = await signer.sendTransaction({ to: opts.safe, data: encoded, gasLimit });
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    expect(receipt).not.to.equal(null);
    return tx.hash;
  }
  beforeEach(async function () {
    await network.provider.send('hardhat_reset');
    [signer] = await ethers.getSigners();
    for (const [name, folder, address] of [['Safe', '', SINGLETON], ['SafeProxyFactory', 'proxies/', FACTORY]]) {
      const artifact = require(`@safe-global/safe-contracts/build/artifacts/contracts/${folder}${name}.sol/${name}.json`);
      const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer).deploy();
      await contract.waitForDeployment();
      await network.provider.send('hardhat_setCode', [address, await ethers.provider.getCode(await contract.getAddress())]);
    }
    const demo = await setupDemo({ provider: ethers.provider, signer, log() {} });
    const rows = Object.fromEntries(demo.rows);
    const [, b] = await ethers.getSigners();
    opts = { guard: demo.guardAddress, safe: demo.safeAddress, p: P, l: L, b: b.address,
      setguard: rows['setGuard tx'], approve: rows['approvePayee(P) tx'], remove: rows['Removal drill setGuard(0) tx'], reenable: rows['Removal drill re-enable tx'] };
    safe = await ethers.getContractAt('Safe', opts.safe);
    signature = ethers.solidityPacked(['uint256', 'uint256', 'uint8'], [BigInt(signer.address), 0, 1]);
    opts.lpay = await payment(L);
    opts.bpay = await payment(opts.b);
    opts.ppay = await payment(P);
  });
  async function failure(expected, input = opts, provider = ethers.provider) {
    let error; const lines = [];
    try { await checkT8(provider, input, l => lines.push(l)); } catch (e) { error = e; }
    expect(error, 'checker must reject').to.be.instanceOf(Error);
    expect(error.message).to.include(expected);
    return lines;
  }
  it('passes real setup/events/payments, replays L and prints pasteable rows without a signer', async function () {
    const lines = [];
    const rows = await checkT8(ethers.provider, opts, line => lines.push(line));
    expect(rows).to.have.length(13);
    expect(lines).to.include('Safe VERSION(): 1.4.1');
    expect(lines).to.include('L replay: LookalikeOfApprovedPayee(L, P)');
    const args = Object.entries(opts).flatMap(([name, value]) => ['--' + name, value]);
    expect(parseOptions(args)).to.deep.equal(opts);
    const source = fs.readFileSync(require.resolve('@safe-global/safe-contracts/contracts/base/GuardManager.sol'), 'utf8');
    expect(source).to.include('GUARD_STORAGE_SLOT = ' + GUARD_SLOT);
  });
  it('rejects a successful payment to the wrong inner recipient', async function () {
    await failure('decoded inner recipient does not match', { ...opts, bpay: opts.ppay });
  });
  it('rejects status 1 with Safe ExecutionFailure', async function () {
    const hash = await payment(opts.b, { value: ethers.parseEther('10'), safeTxGas: 100000 });
    expect((await ethers.provider.getTransactionReceipt(hash)).status).to.equal(1);
    await failure('Safe emitted ExecutionFailure', { ...opts, bpay: hash });
  });
  it('rejects an actually mined out-of-gas L transaction', async function () {
    const hash = await payment(L, { gasLimit: 30000 });
    const receipt = await ethers.provider.getTransactionReceipt(hash);
    expect(receipt.status).to.equal(0); expect(receipt.gasUsed).to.equal(30000n);
    await failure('gas exhausted', { ...opts, lpay: hash });
  });
  it('does not pass if the RPC cannot replay the real reverted L receipt', async function () {
    const provider = new Proxy(ethers.provider, { get(target, key) {
      if (key === 'send') return (method, args) => {
        if (method === 'eth_call' && args[1] !== 'latest') throw new Error('historical replay unavailable');
        return target.send(method, args);
      };
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    const lines = await failure('requires decoded LookalikeOfApprovedPayee', opts, provider);
    expect(lines).to.include('status 0, reason not decoded');
  });
  it('rejects a real status-0 L call that replays with a different Safe error', async function () {
    const [, other] = await ethers.getSigners();
    const data = (await ethers.provider.getTransaction(opts.lpay)).data;
    const tx = await other.sendTransaction({ to: opts.safe, data, gasLimit: 300000 });
    expect((await ethers.provider.getTransactionReceipt(tx.hash)).status).to.equal(0);
    const lines = await failure('requires decoded LookalikeOfApprovedPayee', { ...opts, lpay: tx.hash });
    expect(lines).to.include('status 0, reason not decoded');
  });
  it('runs the plain Node CLI over real local RPC with no private key and only read requests', async function () {
    this.timeout(15000);
    const methods = [];
    const server = createServer(async (request, response) => {
      let body = ''; for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body);
      async function rpc(p) {
        methods.push(p.method);
        try { return { jsonrpc: '2.0', id: p.id, result: await network.provider.send(p.method, p.params ?? []) }; }
        catch (e) { return { jsonrpc: '2.0', id: p.id, error: { code: e.code ?? -32000, message: e.message, data: e.data } }; }
      }
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(Array.isArray(payload) ? await Promise.all(payload.map(rpc)) : await rpc(payload)));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const result = await promisify(execFile)(process.execPath, [require.resolve('./check-t8'), ...Object.entries(opts).flatMap(([k, v]) => ['--' + k, v])], {
        env: { ...process.env, SEPOLIA_RPC_URL: `http://127.0.0.1:${server.address().port}`, DEPLOYER_PRIVATE_KEY: '', ARKIV_PRIVATE_KEY: '' },
      });
      expect(result.stdout).to.include('not checked: explorer evidence, H6 wallet flow');
      expect(result.stdout).to.include('| L payment (reverted) | ' + opts.lpay);
      expect(result.stderr).to.equal('');
      const allowed = new Set(['eth_chainId', 'eth_getCode', 'eth_call', 'eth_getStorageAt', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_blockNumber']);
      expect(methods.every(m => allowed.has(m))).to.equal(true);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  it('decodes actual ERC-20 transfer and transferFrom calldata, and rejects delegatecalls', async function () {
    const token = await (await ethers.getContractFactory('MockToken')).deploy();
    await token.waitForDeployment();
    await (await token.mint(opts.safe, 10)).wait();
    const hash = await payment(await token.getAddress(), { value: 0n, data: token.interface.encodeFunctionData('transfer', [P, 1]) });
    expect(innerRecipient((await ethers.provider.getTransaction(hash)).data)).to.equal(P);
    await checkT8(ethers.provider, { ...opts, ppay: hash }, () => {});
    const transferFrom = safe.interface.encodeFunctionData('execTransaction', [await token.getAddress(), 0, token.interface.encodeFunctionData('transferFrom', [signer.address, L, 1]), 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, signature]);
    expect(innerRecipient(transferFrom)).to.equal(L);
    const delegate = safe.interface.encodeFunctionData('execTransaction', [P, 0, '0x', 1, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, signature]);
    expect(innerRecipient(delegate)).to.equal(null);
  });
});
