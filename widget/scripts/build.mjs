import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const embedOut = resolve(root, '../internal/feedback/assets/feedback.js');
const libOut = resolve(root, 'dist/index.js');

const shared = {
  bundle: true,
  target: 'es2020',
  platform: 'browser',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
};

await mkdir(dirname(embedOut), { recursive: true });
await rm(resolve(root, 'dist'), { recursive: true, force: true });

await build({
  ...shared,
  entryPoints: [resolve(root, 'src/embed.ts')],
  outfile: embedOut,
  format: 'iife',
  banner: { js: '/* prevly preview feedback widget */' },
});

await build({
  ...shared,
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: libOut,
  format: 'esm',
});

await run('npx', ['tsc', '-p', 'tsconfig.build.json'], { cwd: root });

for (const [label, file] of [
  ['feedback.js', embedOut],
  ['dist/index.js', libOut],
  ['dist/index.d.ts', resolve(root, 'dist/index.d.ts')],
]) {
  const { size } = await stat(file);
  console.log(`${label}: ${(size / 1024).toFixed(1)} kB (${size} bytes)`);
}
