import { cpSync, rmSync } from 'node:fs';
import { build } from 'esbuild';
await build({entryPoints:['skin-src/entry.tsx'],bundle:true,format:'esm',jsx:'automatic',minify:true,outfile:'public/skin-bundle.js',define:{'process.env.NODE_ENV':'"production"'}});
for(const name of ['globals','report-v9','report-v10','skin-management','commerce-refresh','order-center','field-review'])cpSync(`skin-src/${name}.css`,`public/skin-${name}.css`);
rmSync('dist', { recursive: true, force: true });
cpSync('public', 'dist', { recursive: true });
