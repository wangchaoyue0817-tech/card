import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDocument,FixtureElement} from './dom-fixture.mjs';
import {START,fresh,submitOrder,balances,claimDaily,draw} from '../../public/events/expert-event-model.js';
import {EVENT_KEY,eventNow,loadEvent,saveEvent,setEventClock} from '../../public/events/expert-event-session.js';
import {closeEventDialog} from '../../public/events/expert-event-ui.js';

const T=START+10*3600000;
let instance=0;
function orders(count) {
  let state=fresh('inline-test');
  for(let i=1;i<=count;i++)state=submitOrder(state,{id:`order-${i}`,category:'美妆'},T+i).state;
  return state;
}

async function harness(t,state=orders(50)) {
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(Math,'random',()=>.4);
  const document=createDocument(await readFile(new URL('../../public/events/activity.html',import.meta.url),'utf8'));
  const decorate=element=>{
    if(element.tagName!=='DIALOG')return element;
    element.showModal=()=>{element.open=true;};
    element.close=(reason='')=>{
      if(!element.open)return;
      element.open=false;element.returnValue=reason;
      element.dispatchEvent({type:'close',bubbles:false});
    };
    element.remove=()=>{
      if(element.parentElement)element.parentElement.nodes=element.parentElement.nodes.filter(node=>node!==element);
      element.parentElement=null;
    };
    return element;
  };
  const create=document.createElement.bind(document);
  document.createElement=tag=>decorate(create(tag));
  document.querySelectorAll('dialog').forEach(decorate);
  // The actual controller uses attribute-prefix selectors to lock all draw and
  // pool buttons. Extend only this fixture's selector subset, not app behavior.
  const matches=FixtureElement.prototype.matches;
  t.mock.method(FixtureElement.prototype,'matches',function(selector) {
    return selector.split(',').some(part=>{
      const prefixes=[...part.matchAll(/\[([\w-]+)\^=["']([^"']*)["']\]/g)];
      if(prefixes.some(([,name,prefix])=>!this.getAttribute(name)?.startsWith(prefix)))return false;
      return matches.call(this,part.replace(/\[[\w-]+\^=["'][^"']*["']\]/g,'')||'*');
    });
  });
  const store=new Map(),writes=[],window=new EventTarget(),navigation=[];
  const location={hash:'#lottery'};
  window.jianxRoute=route=>navigation.push(route);
  const replacements={
    document,window,location,
    history:{replaceState:(_state,_title,hash)=>{location.hash=hash;}},
    localStorage:{
      getItem:key=>store.get(key)??null,
      setItem:(key,value)=>{store.set(key,value);writes.push(key);},
    },
    requestAnimationFrame:callback=>callback(),
    matchMedia:()=>({matches:false}),
  };
  const previous=new Map(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(replacements))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  setEventClock(T+1000);saveEvent(state);
  await import(`../../public/events/activity-center.js?inline-test=${++instance}`);
  const click=selector=>{
    const target=typeof selector==='string'?document.querySelector(selector):selector;
    assert(target,`missing click target: ${selector}`);
    for(const listener of document.events.get('click')||[])listener({target});
    return target;
  };
  click('[data-action="event:expert"]');
  writes.length=0;
  t.after(()=>{
    window.dispatchEvent(new CustomEvent('jianx-shell',{detail:{type:'visibility',active:false}}));
    closeEventDialog();
    for(const [key,descriptor]of previous) {
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  });
  return {
    document,window,writes,navigation,click,
    dialog:()=>document.querySelector('.ev-center-result'),
    snapshot:()=>loadEvent(),
    balance:()=>balances(loadEvent(),eventNow()),
    shell:detail=>window.dispatchEvent(new CustomEvent('jianx-shell',{detail})),
  };
}

test('double-11 prize rules omit every stock quantity while preserving prizes and probabilities',async t=>{
  const h=await harness(t),before=h.snapshot();
  h.click('[data-action="expert-rules"]');
  const dialog=h.document.querySelector('#ac-dialog');
  assert.equal(dialog.open,true);
  const products=dialog.querySelectorAll('.ac-product');
  assert.equal(products.length,7);
  for(const product of products)assert.doesNotMatch(product.textContent,/活动限量|\d+\s*份/);
  for(const product of dialog.querySelectorAll('.ac-product[data-pool="advanced"]'))assert.equal(product.querySelector('small'),null);
  assert.match(dialog.textContent,/YSL气垫/);
  assert.match(dialog.textContent,/COACH腰带/);
  assert.match(dialog.textContent,/雷蛇耳机/);
  assert.match(dialog.textContent,/COACH钱包/);
  assert.equal(dialog.querySelectorAll('.ac-probabilities').length,2);
  for(const probability of ['5%','75%','20%','8%','72%'])assert.ok(dialog.textContent.includes(probability));
  assert.deepEqual(h.snapshot(),before,'opening prize rules must not mutate stock or draw state');
});

test('sold-out prize keeps its availability status without showing a quantity',async t=>{
  const initial=orders(0);initial.stocks['ysl-cushion']=0;
  const h=await harness(t,initial),before=h.snapshot();
  h.click('[data-action="expert-rules"]');
  const products=h.document.querySelectorAll('.ac-product');
  const soldOut=products.find(product=>product.textContent.includes('YSL气垫'));
  assert.equal(soldOut.querySelector('small').textContent,'已抽完');
  for(const product of products)assert.doesNotMatch(product.textContent,/活动限量|\d+\s*份/);
  assert.deepEqual(h.snapshot(),before);
});

test('inline five-draw persists once, locks controls, and skips without re-debiting',async t=>{
  const h=await harness(t),before=h.balance(),machine=h.document.querySelector('.gm-machine');
  const draw=h.document.querySelector('[data-action="draw:5"]');
  h.click(draw);h.click(draw);
  assert.equal(h.snapshot().draws.length,1);
  assert.equal(h.snapshot().draws[0].rewards.length,5);
  assert.equal(h.balance().ordinary,before.ordinary-5);
  assert.equal(h.balance().advanced,before.advanced);
  assert.deepEqual(h.writes,[EVENT_KEY]);
  assert.equal(h.document.querySelector('.gm-machine'),machine,'save notifications must retain the running machine');
  assert.equal(machine.dataset.phase,'spinning');
  assert.equal(draw.disabled,true);
  for(const pool of h.document.querySelectorAll('.ac-pool-selector button'))assert.equal(pool.disabled,true);
  assert.equal(h.document.querySelector('[data-action="skip-draw"]').hidden,false);
  h.click('[data-action="skip-draw"]');
  h.click('[data-action="skip-draw"]');
  t.mock.timers.tick(10000);
  assert(h.dialog());
  assert.equal(h.snapshot().draws.length,1);
  assert.deepEqual(h.writes,[EVENT_KEY]);
  assert.equal(h.balance().ordinary,before.ordinary-5);
  assert.equal(h.document.querySelectorAll('.gacha-celebration').length,0,'completed celebration removes its decoration');
});

test('single-draw completion reveals once and uses only the selected advanced ticket',async t=>{
  const h=await harness(t),before=h.balance();
  h.click('[data-action="pool:advanced"]');
  h.click('[data-action="draw:1"]');
  const machine=h.document.querySelector('.gm-machine');
  assert.equal(h.snapshot().draws[0].pool,'advanced');
  assert.equal(h.balance().advanced,before.advanced-1);
  assert.equal(h.balance().ordinary,before.ordinary);
  t.mock.timers.tick(2799);
  assert.equal(h.dialog(),null);
  assert.equal(machine.dataset.phase,'dropping');
  t.mock.timers.tick(1);
  assert(h.dialog());
  assert.equal(h.dialog().querySelector('.ev-guide-earn'),null,'an unspent guide must not attach onboarding to an advanced-ticket draw');
  assert.equal(h.document.querySelectorAll('.ev-center-result').length,1);
  assert.equal(h.snapshot().draws.length,1);
  assert.deepEqual(h.writes,[EVENT_KEY]);
  t.mock.timers.tick(10000);
  assert.equal(h.document.querySelectorAll('.ev-center-result').length,1);
  assert.equal(h.snapshot().draws.length,1);
});

test('a deferred first guide in the inline center explains continued earning and opens expert selection without another debit',async t=>{
  const initial=claimDaily(orders(9),T).state;
  initial.guideShownTicketId=initial.guideTicketId;
  const h=await harness(t,initial);
  let selections=0;
  h.window.openExpertSelection=()=>{assert.equal(h.dialog(),null);selections++;};
  h.click('[data-action="draw:1"]');
  const saved=h.snapshot();
  h.click('[data-action="skip-draw"]');
  const result=h.dialog();
  assert(result.classList.contains('ev-onboarding-result'));
  assert.equal(result.getAttribute('aria-label'),'双11专鉴有礼');
  assert.equal(saved.draws[0].rewards[0].type,'none');
  assert.equal(saved.tickets.find(ticket=>ticket.firstGuide).remaining,0);
  assert.match(result.querySelector('.ev-guide-distance').textContent,/再鉴\s*1\s*单，得高级抽奖券/);
  assert.equal(result.querySelectorAll('.ev-guide-rewards .ev-reward-art').length,2);
  assert.equal(result.querySelector('[data-result-again]'),null);
  assert.equal(result.querySelector('[data-result-prizes]'),null);
  assert.equal(result.querySelector('[data-result-expert]').textContent.trim(),'去专鉴赢抽奖券');
  result.querySelector('[data-comfort-hug]').click();
  assert.match(result.querySelector('[data-comfort-caption]').textContent,/抱抱已送达/);
  result.querySelector('[data-result-expert]').click();
  assert.equal(selections,1);
  assert.equal(h.dialog(),null);
  assert.deepEqual(h.snapshot(),saved);
  assert.deepEqual(h.writes,[EVENT_KEY]);
});

test('post-guide later action keeps the current center and selected pool without re-awarding or re-drawing',async t=>{
  const h=await harness(t,orders(0));
  h.click('[data-action="draw:1"]');
  h.click('[data-action="skip-draw"]');
  const saved=h.snapshot(),later=h.dialog().querySelector('[data-result-later]');
  later.click();later.click();
  t.mock.timers.tick(10000);
  assert.equal(h.dialog(),null);
  assert.equal(h.document.querySelector('#tab-lottery').getAttribute('aria-selected'),'true');
  assert.equal(h.document.querySelector('[data-action="pool:ordinary"]').getAttribute('aria-selected'),'true');
  assert.deepEqual(h.snapshot(),saved);
  assert.deepEqual(h.writes,[EVENT_KEY]);
});

test('inline five-draw containing a deferred guide retains winning vouchers and the My Prizes destination',async t=>{
  const h=await harness(t,orders(8));
  h.click('[data-action="draw:5"]');
  h.click('[data-action="skip-draw"]');
  const saved=h.snapshot(),result=h.dialog();
  assert.equal(saved.draws[0].rewards.filter(reward=>reward.type==='none').length,1);
  assert.equal(saved.draws[0].rewards.filter(reward=>reward.type==='voucher').length,4);
  assert.match(result.querySelector('.coupon-value').textContent,/×4/);
  assert.equal(result.querySelectorAll('.ev-result-card.is-empty').length,1);
  assert(result.querySelector('.ev-guide-earn'));
  assert.equal(result.querySelector('[data-result-again]'),null);
  result.querySelector('[data-result-prizes]').click();
  assert.equal(h.dialog(),null);
  assert.equal(h.document.querySelector('#tab-prizes').getAttribute('aria-selected'),'true');
  assert(h.document.querySelector(`[data-action="result:expert:${saved.draws[0].id}"]`));
  assert.deepEqual(h.snapshot(),saved);
  assert.deepEqual(h.writes,[EVENT_KEY]);
});

test('an already consumed first guide does not alter regular inline results or repeat controls',async t=>{
  const claimed=claimDaily(orders(4),T).state;
  const initial=draw(claimed,{pool:'ordinary',count:1,requestId:'previous-guide'},T+10,()=>.4).state;
  const h=await harness(t,initial);
  h.click('[data-action="draw:1"]');
  h.click('[data-action="skip-draw"]');
  const result=h.dialog();
  assert.equal(result.getAttribute('aria-label'),'扭蛋结果');
  assert.equal(result.querySelector('.ev-guide-earn'),null);
  assert.equal(result.querySelector('[data-result-later]'),null);
  assert(result.querySelector('[data-result-again]'));
  assert.equal(result.querySelector('[data-result-prizes]').classList.contains('ev-primary'),true);
});

test('switching to My Prizes during animation retains the committed batch and cancels late result overlays',async t=>{
  const h=await harness(t);
  h.click('[data-action="draw:1"]');
  const saved=h.snapshot(),id=saved.draws[0].id;
  h.click('[data-action="route-prizes"]');
  assert(h.document.querySelector(`[data-action="result:expert:${id}"]`));
  assert.equal(h.document.querySelector('#tab-prizes').getAttribute('aria-selected'),'true');
  t.mock.timers.tick(10000);
  assert.equal(h.dialog(),null);
  assert.deepEqual(h.snapshot(),saved);
  assert.deepEqual(h.writes,[EVENT_KEY]);
  h.click('[data-action="route-lottery"]');
  assert(h.document.querySelector('.ac-choices'));
  h.click('[data-action="event:expert"]');
  assert.equal(h.document.querySelector('[data-action="draw:1"]').disabled,false);
  assert.deepEqual(h.snapshot(),saved);
});

test('shell navigation away preserves the draw and leaves no delayed overlay on return',async t=>{
  const h=await harness(t);
  h.click('[data-action="draw:5"]');
  const saved=h.snapshot();
  h.shell({type:'visibility',active:false});
  t.mock.timers.tick(10000);
  assert.equal(h.dialog(),null);
  assert.deepEqual(h.snapshot(),saved);
  h.shell({type:'activate',route:'prizes'});
  assert(h.document.querySelector(`[data-action="result:expert:${saved.draws[0].id}"]`));
  assert.deepEqual(h.snapshot(),saved);
  assert.deepEqual(h.writes,[EVENT_KEY]);
});

test('disabled insufficient-ticket actions do not save a draw or mutate legacy history',async t=>{
  const h=await harness(t,orders(0));
  h.click('[data-action="pool:advanced"]');
  assert.equal(h.document.querySelector('[data-action="draw:1"]').disabled,true);
  h.click('[data-action="draw:1"]');
  assert.equal(h.snapshot().draws.length,0);
  assert.deepEqual(h.writes,[]);
  h.click('[data-action="choose-activity"]');
  h.click('[data-action="event:card-past"]');
  h.click('[data-action="draw-one"]');
  assert.equal(h.snapshot().draws.length,0);
  assert.deepEqual(h.writes,[]);
});

test('Double 11 ticket status switches stay inline, include both pools, and never alter stored balances',async t=>{
  const h=await harness(t,orders(10)),before=h.snapshot(),balance=h.balance();
  assert(h.document.querySelector('.et-tickets'));
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/高级抽奖券/);
  h.click('[data-action="tickets-used"]');
  assert.equal(h.document.querySelector('[data-action="tickets-used"]').getAttribute('aria-pressed'),'true');
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/暂无抽奖券使用记录/);
  assert.equal(h.document.querySelector('#ac-dialog').open,undefined);
  h.click('[data-action="tickets-expired"]');
  assert.equal(h.document.querySelector('[data-action="tickets-expired"]').getAttribute('aria-pressed'),'true');
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/暂无已过期抽奖券/);
  h.click('[data-action="tickets-unused"]');
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/普通抽奖券/);
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/高级抽奖券/);
  assert.deepEqual(h.snapshot(),before);
  assert.deepEqual(h.balance(),balance);
  assert.deepEqual(h.writes,[]);
});

test('the compact ranking entry opens both boards while the removed detail entry leaves inline ticket management intact',async t=>{
  const h=await harness(t,orders(10)),before=h.snapshot();
  assert.equal(h.document.querySelector('[data-action="ticket-details"]'),null);
  const entry=h.document.querySelector('.ac-ranking-entry');
  assert.equal(entry.getAttribute('aria-label'),'查看专鉴王者榜');
  assert(entry.querySelector('.ac-ranking-emblem'));
  h.click(entry);
  const ranking=h.document.querySelector('.ev-ranking-dialog');
  assert(ranking?.open);
  assert.equal(ranking.getAttribute('aria-label'),'专鉴王者榜');
  assert.equal(ranking.querySelector('[data-kind="true"]').getAttribute('aria-selected'),'true');
  ranking.querySelector('[data-kind="false"]').click();
  assert.equal(ranking.querySelector('[data-kind="false"]').getAttribute('aria-selected'),'true');
  ranking.querySelector('[data-ev-close]').click();
  assert.equal(h.document.querySelector('.ev-ranking-dialog'),null);
  h.click('[data-action="tickets-used"]');
  assert.equal(h.document.querySelector('[data-action="tickets-used"]').getAttribute('aria-pressed'),'true');
  assert(h.document.querySelector('#et-ticket-records'));
  assert.deepEqual(h.snapshot(),before);
  assert.deepEqual(h.writes,[]);
});

test('closing a revealed result removes celebration immediately without changing the saved draw',async t=>{
  const h=await harness(t);
  h.click('[data-action="pool:advanced"]');
  h.click('[data-action="draw:1"]');
  h.click('[data-action="skip-draw"]');
  const dialog=h.dialog(),saved=h.snapshot();
  assert(dialog);
  assert(dialog.querySelector('.gacha-celebration'));
  dialog.close();
  assert.equal(dialog.querySelector('.gacha-celebration'),null);
  assert.equal(dialog.isConnected,false);
  t.mock.timers.tick(10000);
  assert.equal(h.dialog(),null);
  assert.deepEqual(h.snapshot(),saved);
  assert.deepEqual(h.writes,[EVENT_KEY]);
});
