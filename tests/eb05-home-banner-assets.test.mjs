import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const dir = new URL('../design/eb05-home-banner/', import.meta.url);
const read = file => readFileSync(new URL(file, dir));
const spec = JSON.parse(read('banner-spec.json'));
const manifest = JSON.parse(read('export-manifest.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// Decode the export's 8-bit RGBA PNG so dimensions and alpha are tested
// without introducing a runtime dependency into this frontend-only demo.
function png(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], 6, 'exports must have a genuine alpha channel');
  assert.equal(bytes[28], 0, 'non-interlaced exports expected');
  const parts = [];
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') parts.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(parts)), stride = width * 4;
  assert.equal(raw.length, (stride + 1) * height);
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, left = x < 4 ? 0 : pixels[i - 4];
      const up = y === 0 ? 0 : pixels[i - stride];
      const upperLeft = y === 0 || x < 4 ? 0 : pixels[i - stride - 4];
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)][filter];
      pixels[i] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, alpha: (x, y) => pixels[(y * width + x) * 4 + 3] };
}

test('banner contains only the approved title and primary action', () => {
  assert.equal(spec.title, '海贼EB05卡牌免费抽卡活动');
  assert.equal(spec.titleLines.join(''), spec.title);
  assert.equal(spec.button, '立即参与');
  assert.equal(manifest.title, spec.title);
  assert.equal(manifest.button, spec.button);
  assert.equal(spec.width, 678);
  assert.equal(spec.height, 214);
  assert.equal(spec.radius, 26);
});

for (const [i, scale] of [1, 2].entries()) {
  test('banner export at scale ' + scale + ' has exact dimensions, rounded alpha and verified bytes', () => {
    const output = manifest.exports[i], bytes = read(output.file), img = png(bytes);
    assert.equal(output.file, spec.outputFiles[i]);
    assert.equal(img.width, 678 * scale);
    assert.equal(img.height, 214 * scale);
    assert.equal(output.width, img.width);
    assert.equal(output.height, img.height);
    assert.equal(output.radius, 26 * scale);
    assert.equal(sha(bytes), output.sha256);
    for (const [x, y] of [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]]) {
      assert.equal(img.alpha(x, y), 0, 'outside rounded corners must be transparent');
    }
    assert.equal(img.alpha(4 * scale, 4 * scale), 0);
    assert.equal(img.alpha(20 * scale, 20 * scale), 255);
    assert.equal(img.alpha(339 * scale, 107 * scale), 255);
    // The top edge starts at the declared radius, with one-pixel antialias tolerance.
    assert.equal(img.alpha(16 * scale, 0), 0);
    assert.ok(img.alpha(27 * scale, 0) >= 240);
  });
}

test('headline and button fit the declared safe zone', () => {
  assert.equal(manifest.textBounds.length, 2);
  for (const bounds of manifest.textBounds) {
    assert.equal(bounds.x, 36);
    assert.ok(bounds.width > 180);
    assert.ok(bounds.width <= spec.textSafeArea.width);
    assert.ok(bounds.x + bounds.width < 346);
  }
  assert.equal(spec.buttonBounds.height, 44);
  assert.ok(spec.buttonBounds.y + spec.buttonBounds.height <= spec.height - 20);
});

test('source provenance is preserved and this delivery does not claim deployment', () => {
  assert.equal(sha(read('art-background.png')), manifest.artSourceSha256);
  assert.match(manifest.generator, /Built-in Codex image_gen/);
  assert.match(spec.scope, /no homepage replacement or deployment/);
  assert.match(read('generation-prompt.txt').toString(), /NO text, NO letters/);
});
