import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../../public/events/site-shell.js', import.meta.url), 'utf8');
function fixture(hash = '#home') {
  const events = new Map(), frames = [], loading = {hidden: true}, historyCalls = [];
  const location = {hash, origin: 'http://localhost:4181'};
  const document = {
    title: '',
    querySelector(selector) { assert.equal(selector, '.site-shell'); return {append(frame) { frames.push(frame); }}; },
    getElementById(id) { assert.equal(id, 'site-loading'); return loading; },
    createElement(tag) {
      assert.equal(tag, 'iframe');
      const sent = [];
      return {dataset: {}, hidden: false, sent, contentWindow: {postMessage(message, origin) { sent.push({message: structuredClone(message), origin}); }}};
    }
  };
  const history = Object.fromEntries(['pushState', 'replaceState'].map(type => [type, (state, _title, url) => {
    historyCalls.push({type, state, url});
    location.hash = new URL(url, location.origin).hash;
  }]));
  const context = vm.createContext({document, location, history, window: {addEventListener(type, callback) { events.set(type, callback); }}});
  vm.runInContext(source, context, {filename: 'site-shell.js'});
  const send = (frame, message, overrides = {}) => events.get('message')({
    origin: location.origin, source: frame.contentWindow, data: {channel: 'jianx-module', ...message}, ...overrides
  });
  const navigate = route => { location.hash = `#${route}`; events.get('hashchange')(); };
  return {frames, document, location, events, loading, historyCalls, send, navigate};
}
const lastActivation = frame => frame.sent.filter(entry => entry.message.type === 'activate').at(-1)?.message;

test('six public routes activate home, card or the shared activity module', () => {
  const modules={home:'home',expert:'home',card:'card',lottery:'activity',prizes:'activity',ranking:'activity'};
  for (const [route,module] of Object.entries(modules)) {
    const f = fixture(`#${route}`);
    assert.equal(f.frames.length, 1);
    const frame = f.frames[0];
    assert.equal(frame.dataset.module,module);
    if (route === 'expert') assert.match(frame.src, /tab=expert/);
    if (module !== 'home') assert.equal(new URL(frame.src, f.location.origin).hash, `#${route}`);
    f.send(frame, {type: 'ready'});
    assert.equal(lastActivation(frame).route, route);
    assert.equal(f.loading.hidden, true);
  }
  for (const route of ['skin', 'skin-management', 'orders', 'unknown']) {
    const f = fixture(`#${route}`);
    assert.equal(f.location.hash, '#home');
    assert.equal(f.frames[0].dataset.module, 'home');
  }
});

test('module navigation waits for ready and preserves photo intent across iframe activation', () => {
  const f = fixture();
  const home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.send(home, {type: 'navigate', route: 'card', intent: 'choose-card', photo: {url: 'blob:photo'}});
  assert.equal(f.location.hash, '#card');
  assert.equal(f.frames.length, 2);
  const card = f.frames[1];
  assert.equal(home.hidden, true);
  assert.equal(lastActivation(card), undefined);
  f.send(card, {type: 'ready'});
  assert.deepEqual(lastActivation(card), {channel: 'jianx-shell', type: 'activate', route: 'card', intent: 'choose-card', photo: {url: 'blob:photo'}});
  f.send(card, {type: 'navigate', route: 'lottery'});
  assert.equal(f.frames.length, 3);
  const activity=f.frames[2];
  assert.equal(activity.dataset.module,'activity');
  assert.equal(card.hidden,true);
  assert.equal(lastActivation(activity),undefined);
  assert.equal(f.loading.hidden,false);
  f.send(activity,{type:'ready'});
  assert.equal(lastActivation(activity).route,'lottery');
  assert.equal(f.loading.hidden,true);
  f.send(activity,{type:'navigate',route:'prizes'});
  assert.equal(f.frames.length,3);
  assert.equal(lastActivation(activity).route,'prizes');
});

test('a late ready message from the inactive module cannot dismiss active loading', () => {
  const f = fixture();
  const home = f.frames[0];
  f.navigate('card');
  const card = f.frames[1];
  f.send(home, {type: 'ready'});
  assert.equal(home.hidden, true);
  assert.equal(f.loading.hidden, false, 'active card module is still waiting for ready');
  assert.equal(lastActivation(home), undefined);
  f.send(card, {type: 'ready'});
  assert.equal(f.loading.hidden, true);
  assert.equal(lastActivation(card).route, 'card');
});

test('new conversation resets all three loaded modules and reuses the home frame', () => {
  const f = fixture();
  const home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.send(home, {type: 'navigate', route: 'card'});
  const card = f.frames[1];
  f.send(card, {type: 'ready'});
  f.send(card,{type:'navigate',route:'lottery'});
  const activity=f.frames[2];
  f.send(activity,{type:'ready'});
  f.send(activity, {type: 'new-chat'});
  assert.equal(f.location.hash, '#home');
  assert.equal(home.hidden, false);
  assert.equal(card.hidden, true);
  assert.equal(activity.hidden,true);
  assert.equal(f.frames.length, 3);
  for (const frame of f.frames) assert.ok(frame.sent.some(entry => entry.message.type === 'reset-chat'));
  assert.equal(lastActivation(home).intent, 'new-chat');
});

test('back navigation and same-module route messages keep URL, title and visibility synchronized', () => {
  const f = fixture();
  const home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.navigate('lottery');
  const activity = f.frames[1];
  f.send(activity, {type: 'ready'});
  f.send(activity, {type: 'route', route: 'prizes'});
  assert.equal(f.location.hash, '#prizes');
  assert.match(f.document.title, /我的奖品/);
  assert.equal(f.historyCalls.at(-1).type, 'replaceState');
  f.location.hash = '#home';
  f.events.get('popstate')();
  assert.equal(home.hidden, false);
  assert.equal(activity.hidden, true);
  assert.equal(lastActivation(home).route, 'home');
  f.send(activity, {type: 'route', route: 'prizes'});
  assert.equal(f.location.hash, '#home', 'inactive module cannot overwrite active route');
});

test('activity routes share one frame and the latest pending route wins before ready',()=>{
  const f=fixture('#lottery'),activity=f.frames[0];
  f.navigate('prizes');
  f.navigate('ranking');
  assert.equal(f.frames.length,1);
  assert.equal(f.loading.hidden,false);
  assert.equal(lastActivation(activity),undefined);
  f.send(activity,{type:'ready'});
  assert.equal(lastActivation(activity).route,'ranking');
  assert.match(f.document.title,/专鉴荣誉榜/);
  f.send(activity,{type:'route',route:'card'});
  assert.equal(f.location.hash,'#ranking','activity cannot pretend to be the card module');
});

test('late card ready cannot activate it over the pending activity page',()=>{
  const f=fixture('#card'),card=f.frames[0];
  f.navigate('lottery');
  const activity=f.frames[1];
  f.send(card,{type:'ready'});
  assert.equal(card.hidden,true);
  assert.equal(lastActivation(card),undefined);
  assert.equal(f.loading.hidden,false);
  f.send(activity,{type:'ready'});
  assert.equal(lastActivation(activity).route,'lottery');
  assert.equal(activity.hidden,false);
  f.navigate('card');
  assert.equal(f.frames.length,2);
  assert.equal(card.hidden,false);
  assert.equal(activity.hidden,true);
  assert.equal(lastActivation(card).route,'card');
});

test('messages from wrong origins, unknown windows and invalid destinations are ignored', () => {
  const f = fixture();
  const home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.send(home, {type: 'navigate', route: 'card'}, {origin: 'https://other.invalid'});
  f.send(home, {type: 'navigate', route: 'card'}, {source: {}});
  f.send(home, {type: 'navigate', route: 'orders'});
  assert.equal(f.location.hash, '#home');
  assert.equal(f.frames.length, 1);
});

test('demo event, pool and ticket filter survive navigation into a newly created activity frame',()=>{
  const f=fixture(),home=f.frames[0];
  f.send(home,{type:'ready'});
  f.send(home,{type:'navigate',route:'lottery',event:'expert',pool:'advanced',ticketStatus:'expired'});
  const activity=f.frames[1];
  assert.equal(lastActivation(activity),undefined);
  f.send(activity,{type:'ready'});
  const activation=lastActivation(activity);
  assert.equal(activation.event,'expert');
  assert.equal(activation.pool,'advanced');
  assert.equal(activation.ticketStatus,'expired');
});

test('ready activity frame receives valid history and future campaign selections without recreation',()=>{
  const f=fixture(),home=f.frames[0];
  f.send(home,{type:'ready'});
  f.send(home,{type:'navigate',route:'lottery',event:'card-past',ticketStatus:'expired'});
  const activity=f.frames[1];
  f.send(activity,{type:'ready'});
  assert.equal(lastActivation(activity).event,'card-past');
  assert.equal(lastActivation(activity).ticketStatus,'expired');
  f.send(activity,{type:'navigate',route:'lottery',event:'card-next'});
  assert.equal(f.frames.length,2);
  assert.equal(lastActivation(activity).event,'card-next');
  f.send(activity,{type:'navigate',route:'prizes',event:'expert',pool:'ordinary',ticketStatus:'used'});
  assert.equal(lastActivation(activity).pool,'ordinary');
  assert.equal(lastActivation(activity).ticketStatus,'used');
});

test('shell rejects unknown campaign, pool and ticket-status values while preserving the destination',()=>{
  const f=fixture(),home=f.frames[0];
  f.send(home,{type:'ready'});
  f.send(home,{
    type:'navigate',route:'lottery',event:'another-campaign',pool:'welcome',
    ticketStatus:'all',unexpected:'must not forward'
  });
  const activity=f.frames[1];
  f.send(activity,{type:'ready'});
  const activation=lastActivation(activity);
  assert.equal(activation.route,'lottery');
  for(const key of ['event','pool','ticketStatus','unexpected'])assert.equal(Object.hasOwn(activation,key),false);
});

test('latest pending scene metadata wins before the activity frame becomes ready',()=>{
  const f=fixture(),home=f.frames[0];
  f.send(home,{type:'ready'});
  f.send(home,{type:'navigate',route:'lottery',event:'card-past',ticketStatus:'expired'});
  const activity=f.frames[1];
  f.send(home,{type:'navigate',route:'lottery',event:'expert',pool:'advanced',ticketStatus:'unused'});
  f.send(activity,{type:'ready'});
  const activation=lastActivation(activity);
  assert.equal(activation.event,'expert');
  assert.equal(activation.pool,'advanced');
  assert.equal(activation.ticketStatus,'unused');
  assert.equal(f.frames.length,2);
});
