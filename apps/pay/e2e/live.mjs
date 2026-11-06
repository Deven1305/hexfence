// Real Sepolia operator harness. This SCRIPTED wallet is not H6 or Safe{Wallet}.
// The private key stays in Node; the browser receives only accounts/signatures/hashes.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { build, preview } from 'vite';
import { chromium, expect } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const req = createRequire(path.join(root, 'contracts/package.json'));
const { ethers } = req('ethers');
const env = req('dotenv').parse(await readFile(path.join(root, '.env')));
const output = path.resolve(process.env.HEXFENCE_LIVE_OUTPUT ?? path.join(root, '..', 'live-artifacts'));
if (!path.relative(root, output).startsWith('..' + path.sep)) throw new Error('Live artifacts must be outside the git worktree');
await mkdir(output, { recursive: true });
const stateFile = path.join(output, 'pay-live.json');
let state;
try { state = JSON.parse(await readFile(stateFile, 'utf8')); } catch { state = { attempts: [], payments: {} }; }
const save = () => writeFile(stateFile, JSON.stringify(state, null, 2) + '\n');
class LiveFailure extends Error {}
function check(ok, message) { if (!ok) throw new LiveFailure(message); }
const P = '0x4E185e251Ac7fB83E9DE10723EAda46cadE74120';
const L = '0x4E185a3FC4B530244aB9ed0dE38167b403344120';
const amount = ethers.parseEther('0.0001');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const safeAbi = req('@safe-global/safe-contracts/build/artifacts/contracts/Safe.sol/Safe.json').abi;
const safeInterface = new ethers.Interface(safeAbi);
const provider = new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL, undefined, { cacheTimeout: -1, pollingInterval: 2000 });

async function buildApp(app, outDir) {
  // Vite exposes only VITE_* values. Check the actual bytes before serving them.
  for (const [name, value] of Object.entries(env)) if (name.startsWith('VITE_')) process.env[name] = value;
  await build({ root: path.join(root, 'apps', app), build: { outDir, emptyOutDir: true } });
  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await scan(file);
      else {
        const bytes = await readFile(file);
        for (const name of ['DEPLOYER_PRIVATE_KEY', 'ARKIV_PRIVATE_KEY']) {
          if (env[name]) check(!bytes.includes(env[name]), 'Private material found in build; refusing to serve');
        }
        check(!bytes.includes('e2e:call'), 'Test-only ingress found in production build');
      }
    }
  }
  await scan(outDir);
}

async function explorer() {
  check(ethers.isAddress(env.VITE_ARKIV_PUBLISHER), 'VITE_ARKIV_PUBLISHER is required');
  const outDir = path.join(here, '.explorer-live-build');
  await buildApp('explorer', outDir);
  const web = await preview({ root: path.join(root, 'apps/explorer'), build: { outDir }, preview: { host: '127.0.0.1', port: 14177, strictPort: true } });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, recordVideo: { dir: output, size: { width: 1280, height: 960 } } });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:14177/');
    await expect(page.locator('article.card').first()).toBeVisible({ timeout: 120000 });
    const cards = await page.locator('article.card').count();
    check(cards >= 5, 'Explorer must show at least five real published records');
    await expect(page.locator('article.card .label').first()).toContainText('suspected');
    await page.screenshot({ path: path.join(output, 'explorer-records.png') });
    await page.getByRole('button', { name: 'Verify on Ethereum', exact: true }).first().click();
    await expect(page.locator('.verdict.good').first()).toBeVisible({ timeout: 120000 });
    await page.screenshot({ path: path.join(output, 'explorer-verified.png') });
    state.explorer = { publisher: env.VITE_ARKIV_PUBLISHER, visibleRecords: cards, verification: await page.locator('.verdict.good').first().innerText(), realData: true, at: new Date().toISOString() };
    await save();
    console.log('Explorer:', JSON.stringify(state.explorer));
  } finally { await context.close(); await browser.close(); web.httpServer.close(); }
}

async function walletSetup() {
  check((await provider.getNetwork()).chainId === 11155111n, 'Refusing non-Sepolia chain');
  check(ethers.isAddress(env.DEMO_SAFE_ADDRESS) && ethers.isAddress(env.VITE_GUARD_ADDRESS), 'DEMO_SAFE_ADDRESS and VITE_GUARD_ADDRESS are required');
  check(ethers.isHexString(env.DEPLOYER_PRIVATE_KEY, 32), 'Root .env needs a testnet deployer key');
  const wallet = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
  check((await provider.getBalance(wallet.address)) > 0n, 'Deployer is not funded');
  const safe = new ethers.Contract(env.DEMO_SAFE_ADDRESS, safeAbi, provider);
  check(await safe.VERSION() === '1.4.1', 'Expected Safe 1.4.1');
  const owners = await safe.getOwners();
  check(owners.length === 1 && same(owners[0], wallet.address) && await safe.getThreshold() === 1n, 'Expected deployer-owned 1-of-1 Safe');
  check(!state.safe || same(state.safe, env.DEMO_SAFE_ADDRESS), 'Existing artifact belongs to a different Safe');
  state.safe = env.DEMO_SAFE_ADDRESS; state.guard = env.VITE_GUARD_ADDRESS; state.owner = wallet.address; state.P = P; state.L = L;
  if (!state.B) {
    do { state.B = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20))); }
    while (same(state.B, P) || same(state.B, L) || (state.B.slice(2, 6) + state.B.slice(-4)).toLowerCase() === '4e184120');
  }
  await save();
  return wallet;
}

async function directL() {
  const wallet = await walletSetup();
  if (state.directL) { console.log('Existing direct script, not Safe{Wallet}:', state.directL.hash); return; }
  const signature = ethers.solidityPacked(['uint256', 'uint256', 'uint8'], [BigInt(wallet.address), 0, 1]);
  const data = safeInterface.encodeFunctionData('execTransaction', [L, amount, '0x', 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, signature]);
  const tx = await wallet.sendTransaction({ to: state.safe, data, gasLimit: 200000 });
  state.directL = { hash: tx.hash, label: 'direct script, not Safe{Wallet}', gasLimit: tx.gasLimit.toString() }; await save();
  const receipt = await provider.waitForTransaction(tx.hash, 1, 180000);
  check(receipt?.status === 0 && receipt.gasUsed < tx.gasLimit, 'Direct L must be a mined non-OOG revert');
  state.directL.status = receipt.status; state.directL.block = receipt.blockNumber; await save();
  console.log('direct script, not Safe{Wallet}:', JSON.stringify(state.directL));
}

async function pay() {
  const wallet = await walletSetup();
  const outDir = path.join(here, '.live-build');
  await buildApp('pay', outDir);
  const web = await preview({ root: path.join(root, 'apps/pay'), build: { outDir }, preview: { host: '127.0.0.1', port: 14176, strictPort: true } });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, recordVideo: { dir: output, size: { width: 1280, height: 960 } } });
  let phase;
  const recipient = name => ({ lpay: L, bpay: state.B, ppay: P })[name];
  function approvedCall(call) {
    check(phase && same(call.to, recipient(phase)) && BigInt(call.value) === amount && call.data === '0x' && Number(call.operation) === 0, 'Scripted signer rejected unexpected inner payment');
  }
  try {
    const page = await context.newPage();
    await page.exposeFunction('hexfenceScriptedWallet', async ({ method, params = [] }) => {
      if (method === 'eth_chainId') return '0xaa36a7';
      if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [wallet.address];
      if (method === 'eth_signTypedData_v4') {
        const typed = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
        check(typed.primaryType === 'SafeTx' && same(typed.domain.verifyingContract, state.safe) && BigInt(typed.domain.chainId) === 11155111n, 'Scripted signer rejected unexpected signing domain');
        approvedCall(typed.message);
        check(['safeTxGas', 'baseGas', 'gasPrice'].every(name => BigInt(typed.message[name]) === 0n)
          && same(typed.message.gasToken, ethers.ZeroAddress) && same(typed.message.refundReceiver, ethers.ZeroAddress), 'Scripted signer rejected unexpected refund/gas fields');
        const types = { ...typed.types }; delete types.EIP712Domain;
        return wallet.signTypedData(typed.domain, types, typed.message);
      }
      if (method === 'eth_sendTransaction') {
        check(phase && !state.payments[phase], 'Refusing duplicate or out-of-order broadcast');
        const { from, gas, ...tx } = params[0];
        check(same(from, wallet.address) && same(tx.to, state.safe) && BigInt(tx.value ?? 0) === 0n, 'Scripted signer rejected unexpected outer transaction');
        const decoded = safeInterface.parseTransaction({ data: tx.data });
        check(decoded?.name === 'execTransaction', 'Expected execTransaction'); approvedCall(decoded.args);
        check(!gas || BigInt(gas) <= 500000n, 'Unexpected gas limit');
        const sent = await wallet.sendTransaction({ ...tx, ...(gas ? { gasLimit: gas } : {}) });
        state.payments[phase] = { hash: sent.hash, recipient: recipient(phase), gasLimit: sent.gasLimit.toString(), scriptedWallet: true }; await save();
        console.log(phase + ' broadcast: ' + sent.hash);
        return sent.hash;
      }
      throw new LiveFailure('Unsupported scripted-wallet method');
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'ethereum', { value: {
        request: args => window.hexfenceScriptedWallet(args), on() {}, removeListener() {},
      } });
    });
    const connectAndLoad = async () => {
      await page.getByRole('button', { name: /^Connect / }).click();
      await page.locator('#safe-address').fill(state.safe);
      await page.getByRole('button', { name: 'Load Safe', exact: true }).click();
      await expect(page.getByText(/is active on this Safe/)).toBeVisible({ timeout: 150000 });
      await expect(page.locator('li.mono').filter({ hasText: P })).toBeVisible();
    };
    let loaded = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const start = Date.now();
      await page.goto('http://127.0.0.1:14176/');
      const result = { attempt, route: 'nox', guardAndPayeesLoaded: false };
      try {
        const active = page.getByText('Reads go through Nox (Sphinx mixnet).', { exact: true });
        const direct = page.getByText('Reads go directly from your browser to the RPC provider. They are not anonymous.', { exact: true });
        await expect(active.or(direct)).toBeVisible({ timeout: 135000 });
        check(await active.isVisible(), 'Nox startup failed');
        await connectAndLoad();
        result.guardAndPayeesLoaded = true; result.elapsedMs = Date.now() - start;
        state.route = 'nox'; state.noxGuardAndPayees = true; loaded = true;
      } catch {
        result.elapsedMs = Date.now() - start; result.failure = 'Nox startup or Guard/payee load failed';
        await page.screenshot({ path: path.join(output, `nox-attempt-${attempt}-failed.png`), fullPage: true });
      }
      state.attempts.push(result); await save(); console.log('Route attempt:', JSON.stringify(result));
      if (loaded) break;
    }
    if (!loaded) {
      await page.goto('http://127.0.0.1:14176/');
      await page.getByRole('button', { name: 'Skip: read directly (not anonymous)' }).click();
      await expect(page.getByText('Reads go directly from your browser to the RPC provider. They are not anonymous.', { exact: true })).toBeVisible();
      await connectAndLoad();
      state.route = 'direct after two Nox failures and explicit Skip'; state.noxGuardAndPayees = false; await save();
      console.log('Nox failed twice; explicitly skipped. Continuing with labelled direct reads.');
    }
    await page.screenshot({ path: path.join(output, 'pay-route-and-safe.png'), fullPage: true });
    for (const [name, level] of [['lpay', 'RED'], ['bpay', 'AMBER'], ['ppay', 'GREEN']]) {
      if (state.payments[name]) { console.log('Existing broadcast; not repeating:', name, state.payments[name].hash); continue; }
      phase = name;
      await page.locator('#to').fill(recipient(name)); await page.locator('#amount').fill('0.0001');
      await page.getByRole('button', { name: 'Check payment', exact: true }).click();
      await expect(page.locator(`.verdict.${level}`)).toBeVisible({ timeout: 120000 });
      if (name === 'lpay') {
        await expect(page.locator('.verdict.RED')).toContainText('resembles your approved payee');
        await page.locator('#friction').fill('E74120'); await expect(page.getByRole('button', { name: 'Continue anyway' })).toBeDisabled();
        await page.locator('#friction').fill('344120'); await page.getByRole('button', { name: 'Continue anyway' }).click();
        await expect(page.locator('.error').filter({ hasText: 'LookalikeOfApprovedPayee' })).toBeVisible({ timeout: 180000 });
      } else {
        await page.getByRole('button', { name: 'Sign and send' }).click();
        await expect(page.getByText(/Confirmed in block/)).toBeVisible({ timeout: 180000 });
      }
      const record = state.payments[name]; check(record, 'No broadcast was recorded');
      const receipt = await provider.getTransactionReceipt(record.hash);
      check(receipt && receipt.status === (name === 'lpay' ? 0 : 1), 'Unexpected live receipt status');
      record.status = receipt.status; record.block = receipt.blockNumber; record.uiConfirmed = true;
      await save(); await page.screenshot({ path: path.join(output, `pay-${name}.png`), fullPage: true });
      console.log(name + ':', JSON.stringify(record));
    }
    state.completedAt = new Date().toISOString(); await save();
  } finally { await context.close(); await browser.close(); web.httpServer.close(); }
}

try {
  if (process.argv.includes('--explorer')) await explorer();
  else if (process.argv.includes('--direct-l')) await directL();
  else await pay();
} catch (error) {
  console.error(error instanceof LiveFailure ? error.message : 'Live runner failed; inspect public screenshots/receipts (raw errors withheld)');
  process.exitCode = 1;
} finally { provider.destroy(); }
