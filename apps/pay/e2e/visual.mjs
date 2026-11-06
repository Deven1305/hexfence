// Read-only production UI checks. Uses published records and the existing demo Safe.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.join(root, 'artifacts/xray');
await mkdir(out, { recursive: true });
const html = await readFile(path.join(root, 'apps/pay/dist/index.html'), 'utf8');
const initialFiles = [...new Set([...html.matchAll(/(?:src|href)="([^" ]+\.js)"/g)].map(m => m[1]))];
let initialBytes = 0;
for (const file of initialFiles) initialBytes += (await readFile(path.join(root, 'apps/pay/dist', file.replace(/^\.\//, '')))).length;
expect(initialBytes).toBeLessThan(400000);
await writeFile(path.join(out, 'bundle.json'), JSON.stringify({ initialBytes, initialFiles }, null, 2));
const servers = [];
for (const [i, name] of ['site', 'explorer', 'pay'].entries()) {
  const dir = path.join(root, `apps/${name}/dist`);
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(dir, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(dir + path.sep)) { res.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2', '.woff':'font/woff' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime }); res.end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(14180 + i, '127.0.0.1', resolve)); servers.push(server);
}
const browser = await chromium.launch();
try {
  for (const colorScheme of ['light', 'dark']) for (const width of [375, 1440]) {
    const context = await browser.newContext({ colorScheme, viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const [i, app] of ['site', 'explorer', 'pay'].entries()) {
      await page.goto(`http://127.0.0.1:${14180+i}/` + (app === 'pay' ? '?safe=0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5' : ''));
      if (app === 'pay') {
        await page.locator('.route-status summary').click();
        const skip = page.getByRole('button', { name: 'Skip: read directly (not anonymous)', exact: true });
        if (await skip.isVisible()) await skip.click();
        await expect(page.locator('#to')).toBeVisible({ timeout: 120000 });
        await page.locator('#to').fill('0x4E185a3FC4B530244aB9ed0dE38167b403344120');
        await expect(page.locator('.verdict.RED')).toContainText('resembles your approved payee');
        await expect(page.locator('.verdict.RED .hf-xray')).toHaveCount(2);
        await page.screenshot({ path: path.join(out, `${app}-${width}-${colorScheme}.png`), fullPage: true });
        await page.locator('#to').fill('0x4E185e251Ac7fB83E9DE10723EAda46cadE74120');
        await expect(page.locator('.verdict.GREEN')).toBeVisible();
      } else {
        if (app === 'site') {
          await page.locator('.hf-xray-hero').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
          await expect(page.locator('#live-stats .stat').first()).toBeVisible({ timeout: 120000 });
        }
        if (app === 'explorer') {
          await expect(page.locator('.bulk-status')).toContainText('All records loaded.', { timeout: 120000 });
          await expect(page.getByRole('button', { name: 'X-Ray', exact: true }).first()).toBeVisible({ timeout: 120000 });
          await page.getByRole('button', { name: 'X-Ray', exact: true }).first().click();
          await expect(page.locator('article.card').first()).toBeVisible();
        }
        await page.screenshot({ path: path.join(out, `${app}-${width}-${colorScheme}.png`), fullPage: app !== 'explorer' });
      }
      if (app === 'explorer') {
        await page.getByRole('button', { name: 'Losses', exact: true }).click();
        const panel = page.locator('.losses-panel');
        await expect(panel).toContainText('Publisher loss records loaded in bulk.', { timeout: 120000 });
        const inspect = panel.getByRole('button', { name: 'X-Ray', exact: true }).first();
        if (await inspect.count()) {
          await inspect.click();
          const detail = panel.locator('article.card').first();
          await expect(detail).toContainText('investigative lead');
          if (colorScheme === 'light' && width === 1440) {
            await detail.getByRole('button', { name: 'Check incident receipts', exact: true }).click();
            await expect(detail).toContainText('Receipt patterns match the recorded incident.', { timeout: 120000 });
            const fileReady = page.waitForEvent('download');
            await detail.getByRole('button', { name: 'Download Rescue pack', exact: true }).click();
            const file = await fileReady;
            const bytes = await readFile(await file.path());
            const hash = createHash('sha256').update(bytes).digest('hex');
            await expect(detail).toContainText(`Core SHA-256 matches Arkiv packHash: ${hash}`);
            const requests = [];
            page.on('request', request => {
              try { const p = JSON.parse(request.postData() || '{}'); for (const call of Array.isArray(p) ? p : [p]) if (call.method === 'eth_call' && call.params?.[0]?.data?.startsWith('0x70a08231')) requests.push(call); } catch {}
            });
            const balance = detail.getByRole('button', { name: /^Read .* balance still at lookalike$/ }).first();
            await balance.click();
            await expect(detail).toContainText('Still at the lookalike now:', { timeout: 120000 });
            expect(requests).toHaveLength(1); await expect(balance).toBeDisabled();
          }
        }
        await page.screenshot({ path: path.join(out, `losses-${width}-${colorScheme}.png`), fullPage: false });
        await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
        const campaigns = page.locator('.campaigns-panel');
        await expect(campaigns).toContainText('Counts refer to downloaded suspected records');
        await campaigns.getByRole('button', { name: 'Read real block times', exact: true }).click();
        await expect(campaigns).toContainText('actual block timestamps.', { timeout: 180000 });
        const hourly = campaigns.locator('.hourly-chart');
        const counted = await hourly.locator('[data-count]').evaluateAll(rows => rows.reduce((n, row) => n + Number(row.dataset.count), 0));
        const expected = Number(await hourly.getAttribute('data-records'));
        expect(counted).toBe(expected); expect(expected).toBeGreaterThan(0);
        await hourly.screenshot({ path: path.join(out, `campaigns-time-${width}-${colorScheme}.png`) });
        await campaigns.locator('.match-comparison').screenshot({ path: path.join(out, `campaigns-model-${width}-${colorScheme}.png`) });
        await campaigns.locator('.campaign-stats').screenshot({ path: path.join(out, `campaigns-stats-${width}-${colorScheme}.png`) });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    }
    await context.close();
  }
} finally { await browser.close(); for (const s of servers) s.close(); }
