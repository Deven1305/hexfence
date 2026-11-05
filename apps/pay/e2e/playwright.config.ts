import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'pay.spec.ts', workers: 1, timeout: 90_000,
  outputDir: './results', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:14173', viewport: { width: 1280, height: 1100 }, trace: 'retain-on-failure' },
});
