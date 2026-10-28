import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const dir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require(process.env.BANNER_SHARP_MODULE || 'sharp');
const source = await fs.readFile(path.join(dir, 'art-source.png'));
const metadata = await sharp(source).metadata();
if (metadata.width * 480 !== metadata.height * 1440) {
  throw new Error('Source must have an exact 3:1 aspect ratio; review before cropping.');
}
const outputName = 'eb05-panorama-no-text-1440x480.png';
const output = await sharp(source).resize(1440, 480, {fit: 'fill', kernel: 'lanczos3'}).png().toBuffer();
await fs.writeFile(path.join(dir, outputName), output);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = {
  generator: 'Built-in Codex image_gen',
  export: 'Exact proportional resize only; no crop, no added typography',
  width: 1440, height: 480, text: [], buttons: [],
  source: 'art-source.png', sourceWidth: metadata.width, sourceHeight: metadata.height,
  sourceSha256: sha(source), file: outputName, sha256: sha(output),
  styleReference: '../eb05-home-banner/art-background.png',
  composition: 'Five-card panoramic arc, centered straw-hat skull, crossed swords and compass and flower-eye emblems, violet ribbons and nautical rope',
  scope: 'Standalone design asset. Existing main banner and live pages unchanged.'
};
await fs.writeFile(path.join(dir, 'export-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
