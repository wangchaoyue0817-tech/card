import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {mountSecondPhaseEntry, secondPhaseEntry} from '../public/events/phase2-entry.js';

const shellSource = readFileSync(new URL('../public/site-shell.js', import.meta.url), 'utf8');

function shellFixture(hash = '#home') {
  const events = new Map(), frames = [], loading = {hidden: true}, historyCalls = [];
  const location = {hash, origin: 'http://localhost:4181'};
  const document = {
    title: '',
    querySelector(selector) {
      assert.equal(selector, '.site-shell');
      return {append(frame) {frames.push(frame);}};
    },
    getElementById(id) {assert.equal(id, 'site-loading'); return loading;},
    createElement(tag) {
      assert.equal(tag, 'iframe');
      const sent = [];
      return {
        dataset: {}, hidden: false, sent,
        contentWindow: {postMessage(message, origin) {sent.push({message: structuredClone(message), origin});}}
      };
    }
  };
  const history = Object.fromEntries(['pushState', 'replaceState'].map(type => [type, (state, _title, url) => {
    historyCalls.push({type, state, url});
    location.hash = new URL(url, location.origin).hash;
  }]));
  const context = vm.createContext({document, location, history, window: {
    addEventListener(type, callback) {events.set(type, callback);}
  }});
  vm.runInContext(shellSource, context, {filename: 'site-shell.js'});
  const send = (frame, message, overrides = {}) => events.get('message')({
    origin: location.origin, source: frame.contentWindow, data: {channel: 'jianx-module', ...message}, ...overrides
  });
  const navigate = route => {location.hash = `#${route}`; events.get('hashchange')();};
  return {frames, document, location, events, loading, historyCalls, send, navigate};
}

const lastActivation = frame => frame.sent.filter(entry => entry.message.type === 'activate').at(-1)?.message;

test('unified root retains home, skin detection, skin management and orders at their original pages', () => {
  for (const [route, module, pathname] of [
    ['home', 'home', '/home.html'],
    ['skin', 'skin', '/skin.html'],
    ['skin-management', 'skin', '/skin.html'],
    ['orders', 'skin', '/skin.html']
  ]) {
    const f = shellFixture(`#${route}`), frame = f.frames[0];
    const url = new URL(frame.src, f.location.origin);
    assert.equal(frame.dataset.module, module);
    assert.equal(url.pathname, pathname);
    assert.equal(url.hash, `#${route}`);
    assert.equal(url.searchParams.get('embedded'), '1');
    f.send(frame, {type: 'ready'});
    assert.equal(lastActivation(frame).route, route);
    assert.equal(f.loading.hidden, true);
  }
  const f = shellFixture('#skin'), frame = f.frames[0];
  f.send(frame, {type: 'ready'});
  f.navigate('skin-management');
  f.navigate('orders');
  assert.equal(f.frames.length, 1, 'skin destinations reuse their existing frame');
  assert.equal(lastActivation(frame).route, 'orders');
});

test('expert and card routes use imported activity pages while EB05 has its independent page', () => {
  for (const [route, module, pathname] of [
    ['expert', 'expert', '/events/home.html'],
    ['card', 'card', '/events/card.html'],
    ['card-eb05', 'phase2', '/phase2.html']
  ]) {
    const f = shellFixture(`#${route}`), frame = f.frames[0];
    const url = new URL(frame.src, f.location.origin);
    assert.equal(frame.dataset.module, module);
    assert.equal(url.pathname, pathname);
    assert.equal(url.hash, `#${route}`);
    assert.equal(url.searchParams.get('embedded'), '1');
    assert.equal(url.searchParams.get('tab'), route === 'expert' ? 'expert' : null);
    f.send(frame, {type: 'ready'});
    assert.equal(lastActivation(frame).route, route);
  }
});

test('lottery, prizes and ranking share the imported activity frame and preserve latest pending destination', () => {
  const f = shellFixture('#lottery'), frame = f.frames[0];
  assert.equal(frame.dataset.module, 'activity');
  assert.equal(new URL(frame.src, f.location.origin).pathname, '/events/activity.html');
  f.navigate('prizes');
  f.navigate('ranking');
  assert.equal(f.frames.length, 1);
  assert.equal(lastActivation(frame), undefined);
  f.send(frame, {type: 'ready'});
  assert.equal(lastActivation(frame).route, 'ranking');
  assert.match(f.document.title, /专鉴荣誉榜/);
  f.send(frame, {type: 'navigate', route: 'prizes'});
  assert.equal(f.frames.length, 1);
  assert.equal(lastActivation(frame).route, 'prizes');
});

test('new conversation resets loaded modules and returns to the original home rather than expert home', () => {
  const f = shellFixture(), home = f.frames[0];
  f.send(home, {type: 'ready'});
  for (const route of ['expert', 'card', 'lottery', 'card-eb05']) {
    f.navigate(route);
    f.send(f.frames.at(-1), {type: 'ready'});
  }
  const phase2 = f.frames.at(-1);
  f.send(phase2, {type: 'new-chat'});
  assert.equal(f.location.hash, '#home');
  assert.equal(home.hidden, false);
  assert.equal(lastActivation(home).route, 'home');
  assert.equal(lastActivation(home).intent, 'new-chat');
  assert.equal(f.frames.length, 5);
  for (const frame of f.frames) {
    assert.equal(frame.hidden, frame !== home);
    assert.ok(frame.sent.some(entry => entry.message.type === 'reset-chat'));
  }
});

test('menu navigation forwards activity, pool and ticket status before ready and on an existing frame', () => {
  const f = shellFixture('#expert'), expert = f.frames[0];
  f.send(expert, {type: 'ready'});
  f.send(expert, {type: 'navigate', route: 'lottery', event: 'expert', pool: 'advanced', ticketStatus: 'expired'});
  const activity = f.frames[1];
  assert.equal(lastActivation(activity), undefined);
  f.send(activity, {type: 'ready'});
  assert.equal(lastActivation(activity).event, 'expert');
  assert.equal(lastActivation(activity).pool, 'advanced');
  assert.equal(lastActivation(activity).ticketStatus, 'expired');
  f.send(activity, {type: 'navigate', route: 'lottery', event: 'card-past', pool: 'ordinary', ticketStatus: 'used'});
  assert.equal(f.frames.length, 2);
  assert.equal(lastActivation(activity).event, 'card-past');
  assert.equal(lastActivation(activity).pool, 'ordinary');
  assert.equal(lastActivation(activity).ticketStatus, 'used');
  f.send(activity, {type: 'navigate', route: 'lottery', event: 'card-next', ticketStatus: 'unused'});
  assert.equal(lastActivation(activity).event, 'card-next');
  assert.equal(lastActivation(activity).ticketStatus, 'unused');
});

test('menu routing drops unsupported activity metadata without losing a valid destination', () => {
  const f = shellFixture(), home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.send(home, {type: 'navigate', route: 'lottery', event: 'unknown', pool: 'welcome', ticketStatus: 'all', unexpected: true});
  const activity = f.frames[1];
  f.send(activity, {type: 'ready'});
  const activation = lastActivation(activity);
  assert.equal(activation.route, 'lottery');
  for (const key of ['event', 'pool', 'ticketStatus', 'unexpected']) assert.equal(Object.hasOwn(activation, key), false);
});

test('expert-home AI tab route notification activates original root home across modules', () => {
  const f = shellFixture('#expert'), expert = f.frames[0];
  f.send(expert, {type: 'ready'});
  f.send(expert, {type: 'route', route: 'home'});
  assert.equal(f.location.hash, '#home');
  assert.equal(f.frames.length, 2);
  const home = f.frames[1];
  assert.equal(home.dataset.module, 'home');
  assert.equal(new URL(home.src, f.location.origin).pathname, '/home.html');
  assert.equal(expert.hidden, true);
  f.send(home, {type: 'ready'});
  assert.equal(lastActivation(home).route, 'home');
  f.send(expert, {type: 'route', route: 'expert'});
  assert.equal(f.location.hash, '#home', 'inactive expert frame cannot override the selected home');
});

test('late module ready cannot cover current destination or dismiss its loading indicator', () => {
  const f = shellFixture('#expert'), expert = f.frames[0];
  f.navigate('card-eb05');
  const phase2 = f.frames[1];
  f.send(expert, {type: 'ready'});
  assert.equal(expert.hidden, true);
  assert.equal(lastActivation(expert), undefined);
  assert.equal(f.location.hash, '#card-eb05');
  assert.equal(f.loading.hidden, false);
  f.send(phase2, {type: 'ready'});
  assert.equal(lastActivation(phase2).route, 'card-eb05');
  assert.equal(f.loading.hidden, true);
  assert.equal(phase2.hidden, false);
  f.navigate('expert');
  assert.equal(f.frames.length, 2);
  assert.equal(lastActivation(expert).route, 'expert');
  assert.equal(expert.hidden, false);
  assert.equal(phase2.hidden, true);
});

test('root shell keeps photo intent across the imported card route and ignores untrusted messages', () => {
  const f = shellFixture(), home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.send(home, {type: 'navigate', route: 'card'}, {origin: 'https://other.invalid'});
  f.send(home, {type: 'navigate', route: 'card'}, {source: {}});
  f.send(home, {type: 'navigate', route: 'unknown'});
  assert.equal(f.frames.length, 1);
  f.send(home, {type: 'navigate', route: 'card', intent: 'choose-card', photo: {url: 'blob:test-photo'}});
  const card = f.frames[1];
  f.send(card, {type: 'ready'});
  assert.equal(lastActivation(card).intent, 'choose-card');
  assert.deepEqual(lastActivation(card).photo, {url: 'blob:test-photo'});
});

function choicesFixture({hasChoices = true, hasPast = true} = {}) {
  const inserted = [];
  const expert = Object.freeze({action: 'event:expert', content: '双11扭蛋活动'});
  const past = Object.freeze({
    action: 'event:card-past', content: '卡牌抽奖活动',
    insertAdjacentHTML(position, html) {
      assert.equal(position, 'beforebegin');
      const entry = {phase2: true, html};
      inserted.push({position, html});
      children.splice(children.indexOf(past), 0, entry);
    }
  });
  const children = hasPast ? [expert, past] : [expert];
  const choices = {
    querySelector(selector) {
      if (selector === '[data-phase2-entry]') return children.find(entry => entry.phase2) || null;
      if (selector === '[data-action="event:card-past"]') return hasPast ? past : null;
      assert.fail(`Unexpected selector: ${selector}`);
    },
    insertAdjacentHTML(position, html) {
      assert.equal(position, 'beforeend');
      inserted.push({position, html});
      children.push({phase2: true, html});
    }
  };
  const root = {querySelector(selector) {assert.equal(selector, '.ac-choices'); return hasChoices ? choices : null;}};
  return {root, choices, children, inserted, expert, past};
}

test('second-phase entry mounts once without replacing, reordering or changing the original two activities', () => {
  const f = choicesFixture();
  const expertSnapshot = {...f.expert}, pastSnapshot = {...f.past};
  mountSecondPhaseEntry(f.root);
  mountSecondPhaseEntry(f.root);
  assert.equal(f.inserted.length, 1);
  assert.equal(f.children.length, 3);
  assert.equal(f.children[0], f.expert);
  assert.equal(f.children[2], f.past);
  assert.deepEqual(f.expert, expertSnapshot);
  assert.deepEqual(f.past, pastSnapshot);
  assert.equal(f.children[1].phase2, true);
  assert.match(f.inserted[0].html, /data-phase2-entry/);
  assert.match(f.inserted[0].html, /海贼 EB05 上新/);
  assert.match(f.inserted[0].html, /10\.30 — 11\.05/);
});

test('second-phase entry safely handles pages without a chooser and appends once if archived entry is absent', () => {
  const missing = choicesFixture({hasChoices: false});
  assert.doesNotThrow(() => mountSecondPhaseEntry(missing.root));
  assert.equal(missing.inserted.length, 0);
  const f = choicesFixture({hasPast: false});
  mountSecondPhaseEntry(f.root);
  mountSecondPhaseEntry(f.root);
  assert.equal(f.inserted.length, 1);
  assert.equal(f.inserted[0].position, 'beforeend');
  assert.equal(f.children[0], f.expert);
  assert.equal(f.children.length, 2);
  assert.equal(f.inserted[0].html, secondPhaseEntry());
});
