import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const dir = new URL('../design/eb05-panorama-no-text/', import.meta.url);
const read = file => readFileSync(new URL(file, dir));
const manifest = JSON.parse(read('export-manifest.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pngSize = bytes => {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

test('no-text panorama is exactly 1440 by 480 pixels', () => {
  const bytes = read(manifest.file);
  assert.deepEqual(pngSize(bytes), [1440, 480]);
  assert.equal(manifest.width, 1440);
  assert.equal(manifest.height, 480);
  assert.equal(sha(bytes), manifest.sha256);
});

test('panorama uses a new composition with preserved source and exact proportional export', () => {
  const source = read(manifest.source);
  const [width, height] = pngSize(source);
  assert.equal(width * 480, height * 1440);
  assert.equal(sha(source), manifest.sourceSha256);
  const original = JSON.parse(read('../eb05-home-banner/export-manifest.json'));
  assert.notEqual(manifest.sourceSha256, original.artSourceSha256);
  assert.equal(manifest.styleReference, '../eb05-home-banner/art-background.png');
  assert.match(manifest.composition, /Five-card panoramic arc/);
});

test('panorama export does not add copy or CTA and leaves the original delivery unchanged', () => {
  assert.deepEqual(manifest.text, []);
  assert.deepEqual(manifest.buttons, []);
  assert.match(read('generation-prompt.txt').toString(), /ABSOLUTELY ZERO TEXT/);
  assert.doesNotMatch(read('export-poster.mjs').toString(), /fillText|<text|立即参与/);
  assert.match(manifest.scope, /Existing main banner and live pages unchanged/);
  const original = JSON.parse(read('../eb05-home-banner/export-manifest.json'));
  for (const output of original.exports) {
    assert.equal(sha(read('../eb05-home-banner/' + output.file)), output.sha256);
  }
});
