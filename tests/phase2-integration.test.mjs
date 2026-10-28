import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createDocument} from './events/dom-fixture.mjs';
import {processAppraisal, enterCardPage} from '../public/phase2-appraisal.js';
import {
  START, END, DAY, fresh, available, dailyCount, dailyResultCount, draw,
  prizeStatus, dayKey, share
} from '../public/phase2-model.js';
import {PHASE2_KEY, loadPhase2, savePhase2, setPhase2Clock, phase2Now} from '../public/phase2-session.js';
import {isEligibleCategory} from '../public/events/expert-event-model.js';

const T = START + 12 * 3_600_000;
const newUser = () => fresh({uid: 'phase2-integration-user', registeredAt: T - 60_000});
const names = {
  ai: 'jianx-card-ai-result',
  paid: 'jianx-card-expert-paid',
  expert: 'jianx-card-expert-result'
};
const complete = (state, type, id, detail = {}, now = T) => processAppraisal(
  state, names[type], {id, category: '卡牌', success: true, ...detail}, now
);

test('card AI success awards one ordinary ticket and adds one completed result without mutating its input', () => {
  const state = newUser(), original = structuredClone(state);
  const response = complete(state, 'ai', 'ai-1');
  assert.equal(response.awarded, true);
  assert.equal(response.amount, 1);
  assert.equal(dailyCount(response.state, T), 1);
  assert.equal(dailyResultCount(response.state, T), 1);
  assert.deepEqual(available(response.state, T), {ordinary: 1, welcome: 0});
  assert.equal(response.state.results[0].kind, 'ai');
  assert.equal(response.state.results[0].category, 'card');
  assert.deepEqual(state, original);
  const replay = complete(response.state, 'ai', 'ai-1');
  assert.deepEqual(replay.state, response.state, 're-rendering or replaying one result cannot reward twice');
});

test('expert payment awards only a ticket and its later result adds only the result threshold', () => {
  const payment = complete(newUser(), 'paid', 'expert-1', {payment: 'cash'});
  assert.equal(payment.amount, 1);
  assert.equal(dailyCount(payment.state, T), 1);
  assert.equal(dailyResultCount(payment.state, T), 0);
  assert.equal(payment.state.payments.length, 1);
  const report = complete(payment.state, 'expert', 'expert-1', {result: 'true'});
  assert.equal(report.awarded, false);
  assert.equal(dailyCount(report.state, T), 1);
  assert.equal(dailyResultCount(report.state, T), 1);
  assert.equal(available(report.state, T).ordinary, 1);
  assert.equal(report.state.results[0].kind, 'expert');
  const paidAgain = complete(report.state, 'paid', 'expert-1', {payment: 'cash'});
  const resultAgain = complete(paidAgain.state, 'expert', 'expert-1', {result: 'true'});
  assert.deepEqual(resultAgain.state, report.state, 'payment and final result retain their own replay guards');
});

test('AI and expert results for the same reference count as separate completed services but expert completion never grants', () => {
  const ai = complete(newUser(), 'ai', 'shared-reference');
  const paid = complete(ai.state, 'paid', 'shared-reference', {payment: 'cash'});
  const expert = complete(paid.state, 'expert', 'shared-reference', {result: 'false'});
  assert.equal(dailyCount(expert.state, T), 2);
  assert.equal(dailyResultCount(expert.state, T), 2);
  assert.equal(available(expert.state, T).ordinary, 2);
});

test('only explicit successful card events participate; unrelated categories, failed events and unknown events remain inert', () => {
  for (const type of Object.keys(names)) {
    for (const detail of [
      {category: '美妆', success: true},
      {category: '银行卡', success: true},
      {category: 'card-other', success: true},
      {category: '', success: true},
      {category: '卡牌', success: false},
      {category: 'card', success: undefined},
      {category: 'card', success: 'true'}
    ]) {
      const state = newUser();
      const response = processAppraisal(state, names[type], {id: 'excluded', ...detail}, T);
      assert.deepEqual(response.state, state, `${type}: ${JSON.stringify(detail)}`);
      assert.equal(Boolean(response.awarded), false);
    }
  }
  const state = newUser();
  assert.deepEqual(processAppraisal(state, 'expert-order-submitted', {id: 'free-submit', category: '卡牌', success: true}, T).state, state);
  const english = complete(state, 'ai', 'english-category', {category: 'card'});
  assert.equal(dailyCount(english.state, T), 1);
});

test('daily identification cap does not stop completed-result progress or cause an extra share entitlement', () => {
  let state = newUser(), sharePrompts = 0;
  for (let index = 1; index <= 70; index++) {
    const response = complete(state, 'ai', `threshold-ai-${index}`);
    state = response.state;
    if (response.sharePrompt) sharePrompts++;
  }
  assert.equal(dailyCount(state, T), 10);
  assert.equal(dailyResultCount(state, T), 70);
  assert.equal(available(state, T).ordinary, 10);
  assert.equal(sharePrompts, 1);
  assert.equal(prizeStatus(state, 'chopper', T).open, true);
  assert.equal(prizeStatus(state, 'eb05-box', T).open, false);
  const paid = complete(state, 'paid', 'payment-after-cap', {payment: 'cash'});
  assert.equal(dailyCount(paid.state, T), 10);
  assert.equal(dailyResultCount(paid.state, T), 70);
  const report = complete(paid.state, 'expert', 'payment-after-cap');
  assert.equal(dailyResultCount(report.state, T), 71);
  assert.equal(available(report.state, T).ordinary, 10);
  const tomorrow = complete(report.state, 'ai', 'next-day-ai', {}, T + DAY);
  assert.equal(dailyCount(tomorrow.state, T + DAY), 1);
  assert.equal(dailyResultCount(tomorrow.state, T + DAY), 1);
  assert.equal(prizeStatus(tomorrow.state, 'chopper', T + DAY).open, false);
});

test('successful voucher payment consumes the designated EB05 voucher once and awards without adding a result', () => {
  let state = complete(newUser(), 'ai', 'voucher-seed').state;
  state = draw(state, 'ordinary', 1, T, () => 0.99).state;
  assert.equal(state.vouchers.length, 1);
  const voucherId = state.vouchers[0].id;
  const paid = complete(state, 'paid', 'voucher-payment', {payment: 'voucher', voucherId});
  assert.equal(paid.state.vouchers[0].used, true);
  assert.equal(paid.amount, 1);
  assert.equal(dailyResultCount(paid.state, T), 1);
  assert.equal(dailyCount(paid.state, T), 2);
  assert.deepEqual(complete(paid.state, 'paid', 'voucher-payment', {payment: 'voucher', voucherId}).state, paid.state);
});

test('newcomer gift is issued once on the card secondary page and stays separate from ordinary tickets', () => {
  const state = newUser();
  const first = enterCardPage(state, {route: 'card'}, T);
  assert.equal(first.awarded, true);
  assert.equal(first.amount, 5);
  assert.deepEqual(available(first.state, T), {ordinary: 0, welcome: 5});
  assert.equal(dailyCount(first.state, T), 0);
  assert.equal(dailyResultCount(first.state, T), 0);
  assert.equal(first.state.welcome.expiresAt, T + DAY);
  assert.deepEqual(enterCardPage(first.state, {route: 'card'}, T + 1).state, first.state);
});

test('homepage recognition and photo handoffs never issue a newcomer gift, while a later direct card-page entry may', () => {
  for (const detail of [
    {}, {route: 'home'}, {route: 'card-eb05'}, {route: 'lottery'},
    {route: 'card', fromPhoto: true}, {route: 'card', photo: {url: 'blob:photo'}},
    {route: 'card', intent: 'choose-card'}
  ]) {
    const state = newUser();
    const response = enterCardPage(state, detail, T);
    assert.deepEqual(response.state, state, JSON.stringify(detail));
    assert.equal(Boolean(response.awarded), false);
  }
  const fromPhoto = enterCardPage(newUser(), {route: 'card', intent: 'choose-card', photo: {url: 'blob:photo'}}, T);
  assert.equal(enterCardPage(fromPhoto.state, {route: 'card'}, T + 1).awarded, true);
});

test('old registered users and visits outside the EB05 activity period never receive its newcomer gift', () => {
  const old = fresh({uid: 'existing-user', registeredAt: START - 1});
  assert.deepEqual(enterCardPage(old, {route: 'card'}, T).state, old);
  for (const now of [START - 1, END]) {
    const state = newUser();
    assert.deepEqual(enterCardPage(state, {route: 'card'}, now).state, state);
    assert.equal(dailyResultCount(complete(state, 'ai', 'outside', {}, now).state, now), 0);
  }
});

test('saving an adapted card event uses the EB05 clock and preserves both existing activities byte for byte', () => {
  const originals = new Map([
    ['jianx-card-preview-v1', '{"legacy":"unchanged"}'],
    ['jianx-expert-event-2026-v1', '{"double11":"unchanged"}']
  ]);
  const values = new Map(originals), writes = [];
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => {values.set(key, value); writes.push(key);}
  };
  setPhase2Clock(T, storage);
  const now = phase2Now(storage);
  const response = complete(loadPhase2(storage), 'ai', 'isolated-result', {}, now);
  savePhase2(response.state, storage);
  assert.equal(dailyCount(loadPhase2(storage), now), 1);
  assert.equal(dailyResultCount(loadPhase2(storage), now), 1);
  assert.equal(new Set(writes).size, 1);
  assert.equal(writes[0], PHASE2_KEY);
  for (const [key, value] of originals) assert.equal(values.get(key), value);
  assert.equal(isEligibleCategory('卡牌'), false, 'the second campaign must not make cards eligible for Double 11 milestones');
});

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
function reachableScripts(entry) {
  const pending = [path.join(publicRoot, entry)], visited = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    const refs = file.endsWith('.html')
      ? [...source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(match => match[1])
      : [...source.matchAll(/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?["']([^"']+)["']/g)].map(match => match[1]);
    for (const ref of refs) {
      if (/^(?:https?:|\/\/)/.test(ref)) continue;
      pending.push(path.resolve(path.dirname(file), ref.split(/[?#]/)[0]));
    }
  }
  return visited;
}

test('card and expert pages load the EB05 service bridge through their actual script dependency graph', () => {
  for (const entry of ['events/card.html', 'events/home.html']) {
    const reachable = reachableScripts(entry);
    assert.ok(reachable.has(path.join(publicRoot, 'phase2-service-bridge.js')), `${entry} must wire the event listener`);
    assert.ok(reachable.has(path.join(publicRoot, 'phase2-appraisal.js')), `${entry} must use the tested adapter`);
  }
});

test('real card AI and expert lifecycle sources emit the three separate bridge events at completed actions', () => {
  const card = readFileSync(path.join(publicRoot, 'events/card-app.js'), 'utf8');
  const expert = readFileSync(path.join(publicRoot, 'events/expert-event-home.js'), 'utf8');
  const bridge = readFileSync(path.join(publicRoot, 'phase2-service-bridge.js'), 'utf8');
  assert.match(card, /const CARD_CAMPAIGN_ENABLED=false;/, 'first-period storage must remain archived');
  const aiAction = card.match(/case 'identify':\{([\s\S]*?)case 'expert':/)?.[1];
  assert.ok(aiAction?.includes(names.ai), 'AI event must be emitted from the successful identify completion');
  assert.ok(expert.includes(names.paid), 'expert payment confirmation emits its own event');
  assert.ok(expert.includes(names.expert), 'expert final result emits its own event');
  assert.match(expert, /(?:演示|模拟)支付成功/);
  const phase2 = readFileSync(path.join(publicRoot, 'phase2.js'), 'utf8');
  assert.match(phase2, /(?:model\.)?useVoucher\s*\(/, 'voucher redemption uses an actual won voucher in the EB05 UI');
  for (const name of Object.values(names)) assert.ok(bridge.includes(name), `missing bridge subscription for ${name}`);
});

const grantSource = readFileSync(new URL('../public/phase2-grant-dialog.js', import.meta.url), 'utf8');
function grantFixture({standalone = false} = {}) {
  let state = newUser(), now = T, response;
  for (let index = 0; index < 10; index++) {
    response = complete(state, 'ai', `grant-ai-${index}`);
    state = response.state;
  }
  const document = createDocument('<body><button id="origin">鉴定入口</button></body>');
  document.hidden = false;
  document.getElementById('origin').focus();
  const events = new Map(), navigation = [], created = [], closeEvents = [];
  const originalCreate = document.createElement.bind(document);
  document.createElement = tag => {
    const element = originalCreate(tag);
    if (tag === 'dialog') {
      created.push(element);
      element.open = false;
      element.showModal = () => {element.open = true;};
      element.close = () => {
        if (!element.open) return;
        element.open = false;
        // Native dialog.close() queues a close event rather than dispatching
        // synchronously. Departure must persist forfeiture before that task.
        closeEvents.push(() => element.dispatchEvent({type: 'close', bubbles: false}));
      };
    }
    return element;
  };
  const window = {
    parent: {},
    addEventListener(type, listener) {
      const list = events.get(type) || []; list.push(listener); events.set(type, list);
    },
    jianxNavigate: (route, detail) => navigation.push({route, detail})
  };
  if (standalone) window.parent = window;
  const location = {href: 'http://localhost:4181/events/card.html'};
  const context = vm.createContext({
    window, document, location, Intl, URL, END, dayKey, dailyCount, share,
    testModuleURL: 'http://localhost:4181/phase2-grant-dialog.js',
    loadPhase2: () => structuredClone(state),
    savePhase2: next => {state = structuredClone(next); return structuredClone(state);},
    phase2Now: () => now
  });
  vm.runInContext(grantSource.replace(/^import .*;\n/gm, '').replace(/\bexport /g, '').replaceAll('import.meta.url', 'testModuleURL'), context, {filename: 'phase2-grant-dialog.js'});
  const click = selector => {
    const target = created.at(-1).querySelector(selector);
    assert.ok(target, `Expected grant control ${selector}`);
    if (!target.disabled) target.dispatchEvent({type: 'click', target, currentTarget: target});
  };
  const emit = (type, detail) => {for (const listener of events.get(type) || []) listener({type, detail});};
  return {
    document, location, navigation, click, emit,
    get state() {return structuredClone(state);},
    get dialog() {return created.at(-1);},
    get response() {return response;},
    get pendingCloseEvents() {return closeEvents.length;},
    flushCloseEvents() {while (closeEvents.length) closeEvents.shift()();},
    show(result = response) {context.showPhase2Grant(result);},
    close() {context.closePhase2Grant();},
    setNow(value) {now = value;},
    setState(value) {state = structuredClone(value);},
    hideDocument() {
      document.hidden = true;
      for (const listener of document.events.get('visibilitychange') || []) listener({type: 'visibilitychange'});
    }
  };
}

test('all close and leave paths dismiss the one-off tenth-ticket sharing opportunity without changing earned tickets', () => {
  const endings = [
    ['close button', f => f.click('.p2-sg-close')],
    ['later button', f => f.click('.p2-sg-later')],
    ['escape', f => f.dialog.dispatchEvent({type: 'cancel'})],
    ['backdrop', f => f.dialog.dispatchEvent({type: 'click', target: f.dialog})],
    ['center navigation', f => f.click('[data-p2-go]')],
    ['pagehide', f => f.emit('pagehide')],
    ['hidden iframe', f => f.emit('jianx-shell', {type: 'visibility', active: false})],
    ['new conversation', f => f.emit('jianx-shell', {type: 'reset-chat'})],
    ['hidden document', f => f.hideDocument()]
  ];
  for (const [label, leave] of endings) {
    const f = grantFixture();
    f.show();
    assert.equal(f.dialog.open, true, label);
    assert.equal(f.state.days[dayKey(T)].share, 'pending', label);
    assert.ok(f.dialog.querySelector('[data-p2-share]'), label);
    leave(f);
    assert.equal(f.dialog.open, false, label);
    assert.equal(f.dialog.isConnected, false, label);
    assert.equal(f.state.days[dayKey(T)].share, 'dismissed', label);
    assert.equal(available(f.state, T).ordinary, 10, label);
    assert.equal(share(f.state, T, 'claim').awarded, false, `${label}: no later claim`);
    assert.equal(f.pendingCloseEvents, 1, `${label}: native close is still queued`);
    const beforeCloseEvent = f.state;
    f.flushCloseEvents();
    assert.deepEqual(f.state, beforeCloseEvent, `${label}: deferred native close is idempotent`);
  }
});

test('one-off sharing awards exactly five tickets and closing afterward preserves the claimed state', () => {
  const f = grantFixture();
  f.show();
  f.click('[data-p2-share]');
  assert.equal(f.state.days[dayKey(T)].share, 'claimed');
  assert.equal(available(f.state, T).ordinary, 15);
  assert.equal(dailyCount(f.state, T), 10);
  assert.equal(f.dialog.querySelector('[data-p2-share]').disabled, true);
  f.click('[data-p2-share]');
  f.close();
  assert.equal(available(f.state, T).ordinary, 15);
  assert.equal(f.state.days[dayKey(T)].share, 'claimed');
  assert.equal(f.document.activeElement.id, 'origin');
  f.flushCloseEvents();
  assert.equal(available(f.state, T).ordinary, 15);
  assert.equal(f.state.days[dayKey(T)].share, 'claimed');
});

test('an overnight stale sharing dialog cannot claim yesterday reward or consume a fresh next-day opportunity', () => {
  const f = grantFixture();
  f.show();
  f.setNow(T + DAY);
  let state = f.state;
  for (let index = 0; index < 10; index++) state = complete(state, 'ai', `tomorrow-${index}`, {}, T + DAY).state;
  f.setState(state);
  f.click('[data-p2-share]');
  assert.equal(available(f.state, T + DAY).ordinary, 20);
  assert.equal(f.dialog.querySelector('[data-p2-share]').disabled, true);
  f.close();
  assert.equal(f.state.days[dayKey(T)].share, 'dismissed');
  assert.equal(f.state.days[dayKey(T + DAY)].share, 'pending');
  assert.equal(share(f.state, T + DAY, 'claim').amount, 5);
  const beforeCloseEvent = f.state;
  f.flushCloseEvents();
  assert.deepEqual(f.state, beforeCloseEvent, 'late native close cannot dismiss a different daily opportunity');
});

test('replacing a sharing dialog forfeits its pending opportunity, while an inert result leaves it open', () => {
  const f = grantFixture();
  f.show();
  const original = f.dialog;
  f.show({state: f.state, awarded: false, capped: false, amount: 0});
  assert.equal(f.dialog, original);
  assert.equal(original.open, true);
  f.show({state: f.state, awarded: true, amount: 1});
  assert.equal(original.open, false);
  assert.equal(f.state.days[dayKey(T)].share, 'dismissed');
  assert.equal(f.dialog.open, true);
  assert.equal(f.dialog.querySelector('[data-p2-share]'), null);
  const replacement = f.dialog, beforeCloseEvent = f.state;
  f.flushCloseEvents();
  assert.deepEqual(f.state, beforeCloseEvent);
  assert.equal(replacement.open, true, 'late close from the old dialog cannot close its replacement');
  assert.equal(f.document.activeElement, replacement.querySelector('.p2-sg-close'), 'late close cannot steal focus from the new dialog');
});

test('standalone card-page navigation resolves to the unified root shell and forfeits before native close dispatch', () => {
  const f = grantFixture({standalone: true});
  f.show();
  f.click('[data-p2-go]');
  assert.equal(f.location.href, 'http://localhost:4181/index.html#card-eb05');
  assert.equal(f.state.days[dayKey(T)].share, 'dismissed');
  assert.equal(f.dialog.open, false);
  assert.equal(f.pendingCloseEvents, 1);
  assert.equal(f.navigation.length, 0, 'a standalone page navigates its top document rather than an absent parent frame');
  f.flushCloseEvents();
  assert.equal(f.state.days[dayKey(T)].share, 'dismissed');
});

const serviceBridgeSource = readFileSync(new URL('../public/phase2-service-bridge.js', import.meta.url), 'utf8');
function serviceBridgeFixture({active = true, hidden = false} = {}) {
  let state = newUser();
  for (let index = 0; index < 9; index++) state = complete(state, 'ai', `background-ai-${index}`).state;
  const events = new Map(), shown = [], microtasks = [];
  const window = {
    parent: {}, jianxActive: active,
    addEventListener(type, listener) {
      const list = events.get(type) || []; list.push(listener); events.set(type, list);
    }
  };
  const document = {hidden, getElementById: () => null};
  const context = vm.createContext({
    window, document, location: {hash: '#card'},
    queueMicrotask: callback => microtasks.push(callback),
    processAppraisal, enterCardPage, share,
    loadPhase2: () => structuredClone(state),
    savePhase2: next => {state = structuredClone(next); return structuredClone(state);},
    phase2Now: () => T,
    showPhase2Grant: (result, options) => shown.push({result: structuredClone(result), options})
  });
  vm.runInContext(serviceBridgeSource.replace(/^import .*;\n/gm, ''), context, {filename: 'phase2-service-bridge.js'});
  const emit = (type, detail) => {
    const event = {type, detail, defaultPrevented: false, preventDefault() {this.defaultPrevented = true;}};
    for (const listener of events.get(type) || []) listener(event);
    return event;
  };
  return {window, document, shown, emit, get state() {return structuredClone(state);}};
}

test('the tenth AI result completing in a hidden frame or background tab immediately forfeits share without opening a hidden dialog', () => {
  for (const visibility of [{active: false, hidden: false}, {active: true, hidden: true}]) {
    const f = serviceBridgeFixture(visibility);
    const detail = {id: 'background-tenth', category: '卡牌', success: true};
    f.emit(names.ai, detail);
    assert.equal(dailyCount(f.state, T), 10);
    assert.equal(dailyResultCount(f.state, T), 10);
    assert.equal(available(f.state, T).ordinary, 10);
    assert.equal(f.state.days[dayKey(T)].share, 'dismissed', JSON.stringify(visibility));
    assert.equal(f.shown.length, 0, 'no dialog is created outside the foreground surface');
    assert.equal(share(f.state, T, 'claim').awarded, false);
    f.window.jianxActive = true;
    f.document.hidden = false;
    f.emit(names.ai, detail);
    assert.equal(f.state.days[dayKey(T)].share, 'dismissed', 'returning and replaying cannot restore a forfeited opportunity');
    assert.equal(available(f.state, T).ordinary, 10);
  }
});

test('a foreground tenth result keeps the one-off opportunity pending and opens the actual award dialog once', () => {
  const f = serviceBridgeFixture();
  f.emit(names.ai, {id: 'foreground-tenth', category: '卡牌', success: true});
  assert.equal(f.state.days[dayKey(T)].share, 'pending');
  assert.equal(f.shown.length, 1);
  assert.equal(f.shown[0].result.sharePrompt, true);
  assert.equal(f.shown[0].result.amount, 1);
});
