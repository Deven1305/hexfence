import { build } from 'vite';
import { copyFile } from 'node:fs/promises';

// Content scripts are standalone classic scripts: no imports or web-accessible bundles.
await build({ configFile: false, build: {
  target: 'es2022', outDir: 'dist', emptyOutDir: true,
  rollupOptions: { input: { options: 'options.html', review: 'review.html' } },
} });
for (const name of ['main', 'bridge', 'background']) {
  await build({ configFile: false, build: {
    target: 'es2022', outDir: 'dist', emptyOutDir: false,
    lib: { entry: `src/${name}.ts`, name: `HexFence_${name}`, formats: ['iife'], fileName: () => `${name}.js` },
  } });
}
await copyFile('manifest.json', 'dist/manifest.json');
