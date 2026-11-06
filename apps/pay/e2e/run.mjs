// Scripted-wallet test harness. All contracts, signatures, calls and receipts are real.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { build, preview } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const req = createRequire(path.join(root, 'contracts/package.json'));
process.env.HARDHAT_CONFIG = path.join(here, 'hardhat.cjs');
const hre = req('hardhat');
const { ethers } = hre;
await hre.run('compile');
const owner = ethers.Wallet.createRandom().connect(ethers.provider);
await hre.network.provider.send('hardhat_setBalance', [owner.address, ethers.toBeHex(ethers.parseEther('100'))]);
// Copy deployed runtime of the real Safe 1.4.1 artifacts to the canonical Sepolia addresses.
const kitReq = createRequire(import.meta.resolve('@safe-global/protocol-kit'));
const deployments = kitReq('@safe-global/safe-deployments');
for (const [name, getter] of [
  ['Safe', 'getSafeSingletonDeployment'], ['SafeL2', 'getSafeL2SingletonDeployment'],
  ['SafeProxyFactory', 'getProxyFactoryDeployment'], ['CompatibilityFallbackHandler', 'getCompatibilityFallbackHandlerDeployment'],
  ['MultiSend', 'getMultiSendDeployment'], ['MultiSendCallOnly', 'getMultiSendCallOnlyDeployment'],
]) {
  const deployment = deployments[getter]({ version: '1.4.1', network: '11155111' });
  if (!deployment) throw new Error(`Missing canonical deployment: ${name}`);
  const folder = ['Safe', 'SafeL2'].includes(name) ? '' : name === 'SafeProxyFactory' ? 'proxies/' : name === 'CompatibilityFallbackHandler' ? 'handler/' : 'libraries/';
  const artifact = req(`@safe-global/safe-contracts/build/artifacts/contracts/${folder}${name}.sol/${name}.json`);
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner).deploy();
  await contract.waitForDeployment();
  const runtime = await ethers.provider.getCode(await contract.getAddress());
  for (const address of new Set(Object.values(deployment.deployments).map(d => d.address))) {
    await hre.network.provider.send('hardhat_setCode', [address, runtime]);
  }
}
const singleton = deployments.getSafeSingletonDeployment({ version: '1.4.1', network: '11155111' }).networkAddresses['11155111'];
const factoryAddr = deployments.getProxyFactoryDeployment({ version: '1.4.1', network: '11155111' }).networkAddresses['11155111'];
const factory = await ethers.getContractAt('SafeProxyFactory', factoryAddr, owner);
const safeInterface = (await ethers.getContractFactory('Safe', owner)).interface;
async function makeSafe(salt) {
  const init = safeInterface.encodeFunctionData('setup', [[owner.address], 1, ethers.ZeroAddress, '0x', ethers.ZeroAddress, ethers.ZeroAddress, 0, ethers.ZeroAddress]);
  const receipt = await (await factory.createProxyWithNonce(singleton, init, salt)).wait();
  const event = receipt.logs.map(l => { try { return factory.interface.parseLog(l); } catch {} }).find(e => e?.name === 'ProxyCreation');
  return ethers.getContractAt('Safe', event.args.proxy, owner);
}
const safe = await makeSafe(1);
const unguarded = await makeSafe(2);
const guard = await (await ethers.getContractFactory('HexFenceGuard', owner)).deploy();
await guard.waitForDeployment();
const P = '0x4E185e251Ac7fB83E9DE10723EAda46cadE74120';
const L = '0x4E185a3FC4B530244aB9ed0dE38167b403344120';
const B = ethers.Wallet.createRandom().address;
const signature = ethers.solidityPacked(['uint256', 'uint256', 'uint8'], [BigInt(owner.address), 0, 1]);
async function exec(to, data) {
  await (await safe.execTransaction(to, 0, data, 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, signature)).wait();
}
await exec(await safe.getAddress(), safe.interface.encodeFunctionData('setGuard', [await guard.getAddress()]));
await exec(await guard.getAddress(), guard.interface.encodeFunctionData('approvePayee', [P]));
await (await owner.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1') })).wait();
const calls = [];
const sent = [];
const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (request.method === 'OPTIONS') { response.end(); return; }
  let body = ''; for await (const chunk of request) body += chunk;
  try {
    const payload = JSON.parse(body);
    async function rpc(p) {
      try {
        if (p.method === 'e2e_calls') return { id: p.id, jsonrpc: '2.0', result: { calls, sent } };
        if (p.method === 'e2e_wallet') {
          const { method, params = [] } = p.params[0];
          let result;
          if (['eth_accounts', 'eth_requestAccounts'].includes(method)) result = [owner.address];
          else if (method === 'eth_signTypedData_v4') {
            const typed = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
            delete typed.types.EIP712Domain;
            result = await owner.signTypedData(typed.domain, typed.types, typed.message);
          } else if (method === 'personal_sign') result = await owner.signMessage(ethers.getBytes(params[0]));
          else if (method === 'eth_sendTransaction') {
            const { from, gas, ...tx } = params[0];
            const sentTx = await owner.sendTransaction({ ...tx, ...(gas ? { gasLimit: gas } : {}) });
            sent.push({ hash: sentTx.hash, gasLimit: sentTx.gasLimit.toString() }); result = sentTx.hash;
          } else result = await hre.network.provider.send(method, params);
          return { id: p.id, jsonrpc: '2.0', result };
        }
        calls.push({ method: p.method, params: p.params });
        return { id: p.id, jsonrpc: '2.0', result: await hre.network.provider.send(p.method, p.params ?? []) };
      } catch (e) { return { id: p.id, jsonrpc: '2.0', error: { code: e.code ?? -32000, message: e.message, data: e.data } }; }
    }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(Array.isArray(payload) ? await Promise.all(payload.map(rpc)) : await rpc(payload)));
  } catch { response.writeHead(400).end(); }
});
await new Promise(resolve => server.listen(18545, '127.0.0.1', resolve));
process.env.VITE_GUARD_ADDRESS = await guard.getAddress();
process.env.VITE_SEPOLIA_RPC_URL = 'http://127.0.0.1:18545';
process.env.VITE_ARKIV_PUBLISHER = '';
process.env.VITE_MAINNET_RPC_URL = '';
await writeFile(path.join(here, '.fixture.json'), JSON.stringify({ safe: await safe.getAddress(), unguarded: await unguarded.getAddress(), guard: await guard.getAddress(), P, L, B }));
let web;
try {
  const testBuild = { outDir: path.join(here, '.build'), emptyOutDir: true };
  await build({ root: path.resolve(here, '..'), build: testBuild, plugins: [{
    name: 'test-only-unsupported-call-ingress',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/apps/pay/src/main.ts')) return;
      return code + `\nwindow.addEventListener('e2e:call', (event) => {
        const call = { ...event.detail, value: BigInt(event.detail.value) };
        const verdict = paymentVerdict(call, state.info, state.config.guard);
        const out = document.createElement('div'); app.append(out);
        renderVerdict(out, verdict, call.to, call);
      });`;
    },
  }] });
  web = await preview({ root: path.resolve(here, '..'), build: testBuild, preview: { host: '127.0.0.1', port: 14173, strictPort: true } });
  const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('@playwright/test')));
  const child = spawn(process.execPath, [cli, 'test', '--config', path.join(here, 'playwright.config.ts')], { stdio: 'inherit' });
  process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)));
} finally { web?.httpServer.close(); server.close(); }

