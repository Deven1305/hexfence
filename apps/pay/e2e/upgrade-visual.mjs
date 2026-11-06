// Read-only browser QA against the actual Sepolia V2 and Alerts deployments.
// Does not create alert fixtures, send transactions or claim CRE simulation.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const record = JSON.parse(await readFile(path.join(root, 'contracts/deployments/v2-safe-sepolia.json'), 'utf8'));
const dir = path.join(root, 'apps/pay/dist');
const out = path.join(root, 'artifacts/xray');
await mkdir(out, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(dir, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(dir + path.sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime }); res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(14183, '127.0.0.1', resolve));
const browser = await chromium.launch();
const results = [];
try {
  for (const colorScheme of ['light', 'dark']) for (const width of [375, 1440]) {
    const context = await browser.newContext({ colorScheme, viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:14183/?safe=${record.safe}`);
    await page.locator('.route-status summary').click();
    const skip = page.getByRole('button', { name: 'Skip: read directly (not anonymous)', exact: true });
    if (await skip.isVisible()) await skip.click();
    await expect(page.locator('#to')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('.safe-line')).toContainText('Auto-Fence V2');
    await expect(page.locator('.hf-radar')).toContainText('Sentinel simulation:', { timeout: 60000 });
    await page.locator('#to').fill('0x4E185e251Ac7fB83E9DE10723EAda46cadE74120');
    await expect(page.locator('.verdict')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    results.push({ safe: record.safe, guard: record.guard, width, colorScheme, radar: await page.locator('.hf-radar').innerText(), preview: await page.locator('.verdict').innerText() });
    await page.screenshot({ path: path.join(out, `pay-v2-${width}-${colorScheme}.png`), fullPage: true });
    await context.close();
  }
  await writeFile(path.join(out, 'pay-v2-readonly.json'), JSON.stringify(results, null, 2));
} finally { await browser.close(); server.close(); }
