import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {machineMarkup, mountMachine, prizeArt} from '../../public/events/capsule-machine.js';

function fixture(t, {reduced = false} = {}) {
  t.mock.timers.enable({apis: ['setTimeout']});
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({matches: reduced});
  t.after(() => {
    if (previous === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = previous;
  });
  const attributes = new Map();
  const live = {textContent: ''};
  const title = {textContent: ''};
  const showcase = {innerHTML: ''};
  const balls = {innerHTML: ''};
  const machine = {
    dataset: {pool: 'ordinary', phase: 'idle', count: '1'},
    classList: {contains: name => name === 'gm-machine'},
    querySelector: name => ({'.gm-live': live, '.gm-pool-title': title, '.gm-showcase': showcase, '.gm-balls': balls}[name] || null),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const controller = mountMachine(machine);
  t.after(() => controller.destroy());
  return {machine, live, title, showcase, balls, attributes, controller};
}

test('single draw drops before revealing and callback occurs exactly once', t => {
  const f = fixture(t);
  let calls = 0;
  assert.equal(f.controller.play({count: 1, onReveal: () => calls++}), true);
  assert.equal(f.machine.dataset.phase, 'spinning');
  assert.equal(f.attributes.get('aria-busy'), 'true');
  t.mock.timers.tick(1649);
  assert.equal(f.machine.dataset.phase, 'spinning');
  t.mock.timers.tick(1);
  assert.equal(f.machine.dataset.phase, 'dropping');
  assert.equal(calls, 0);
  t.mock.timers.tick(1150);
  assert.equal(f.machine.dataset.phase, 'revealed');
  assert.equal(calls, 1);
  assert.equal(f.attributes.get('aria-busy'), 'false');
  f.controller.skip();
  t.mock.timers.tick(20000);
  assert.equal(calls, 1);
});

test('five draws have a longer sequence and reveal the entire batch together', t => {
  const f = fixture(t);
  let calls = 0;
  f.controller.play({count: 5, pool: 'premium', onReveal: () => calls++});
  assert.equal(f.machine.dataset.pool, 'premium');
  assert.equal(f.machine.dataset.count, '5');
  assert.equal(f.title.textContent, '五重惊喜');
  t.mock.timers.tick(2800);
  assert.equal(f.machine.dataset.phase, 'spinning');
  assert.equal(calls, 0);
  t.mock.timers.tick(150);
  assert.equal(f.machine.dataset.phase, 'dropping');
  t.mock.timers.tick(1549);
  assert.equal(calls, 0);
  t.mock.timers.tick(1);
  assert.equal(calls, 1);
  assert.match(f.live.textContent, /五枚/);
});

test('double play is ignored without replacing the registered callback', t => {
  const f = fixture(t);
  const calls = [];
  f.controller.play({count: 1, onReveal: () => calls.push('first')});
  assert.equal(f.controller.play({count: 5, onReveal: () => calls.push('second')}), false);
  assert.equal(f.machine.dataset.count, '1');
  f.controller.skip();
  assert.deepEqual(calls, ['first']);
  t.mock.timers.tick(10000);
  assert.deepEqual(calls, ['first']);
});

test('skip supports both phases and a later draw cannot be completed by stale timers', t => {
  const f = fixture(t);
  const calls = [];
  f.controller.play({count: 1, onReveal: () => calls.push(1)});
  t.mock.timers.tick(1650);
  f.controller.skip();
  assert.equal(f.controller.play({count: 5, onReveal: () => calls.push(5)}), true);
  t.mock.timers.tick(1150);
  assert.deepEqual(calls, [1]);
  assert.equal(f.machine.dataset.phase, 'spinning');
  f.controller.skip();
  f.controller.skip();
  t.mock.timers.tick(10000);
  assert.deepEqual(calls, [1, 5]);
});

test('destroy cancels pending callbacks and disables future animation', t => {
  const f = fixture(t);
  let calls = 0;
  f.controller.play({count: 5, onReveal: () => calls++});
  t.mock.timers.tick(3000);
  f.controller.destroy();
  f.controller.destroy();
  f.controller.skip();
  t.mock.timers.tick(10000);
  assert.equal(calls, 0);
  assert.equal(f.machine.dataset.phase, 'destroyed');
  assert.equal(f.controller.play({count: 1}), false);
  assert.equal(f.attributes.get('aria-busy'), 'false');
});

test('reduced motion reveals promptly while preserving one callback', t => {
  const f = fixture(t, {reduced: true});
  let calls = 0;
  f.controller.play({count: 5, onReveal: () => calls++});
  t.mock.timers.tick(100);
  assert.equal(f.machine.dataset.phase, 'revealed');
  assert.equal(calls, 1);
  f.controller.skip();
  assert.equal(calls, 1);
});

test('invalid count fails before starting the visual transaction', t => {
  const f = fixture(t);
  assert.throws(() => f.controller.play({count: 2}), RangeError);
  assert.throws(() => f.controller.play({count: '5'}), RangeError);
  assert.equal(f.machine.dataset.phase, 'idle');
  assert.throws(() => mountMachine(null), TypeError);
});

test('mounting from a wrapper uses the same machine instance', t => {
  const f = fixture(t);
  const wrapper = {querySelector: name => name === '.gm-machine' ? f.machine : null};
  const controller = mountMachine(wrapper);
  t.after(() => controller.destroy());
  controller.play({count: 1});
  assert.equal(f.machine.dataset.phase, 'spinning');
});

test('product aliases map to present assets, including future generated sprite positions', async () => {
  const aliases = {
    ysl: 'ysl', 'YSL气垫': 'ysl',
    'coach-belt': 'c-belt', 'COACH腰带': 'c-belt',
    razer: 'razer', '雷蛇耳机': 'razer',
    'coach-wallet': 'c-wallet', 'COACH钱包': 'c-wallet',
    makeup: 'makeup', skincare: 'skincare', perfume: 'perfume',
    '鉴定券': 'voucher', 'expert-voucher': 'voucher', '再接再厉': 'none',
  };
  for (const [alias, file] of Object.entries(aliases)) {
    const html = prizeArt(alias);
    assert.match(html, new RegExp(`assets/gacha/${file}\\.svg`));
    assert.match(html, /role="img" aria-label="[^"]+"/);
    await access(new URL(`../../public/events/assets/gacha/${file}.svg`, import.meta.url));
    if (file !== 'none') assert.match(html, /gm-prize-art--sprite-ready/);
  }
  assert.match(prizeArt('c-wallet'), /--gm-sprite-x:100%;--gm-sprite-y:0%/);
  assert.match(prizeArt('voucher'), /--gm-sprite-x:100%;--gm-sprite-y:100%/);
  assert.doesNotMatch(prizeArt('ysl', {className: '" onclick="bad'}), /class="[^"]*" onclick/);
});

test('generated prize sheet is a 4 by 2 grid of square cells with alpha support', async () => {
  const png = await readFile(new URL('../../public/events/assets/gacha/prizes-sheet.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20) * 2);
  assert.ok([4, 6].includes(png[25]), 'PNG must carry grayscale or RGB alpha');
  const css = await readFile(new URL('../../public/events/capsule-machine.css', import.meta.url), 'utf8');
  assert.match(css, /\.gm-prize-art--sprite-ready \{ background-image:/);
  assert.match(css, /background-size:\s*400% 200%/);
});

test('machine markup carries no business actions and includes decorative balls and scoped accessibility', () => {
  const html = machineMarkup({pool: 'premium', compact: true});
  assert.match(html, /gm-machine--compact/);
  assert.match(html, /data-pool="premium"/);
  assert.equal((html.match(/class="gm-ball gm-ball--/g) || []).length, 8);
  assert.equal((html.match(/class="gm-drop-ball gm-drop-ball--/g) || []).length, 5);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /<button|onclick=|localStorage|<script/);
});

test('ordinary machine presents only sample prizes and vouchers, while advanced presents its four physical prizes', () => {
  const ordinary = machineMarkup({pool: 'ordinary'});
  for (const id of ['makeup', 'skincare', 'perfume', 'voucher']) {
    assert.match(ordinary, new RegExp(`assets/gacha/${id}\\.svg`));
  }
  assert.doesNotMatch(ordinary, /assets\/gacha\/(?:ysl|c-belt|razer|c-wallet)\.svg/);
  for (const pool of ['advanced', 'premium']) {
    const advanced = machineMarkup({pool});
    for (const id of ['ysl', 'c-belt', 'razer', 'c-wallet', 'voucher']) {
      assert.match(advanced, new RegExp(`assets/gacha/${id}\\.svg`));
    }
    assert.doesNotMatch(advanced, /assets\/gacha\/(?:makeup|skincare|perfume)\.svg/);
    assert.equal((advanced.match(/class="gm-ball-core"/g) || []).length, 3);
  }
  assert.equal((ordinary.match(/class="gm-ball-core"/g) || []).length, 3);
});

test('playing a different pool refreshes the prize showcase and capsule contents', t => {
  const f = fixture(t);
  f.controller.play({pool: 'advanced', count: 1});
  assert.match(f.showcase.innerHTML, /assets\/gacha\/c-belt\.svg/);
  assert.match(f.balls.innerHTML, /assets\/gacha\/voucher\.svg/);
  assert.doesNotMatch(f.balls.innerHTML, /assets\/gacha\/makeup\.svg/);
  f.controller.skip();
  f.controller.play({pool: 'ordinary', count: 1});
  assert.match(f.showcase.innerHTML, /assets\/gacha\/makeup\.svg/);
  assert.match(f.balls.innerHTML, /assets\/gacha\/perfume\.svg/);
  assert.doesNotMatch(f.balls.innerHTML, /assets\/gacha\/ysl\.svg/);
});

test('machine has no global business state and CSS stops movement for reduced motion', async () => {
  const js = await readFile(new URL('../../public/events/capsule-machine.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../public/events/capsule-machine.css', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /localStorage|sessionStorage|fetch\(/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /max-width:\s*360px/);
  assert.match(css, /gm-tumble-one/);
  assert.match(css, /gm-tumble-five/);
});

test('brand-aligned v4 cabinet keeps its moving glass capsules separate from the static body art', async () => {
  const html = machineMarkup({compact: true});
  const css = await readFile(new URL('../../public/events/capsule-machine.css', import.meta.url), 'utf8');
  const png = await readFile(new URL('../../public/events/assets/gacha/machine-body-v4.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.ok([4, 6].includes(png[25]), 'cabinet silhouette must have an alpha channel');
  const ratio = png.readUInt32BE(16) / png.readUInt32BE(20);
  assert.ok(ratio > 1.2 && ratio < 1.3, 'body asset matches the wide 5:4 visual canvas');
  assert.match(html, /class="gm-body-art" src="assets\/gacha\/machine-body-v4\.png"/);
  assert.match(html, /class="gm-chamber"/);
  assert.match(html, /class="gm-balls"/);
  assert.match(html, /class="gm-dial"/);
  assert.match(html, /class="gm-delivery"/);
  assert.doesNotMatch(html, /gm-crown|gm-device-label|gm-back-orbit|gm-running-light|machine-body-v2/);
  assert.match(css, /aspect-ratio:\s*5\s*\/\s*4/);
  assert.match(css, /#7b55ea/i);
  assert.doesNotMatch(css, /#315bff|#47ceff|#5cdcff|#f03ddb/i, 'shared device no longer reintroduces cyan and neon campaign colors');
});

test('v4 capsules fit the transparent chamber and leave room for soft movement', async () => {
  const html = machineMarkup({pool: 'advanced'});
  const css = await readFile(new URL('../../public/events/capsule-machine.css', import.meta.url), 'utf8');
  const chamber = css.match(/\.gm-chamber \{[^}]+left:([\d.]+)%; right:([\d.]+)%; top:([\d.]+)%; height:([\d.]+)%/);
  assert.ok(chamber, 'cabinet coordinates remain proportional at every viewport width');
  const [, left, right, top, height] = chamber.map(Number);
  assert.ok(left >= 13 && right >= 13 && top >= 16 && top + height <= 63,
    'moving capsules stay inside the generated amethyst glass, clear of cabinet edges');
  const chamberAspect = (100 - left - right) * 1.25 / height;
  const positions = [...html.matchAll(/--gm-x:([\d.]+)%;--gm-y:([\d.]+)%;--gm-size:([\d.]+)%/g)];
  assert.equal(positions.length, 8);
  for (const [, x, y, size] of positions.map(values => values.map(Number))) {
    assert.ok(x >= 0 && x + size <= 100, 'capsule width fits the chamber');
    assert.ok(y >= 0 && y + size * chamberAspect <= 99,
      'capsule does not fall below the glass floor at rest');
  }
  assert.equal((html.match(/gm-ball--prize"/g) || []).length, 5);
  assert.match(css, /\.gm-ball--mint/);
});

test('the rotating knob crop aligns with the original cabinet at every size', async () => {
  const css = await readFile(new URL('../../public/events/capsule-machine.css', import.meta.url), 'utf8');
  const dial = css.match(/\.gm-dial \{[^}]+left:([\d.]+)%; top:([\d.]+)%; width:([\d.]+)%; height:([\d.]+)%/);
  const crop = css.match(/\.gm-dial-ring \{[^}]+background-size:([\d.]+)% ([\d.]+)%; background-position:([\d.]+)% ([\d.]+)%/);
  assert.ok(dial && crop);
  const [, left, top, width, height] = dial.map(Number);
  const [, scaleX, scaleY, offsetX, offsetY] = crop.map(Number);
  for (const [actual, expected] of [
    [scaleX, 10000 / width], [scaleY, 10000 / height],
    [offsetX, left * 100 / (100 - width)], [offsetY, top * 100 / (100 - height)],
  ]) assert.ok(Math.abs(actual - expected) < .002, 'crop remains aligned with its static background');
  assert.match(css, /gm-knob-one 1\.65s/);
  assert.match(css, /animation-name:gm-knob-five; animation-duration:2\.95s/);
});
