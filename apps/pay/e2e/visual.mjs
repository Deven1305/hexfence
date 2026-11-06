// Read-only production UI checks. Uses published records and the existing demo Safe.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.join(root, 'artifacts/xray');
await mkdir(out, { recursive: true });
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
        if (app === 'explorer') await expect(page.locator('article.card').first()).toBeVisible({ timeout: 120000 });
        await page.screenshot({ path: path.join(out, `${app}-${width}-${colorScheme}.png`), fullPage: true });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    }
    await context.close();
  }
} finally { await browser.close(); for (const s of servers) s.close(); }
