import test from 'node:test';
import assert from 'node:assert/strict';
import {celebrateGacha, outcomeTier} from '../../public/events/gacha-celebration.js';

function fixture({reduced = false, canvas = true} = {}) {
  const rafs = new Map(), timers = new Map(), motionListeners = new Set();
  let id = 0, now = 0, fills = 0, lines = 0;
  const context = {
    scale() {}, clearRect() {}, beginPath() {}, arc() {}, moveTo() {},
    lineTo() {}, save() {}, restore() {}, translate() {}, rotate() {},
    bezierCurveTo() {}, closePath() {},
    fill() { fills++; }, stroke() { lines++; }
  };
  const win = {
    devicePixelRatio: 3,
    performance: {now: () => now},
    matchMedia: () => ({
      matches: reduced,
      addEventListener: (_, fn) => motionListeners.add(fn),
      removeEventListener: (_, fn) => motionListeners.delete(fn)
    }),
    requestAnimationFrame(fn) { const key = ++id; rafs.set(key, fn); return key; },
    cancelAnimationFrame(key) { rafs.delete(key); },
    setTimeout(fn, delay) { const key = ++id; timers.set(key, {fn, at: now + delay}); return key; },
    clearTimeout(key) { timers.delete(key); }
  };
  const doc = {defaultView: win, createElement: tag => element(tag)};
  function element(tag) {
    const classes = new Set(), attributes = new Map(), styles = new Map();
    const node = {
      tagName: tag.toUpperCase(), className: '', dataset: {}, children: [],
      ownerDocument: doc, isConnected: true, clientHeight: 700,
      style: {setProperty: (key, value) => styles.set(key, value)},
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name)
      },
      setAttribute: (key, value) => attributes.set(key, value),
      getAttribute: key => attributes.get(key),
      append(child) { this.children.push(child); child.parent = this; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.isConnected = false; },
      getBoundingClientRect: () => ({width: 390, height: 700}),
      getContext: () => {
        if (canvas === 'throw') throw new Error('2D context unavailable');
        return canvas ? context : null;
      }
    };
    return node;
  }
  const host = element('dialog');
  function advance(time) {
    now = time;
    const queued = [...rafs.values()]; rafs.clear();
    queued.forEach(fn => fn(time));
    for (const [key, timer] of [...timers.entries()]) {
      if (timer.at <= time) { timers.delete(key); timer.fn(); }
    }
  }
  return {host, rafs, timers, motionListeners, advance, strokes: () => lines, fills: () => fills};
}

test('mixed draw batches choose physical before voucher and never celebrate misses as wins', () => {
  assert.equal(outcomeTier({rewards: [{type: 'voucher'}, {type: 'physical'}, {type: 'none'}]}), 'physical');
  assert.equal(outcomeTier({rewards: [{type: 'none'}, {type: 'voucher'}]}), 'voucher');
  for (const batch of [undefined, {}, {rewards: []}, {rewards: [{type: 'none'}, {type: 'none'}]}]) {
    assert.equal(outcomeTier(batch), 'none');
  }
});

test('reduced motion does not create effects, timers or animation frames', () => {
  const f = fixture({reduced: true});
  const stop = celebrateGacha(f.host, 'physical');
  assert.equal(f.host.children.length, 0);
  assert.equal(f.rafs.size, 0);
  assert.equal(f.timers.size, 0);
  stop(); stop();
});

test('ordinary reward renders transparent particles and cleans all resources on close', () => {
  const f = fixture();
  const stop = celebrateGacha(f.host, 'ordinary');
  const layer = f.host.children[0];
  assert.equal(layer.getAttribute('aria-hidden'), 'true');
  assert.equal(layer.dataset.tier, 'ordinary');
  const canvas = layer.children.find(node => node.tagName === 'CANVAS');
  assert.equal(canvas.width, 780, 'canvas pixel density is capped at 2');
  f.advance(350);
  assert.ok(f.fills() > 0);
  assert.ok(f.strokes() > 0);
  stop(); stop();
  assert.equal(f.host.children.length, 0);
  assert.equal(f.rafs.size, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.motionListeners.size, 0);
  assert.equal(f.host.classList.contains('gacha-celebration-host'), false);
});

test('advanced reward lasts longer and has a denser layered firework than ordinary', () => {
  const basic = fixture(), advanced = fixture();
  celebrateGacha(basic.host, 'ordinary');
  celebrateGacha(advanced.host, 'advanced');
  basic.advance(800); advanced.advance(800);
  assert.ok(advanced.fills() > basic.fills());
  basic.advance(2000); advanced.advance(2000);
  assert.equal(basic.host.children.length, 0);
  assert.equal(advanced.host.children.length, 1);
  advanced.advance(3000);
  assert.equal(advanced.host.children.length, 0);
  assert.equal(advanced.rafs.size, 0);
  assert.equal(advanced.timers.size, 0);
});

test('misses show only a short gentle gleam without a confetti/firework canvas', () => {
  const f = fixture();
  celebrateGacha(f.host, 'none');
  const layer = f.host.children[0];
  assert.equal(layer.children.filter(node => node.tagName === 'CANVAS').length, 0);
  assert.equal(f.rafs.size, 0);
  assert.equal(layer.children.filter(node => node.className === 'gacha-celebration-gleam').length, 5);
  f.advance(1600);
  assert.equal(f.host.children.length, 0);
});

test('re-entering a host cancels old effect and old cleanup cannot stop the new one', () => {
  const f = fixture();
  const oldStop = celebrateGacha(f.host, 'ordinary');
  const currentStop = celebrateGacha(f.host, 'physical');
  assert.equal(f.host.children.length, 1);
  assert.equal(f.host.children[0].dataset.tier, 'physical');
  assert.equal(f.rafs.size, 1);
  assert.equal(f.timers.size, 1);
  oldStop();
  assert.equal(f.host.children.length, 1);
  currentStop();
  assert.equal(f.host.children.length, 0);
});

test('changing reduced-motion preference while running removes the effect immediately', () => {
  const f = fixture();
  celebrateGacha(f.host, 'advanced');
  for (const listener of [...f.motionListeners]) listener({matches: true});
  assert.equal(f.host.children.length, 0);
  assert.equal(f.rafs.size, 0);
  assert.equal(f.timers.size, 0);
});

test('missing canvas support preserves CSS gleams and still removes them at completion', () => {
  const f = fixture({canvas: false});
  celebrateGacha(f.host, 'voucher');
  assert.equal(f.host.children.length, 1);
  assert.equal(f.rafs.size, 0);
  f.advance(2200);
  assert.equal(f.host.children.length, 0);
});

test('failed canvas allocation safely falls back to CSS and retains working cleanup', () => {
  const f = fixture({canvas: 'throw'});
  const stop = celebrateGacha(f.host, 'physical');
  assert.equal(f.host.children.length, 1);
  assert.equal(f.host.children[0].children.filter(node => node.tagName === 'CANVAS').length, 0);
  assert.equal(f.rafs.size, 0);
  stop();
  assert.equal(f.host.children.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.motionListeners.size, 0);
});

test('detached dialogs do not retain frames, timers or preference listeners', () => {
  const f = fixture();
  celebrateGacha(f.host, 'physical');
  f.host.isConnected = false;
  f.advance(100);
  assert.equal(f.rafs.size, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.motionListeners.size, 0);
});
