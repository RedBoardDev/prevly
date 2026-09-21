import { build } from 'esbuild';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = resolve(root, '../internal/feedback/assets/feedback.js');

await mkdir(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile,
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
  banner: { js: '/* prevly preview feedback widget */' },
});

const { size } = await stat(outfile);
console.log(`feedback.js: ${(size / 1024).toFixed(1)} kB (${size} bytes)`);
