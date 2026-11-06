import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ethers } from '../../../contracts/node_modules/ethers/lib.esm/index.js';
const f = JSON.parse(readFileSync(new URL('.fixture.json', import.meta.url), 'utf8'));
const rpc = new ethers.JsonRpcProvider('http://127.0.0.1:18545', undefined, { cacheTimeout: -1 }); // ethers caches repeat reads for 250 ms; a local payment can finish faster than that.

test('built Pay: real Safe 1.4.1, Guard, P/B success, L mined revert and bulk reads', async ({ page }) => {
  // Hold the real bootstrap request until the user-facing skip button has been used.
  let releaseBootstrap!: () => void;
  const bootstrapGate = new Promise<void>(resolve => { releaseBootstrap = resolve; });
  await page.route('http://127.0.0.1:18545/', async route => {
    if (route.request().postData()?.toLowerCase().includes('35133267a8f7ec35046a83dca0f4ca8a6e1b7a9a')) await bootstrapGate;
    await route.continue();
  });
  await page.addInitScript(() => {
    // Scripted EIP-1193 wallet, backed by an ephemeral local signer in run.mjs.
    const provider = {
      request: async (args: unknown) => {
        const response = await fetch('http://127.0.0.1:18545', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'e2e_wallet', params: [args] }) });
        const reply = await response.json();
        if (reply.error) throw Object.assign(new Error(reply.error.message), reply.error);
        return reply.result;
      }, on() {}, removeListener() {},
    };
    Object.defineProperty(window, 'ethereum', { value: provider });
  });
  await page.goto('/');
  await page.locator('.route-status summary').click();
  const skip = page.getByRole('button', { name: 'Skip: read directly (not anonymous)' });
  await skip.click();
  releaseBootstrap();
  await expect(page.getByText('Reads go directly from your browser to the RPC provider. They are not anonymous.')).toBeVisible();
  await page.getByRole('button', { name: /^Connect / }).click();
  await page.locator('#safe-address').fill(f.safe);
  await page.getByRole('button', { name: 'Load Safe', exact: true }).click();
  await expect(page.getByText(/v1.4.1/).first()).toBeVisible();
  await expect(page.getByText(/Guard active/)).toBeVisible();
  for (const [recipient, level] of [[f.P, 'GREEN'], [f.B, 'AMBER']]) {
    const before = await rpc.getBalance(recipient, 'latest');
    await page.locator('#to').fill(recipient);
    await page.locator('#amount').fill('0.0001');
    await page.getByRole('button', { name: 'Check payment' }).click();
    await expect(page.locator(`.verdict.${level}`)).toBeVisible();
    await page.getByRole('button', { name: 'Sign and send' }).click();
    await expect(page.getByText(/Confirmed in block/)).toBeVisible();
    expect(await rpc.getBalance(recipient, 'latest')).toBe(before + ethers.parseEther('0.0001'));
  }
  await page.locator('#to').fill(f.L);
  await page.getByRole('button', { name: 'Check payment' }).click();
  await expect(page.locator('.verdict.RED')).toContainText('resembles your approved payee');
  const go = page.getByRole('button', { name: 'Continue anyway' });
  await page.locator('#friction').fill('E74120'); await expect(go).toBeDisabled();
  await page.locator('#friction').fill('344120'); await expect(go).toBeEnabled();
  await go.click();
  await expect(page.locator('.error').filter({ hasText: 'LookalikeOfApprovedPayee' })).toBeVisible();
  const hash = await page.getByRole('link', { name: /^0x/ }).last().textContent();
  expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);
  const receipt = await rpc.getTransactionReceipt(hash!);
  expect(receipt?.status).toBe(0);
  const audit = await rpc.send('e2e_calls', []);
  expect(audit.sent.at(-1).hash).toBe(hash);
  expect(audit.sent.at(-1).gasLimit).toBe('200000');
  const iface = new ethers.Interface(['function payees(address) view returns (address[])', 'function isApprovedPayee(address,address) view returns(bool)', 'function payeeByFingerprint(address,bytes4) view returns(address)']);
  const reads = audit.calls.filter((c: any) => c.method === 'eth_call' && c.params[0].to?.toLowerCase() === f.guard.toLowerCase());
  expect(reads.filter((c: any) => c.params[0].data.startsWith(iface.getFunction('payees')!.selector))).toHaveLength(1);
  for (const method of ['isApprovedPayee', 'payeeByFingerprint']) expect(reads.filter((c: any) => c.params[0].data.startsWith(iface.getFunction(method)!.selector))).toHaveLength(0);
  await page.screenshot({ path: 'e2e/results/reverted-L.png', fullPage: true });
  // Pay only builds ETH/ERC-20 payments. A test-build-only ingress exercises its real
  // decoder and renderer with unsupported calldata; there is no arbitrary-call product UI.
  await page.evaluate(to => window.dispatchEvent(new CustomEvent('e2e:call', { detail: { to, value: '0', data: '0xdeadbeef', operation: 0 } })), f.B);
  await expect(page.locator('.verdict.GREY')).toContainText('Cannot verify this transaction type.');
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await page.locator('#safe-address').fill(f.unguarded);
  await page.getByRole('button', { name: 'Load Safe', exact: true }).click();
  await expect(page.getByText(/Guard inactive/)).toBeVisible();
});

