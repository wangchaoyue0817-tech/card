import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const dir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const canvasModule = process.env.BANNER_CANVAS_MODULE || '@napi-rs/canvas';
const { createCanvas, loadImage } = require(canvasModule);
const spec = JSON.parse(await fs.readFile(path.join(dir, 'banner-spec.json'), 'utf8'));
const source = await loadImage(path.join(dir, 'art-background.png'));
const textBounds = [];

function rounded(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

async function render(scale, filename) {
  const canvas = createCanvas(spec.width * scale, spec.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  rounded(ctx, 0, 0, spec.width, spec.height, spec.radius);
  ctx.clip();
  // Center crop only to the final aspect ratio; keep the entire main card visible.
  const cropHeight = source.width * spec.height / spec.width;
  const cropY = (source.height - cropHeight) / 2;
  ctx.drawImage(source, 0, cropY, source.width, cropHeight, 0, 0, spec.width, spec.height);
  // Very light editorial scrim keeps the title quiet without recoloring the art.
  const scrim = ctx.createLinearGradient(0, 0, 370, 0);
  scrim.addColorStop(0, 'rgba(15,16,43,0.22)');
  scrim.addColorStop(0.8, 'rgba(15,16,43,0.06)');
  scrim.addColorStop(1, 'rgba(15,16,43,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, spec.width, spec.height);
  spec.titleLines.forEach((line, i) => {
    ctx.font = `600 ${spec.titleSizes[i]}px "${spec.fontFamily}"`;
    ctx.fillStyle = i === 0 ? spec.palette.text : spec.palette.emphasis;
    ctx.fillText(line, spec.textSafeArea.x, spec.titleBaselines[i]);
    if (scale === 1) textBounds.push({text: line, x: spec.textSafeArea.x, width: ctx.measureText(line).width});
  });
  const b = spec.buttonBounds;
  const button = ctx.createLinearGradient(b.x, b.y, b.x + b.width, b.y + b.height);
  button.addColorStop(0, spec.palette.buttonStart);
  button.addColorStop(1, spec.palette.buttonEnd);
  rounded(ctx, b.x, b.y, b.width, b.height, b.radius);
  ctx.fillStyle = button;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(211,204,255,0.8)';
  ctx.stroke();
  ctx.font = `600 ${spec.buttonFontSize}px "${spec.fontFamily}"`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(spec.button, b.x + 24, b.y + 29);
  ctx.beginPath();
  ctx.moveTo(b.x + 126, b.y + 22);
  ctx.lineTo(b.x + 144, b.y + 22);
  ctx.moveTo(b.x + 138, b.y + 16);
  ctx.lineTo(b.x + 144, b.y + 22);
  ctx.lineTo(b.x + 138, b.y + 28);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  // Fine, continuous inner edge; exact external radius is set by the clipping path.
  rounded(ctx, 0.6, 0.6, spec.width - 1.2, spec.height - 1.2, spec.radius - 0.6);
  ctx.lineWidth = 1.2;
  const edge = ctx.createLinearGradient(0, 0, spec.width, spec.height);
  edge.addColorStop(0, 'rgba(182,174,255,0.50)');
  edge.addColorStop(0.45, 'rgba(136,116,232,0.18)');
  edge.addColorStop(1, 'rgba(189,166,255,0.55)');
  ctx.strokeStyle = edge;
  ctx.stroke();
  const output = canvas.toBuffer('image/png');
  await fs.writeFile(path.join(dir, filename), output);
  return {file: filename, width: canvas.width, height: canvas.height, radius: spec.radius * scale, sha256: createHash('sha256').update(output).digest('hex')};
}

const exports = [];
exports.push(await render(1, spec.outputFiles[0]));
exports.push(await render(2, spec.outputFiles[1]));
const sourceBytes = await fs.readFile(path.join(dir, 'art-background.png'));
const manifest = {
  generator: 'Built-in Codex image_gen; deterministic typography and export via @napi-rs/canvas',
  title: spec.title, button: spec.button, textBounds, exports,
  artSourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  scope: spec.scope
};
await fs.writeFile(path.join(dir, 'export-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
