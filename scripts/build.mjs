import { cp, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/', root), { recursive: true });
for (const name of ['src', 'public']) {
  await cp(new URL(name, root), new URL(`dist/${name}`, root), { recursive: true });
}
console.log('Packaged src/ and public/ into dist/; tests, docs, and build scripts are excluded.');
