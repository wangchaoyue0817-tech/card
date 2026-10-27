import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDraw} from '../public/draw-experience.js';

function mockElement() {
  const classes = new Set();
  const attributes = new Map();
  return {
    dataset: {}, disabled: false, hidden: false, innerHTML: '', textContent: '',
    events: {}, focused: false,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name); else classes.delete(name);
        return enabled;
      }
    },
    addEventListener(name, listener) { this.events[name] = listener; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    focus() { this.focused = true; }
  };
}

function fixture(t, {reduced = false} = {}) {
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({matches: reduced});
  t.after(() => {
    if (originalMatchMedia === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = originalMatchMedia;
  });
  t.mock.timers.enable({apis: ['setTimeout']});

  const nodes = new Map([
    '.draw-live', '.draw-intro', '.draw-quiet', '.draw-skip',
    '.draw-batch-actions', '.draw-details'
  ].map(selector => [selector, mockElement()]));
  nodes.get('.draw-skip').hidden = true;
  nodes.get('.draw-batch-actions').hidden = true;
  const buttons = Array.from({length: 5}, () => {
    const button = mockElement();
    button.front = mockElement();
    button.querySelector = selector => selector === '.draw-card-front' ? button.front : null;
    return button;
  });
  const root = mockElement();
  root.dataset.phase = 'selecting';
  root.querySelectorAll = selector => selector === '[data-pick]' ? buttons : [];
  root.querySelector = selector => nodes.get(selector) ?? null;
  const dialog = {querySelector: selector => selector === '.draw-experience' ? root : null};
  return {dialog, root, buttons, nodes};
}

const voucherRewards = count => Array.from({length: count}, (_,index) => ({
  id: `voucher-${index}`, type: 'voucher', at: 1, expiresAt: 604800001
}));

function session(t, {count = 5, pool = 'ordinary', rewards = voucherRewards(count), reduced = false, error} = {}) {
  const f = fixture(t, {reduced});
  const batch = {id: 'test-batch', pool, at: 1, rewards};
  const calls = {commits: 0, completed: [], errors: [], effects: [], stoppedEffects: []};
  const stop = mountDraw({
    dialog: f.dialog, count, pool,
    photo: prize => `<span data-test-prize="${prize.id}"></span>`,
    commit() {
      calls.commits++;
      return error ? {error} : {batch};
    },
    onComplete: result => calls.completed.push(result),
    onError: message => calls.errors.push(message),
    effect(host, tier) {
      assert.equal(host, f.dialog);
      calls.effects.push(tier);
      return () => calls.stoppedEffects.push(tier);
    }
  });
  t.after(stop);
  return {...f, batch, calls, stop};
}

function assertFiveRevealed(f) {
  assert.equal(f.root.dataset.phase, 'revealed');
  assert.equal(f.buttons.filter(button => button.classList.contains('is-flipped')).length, 5);
  for (const [index, button] of f.buttons.entries()) {
    assert.equal(button.getAttribute('aria-hidden'), 'false');
    assert.ok(button.front.innerHTML.length > 0);
    assert.match(button.getAttribute('aria-label'), new RegExp(`第 ${index + 1} 份奖品`));
  }
  assert.equal(f.nodes.get('.draw-skip').hidden, true);
  assert.equal(f.nodes.get('.draw-batch-actions').hidden, false);
}

test('selection opens without spending and duplicate picks commit only once', t => {
  const f = session(t, {pool: 'welcome'});
  assert.equal(f.calls.commits, 0);
  assert.ok(f.buttons.every(button => button.front.innerHTML === ''));
  f.buttons[2].events.click();
  f.buttons[1].events.click();
  f.buttons[2].events.click();
  assert.equal(f.calls.commits, 1);
  assert.ok(f.buttons.every(button => button.disabled));

  // Skipping a five-draw animation reveals the batch without leaving it.
  f.nodes.get('.draw-skip').onclick();
  f.nodes.get('.draw-skip').onclick();
  assertFiveRevealed(f);
  assert.equal(f.calls.completed.length, 0);
  f.nodes.get('.draw-details').onclick();
  f.nodes.get('.draw-details').onclick();
  assert.deepEqual(f.calls.completed, [f.batch]);
  assert.equal(f.calls.commits, 1);
});

test('closing selection cancels the session without a draw', t => {
  const f = session(t, {count: 1});
  f.stop();
  f.buttons[0].events.click();
  t.mock.timers.tick(30000);
  assert.equal(f.calls.commits, 0);
  assert.equal(f.calls.completed.length, 0);
  assert.equal(f.calls.effects.length, 0);
});

test('expired-ticket commit rejection cannot reveal or retry in same session', t => {
  const f = session(t, {count: 1, error: '过期'});
  f.buttons[0].events.click();
  f.buttons[3].events.click();
  t.mock.timers.tick(30000);
  assert.equal(f.calls.commits, 1);
  assert.deepEqual(f.calls.errors, ['过期']);
  assert.equal(f.calls.completed.length, 0);
  assert.ok(f.buttons.every(button => button.front.innerHTML === ''));
  assert.equal(f.calls.effects.length, 0);
});

test('closing committed animation cannot later complete or commit again', t => {
  const f = session(t, {count: 1});
  f.buttons[1].events.click();
  f.stop();
  f.nodes.get('.draw-skip').onclick();
  f.buttons[2].events.click();
  t.mock.timers.tick(30000);
  assert.equal(f.calls.commits, 1);
  assert.equal(f.calls.completed.length, 0);
  assert.ok(f.buttons.every(button => button.front.innerHTML === ''));
  assert.equal(f.calls.effects.length, 0);
});

for (const pool of ['ordinary', 'welcome']) {
  test(`${pool} five-draw reveals all five together and stays until explicit details`, t => {
    const f = session(t, {pool});
    f.buttons[4].events.click();
    t.mock.timers.tick(619);
    assert.ok(f.buttons.every(button => !button.classList.contains('is-flipped')));
    assert.ok(f.buttons.every(button => button.front.innerHTML === ''));

    t.mock.timers.tick(1);
    assertFiveRevealed(f);
    const revealedFaces = f.buttons.map(button => button.front.innerHTML);
    t.mock.timers.tick(30000);
    assertFiveRevealed(f);
    assert.deepEqual(f.buttons.map(button => button.front.innerHTML), revealedFaces);
    assert.equal(f.calls.commits, 1);
    assert.equal(f.calls.completed.length, 0);
    assert.deepEqual(f.calls.effects, ['voucher']);

    f.nodes.get('.draw-details').onclick();
    f.nodes.get('.draw-details').onclick();
    t.mock.timers.tick(30000);
    assert.deepEqual(f.calls.completed, [f.batch]);
    assert.equal(f.calls.commits, 1);
    assert.deepEqual(f.calls.stoppedEffects, ['voucher']);
  });
}

test('skip immediately reveals five and cancels the scheduled second reveal', t => {
  const f = session(t);
  f.buttons[0].events.click();
  f.nodes.get('.draw-skip').onclick();
  assertFiveRevealed(f);
  f.nodes.get('.draw-skip').onclick();
  t.mock.timers.tick(30000);
  assertFiveRevealed(f);
  assert.equal(f.calls.commits, 1);
  assert.equal(f.calls.completed.length, 0);
  assert.deepEqual(f.calls.effects, ['voucher']);
});

test('closing five-draw before reveal cancels timers and all later controls', t => {
  const f = session(t);
  f.buttons[3].events.click();
  t.mock.timers.tick(100);
  f.stop();
  f.nodes.get('.draw-skip').onclick();
  f.buttons[0].events.click();
  t.mock.timers.tick(30000);
  assert.equal(f.calls.commits, 1);
  assert.equal(f.calls.completed.length, 0);
  assert.equal(f.calls.effects.length, 0);
  assert.ok(f.buttons.every(button => button.front.innerHTML === ''));
});

test('closing revealed five-draw stops effects without completing or spending again', t => {
  const f = session(t);
  f.buttons[2].events.click();
  t.mock.timers.tick(620);
  assertFiveRevealed(f);
  t.mock.timers.tick(350);
  assert.deepEqual(f.calls.effects, ['voucher']);
  f.stop();
  f.stop();
  f.nodes.get('.draw-details').onclick();
  f.nodes.get('.draw-skip').onclick();
  f.buttons[1].events.click();
  t.mock.timers.tick(30000);
  assert.deepEqual(f.calls.stoppedEffects, ['voucher']);
  assert.equal(f.calls.completed.length, 0);
  assert.equal(f.calls.commits, 1);
});

test('mixed five-draw keeps each reward in its own card and celebrates the rare batch', t => {
  const rewards = voucherRewards(5);
  rewards[2] = {id: 'physical-2', type: 'physical', prizeId: 'coin', at: 1};
  const f = session(t, {rewards});
  f.buttons[4].events.click();
  t.mock.timers.tick(620);
  assertFiveRevealed(f);
  assert.equal(f.root.dataset.tier, 'rare');
  assert.deepEqual(f.buttons.map(button => button.dataset.tier), ['voucher', 'voucher', 'rare', 'voucher', 'voucher']);
  assert.match(f.buttons[2].front.innerHTML, /data-test-prize="coin"/);
  for (const index of [0, 1, 3, 4]) assert.match(f.buttons[index].front.innerHTML, /专家线上/);
  t.mock.timers.tick(30000);
  assert.deepEqual(f.calls.effects, ['rare']);
  assert.equal(f.calls.completed.length, 0);
});

test('reduced motion still reveals all five and waits for explicit details', t => {
  const f = session(t, {reduced: true});
  f.buttons[1].events.click();
  t.mock.timers.tick(120);
  assertFiveRevealed(f);
  t.mock.timers.tick(30000);
  assert.equal(f.calls.completed.length, 0);
  f.nodes.get('.draw-details').onclick();
  assert.deepEqual(f.calls.completed, [f.batch]);
  assert.equal(f.calls.commits, 1);
});

test('single draw reveals only the selected card and retains its automatic completion', t => {
  const f = session(t, {count: 1});
  f.buttons[3].events.click();
  t.mock.timers.tick(360);
  assert.deepEqual(f.buttons.map(button => button.classList.contains('is-flipped')), [false, false, false, true, false]);
  assert.deepEqual(f.buttons.map(button => button.getAttribute('aria-hidden')), ['true', 'true', 'true', 'false', 'true']);
  assert.equal(f.calls.completed.length, 0);
  t.mock.timers.tick(1650);
  assert.deepEqual(f.calls.completed, [f.batch]);
  f.nodes.get('.draw-skip').onclick();
  t.mock.timers.tick(30000);
  assert.equal(f.calls.completed.length, 1);
  assert.equal(f.calls.commits, 1);
});
