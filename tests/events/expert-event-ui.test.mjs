import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-fixture.mjs';
import {START,END,DAY,VOUCHER_END,fresh,submitOrder,claimDaily,draw} from '../../public/events/expert-event-model.js';
import {loadEvent,saveEvent,setEventClock} from '../../public/events/expert-event-session.js';
import {
  eventCount,progressGeometry,progressMarkup,focusProgress,resultMarkup,activityHubMarkup,
  firstGuideMarkup,isFirstGuideBatch,
  rankingState,openActivityHub,openDraw,closeEventDialog,openRules,openProgress,openLeaderboard,showEventDialog
} from '../../public/events/expert-event-ui.js';

const T=START+10*3600000;
function orders(count) {
  let state=fresh('current-user');
  for(let i=1;i<=count;i++)state=submitOrder(state,{id:`expert-${i}`,category:'美妆'},T+i).state;
  return state;
}
const view=html=>createDocument(`<main>${html}</main>`);
function dialogHarness(t,state=orders(14)) {
  const document=createDocument('<body><button id="previous">活动入口</button></body>');
  const createElement=document.createElement.bind(document);
  document.createElement=tag=>{
    const element=createElement(tag);
    if(tag==='dialog') {
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
    }
    return element;
  };
  const storage=new Map(),window=new EventTarget(),navigations=[];
  window.jianxNavigate=(...args)=>navigations.push(args);
  const replacements={
    document,window,
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    requestAnimationFrame:callback=>callback(),
    matchMedia:()=>({matches:true})
  };
  const previous=new Map(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(replacements))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  setEventClock(T+1000);saveEvent(state);
  t.after(()=>{
    closeEventDialog();
    for(const [key,descriptor]of previous) {
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  });
  return {document,window,navigations,dialog:()=>document.querySelector('dialog')};
}

test('14 submitted orders display their real cumulative count and keep earlier milestones available',()=>{
  const state=orders(14),document=view(progressMarkup(state));
  assert.equal(eventCount(state),14);
  assert.match(document.querySelector('.ev-progress-heading').textContent,/已完成\s*14\s*单/);
  const milestones=document.querySelectorAll('[data-step]');
  assert.deepEqual(milestones.map(node=>Number(node.dataset.step)),[2,4,6,8,10,12,14,16,18,20]);
  for(const step of [2,10,14])assert.equal(document.querySelector(`[data-step="${step}"]`).classList.contains('is-done'),true);
  assert.equal(document.querySelector('[data-step="16"]').classList.contains('is-next'),true);
  assert.equal(document.querySelector('[data-step="16"]').classList.contains('is-done'),false);
  assert.equal(document.querySelector('.ev-milestone-scroll').tabIndex,0);
  assert.match(document.querySelector('.ev-progress-note').textContent,/再鉴\s*2\s*单/);
});

test('the tenth milestone is advanced instead of ordinary and the next milestone continues at twelve',()=>{
  const before=view(progressMarkup(orders(9)));
  const tenth=before.querySelector('[data-step="10"]');
  assert.equal(tenth.classList.contains('is-premium'),true);
  assert.equal(tenth.classList.contains('is-next'),true);
  assert.equal(tenth.querySelector('small').textContent,'高级券');
  assert.match(before.querySelector('.ev-progress-note').textContent,/再鉴\s*1\s*单，得高级券/);
  const after=view(progressMarkup(orders(10)));
  assert.equal(after.querySelector('[data-step="10"]').classList.contains('is-done'),true);
  assert.equal(after.querySelector('[data-step="12"]').classList.contains('is-next'),true);
  assert.equal(after.querySelector('[data-step="12"] small').textContent,'普通券');
  assert.equal(after.querySelectorAll('[data-step="10"]').length,1);
});

test('compact AI card progress and full dialog show the same actual history',()=>{
  const state=orders(14);
  const full=view(progressMarkup(state)),compact=view(progressMarkup(state,{compact:true}));
  assert.equal(full.querySelector('.ev-progress-heading').textContent,compact.querySelector('.ev-progress-heading').textContent);
  assert.deepEqual(full.querySelectorAll('[data-step]').map(node=>node.getAttribute('aria-label')),compact.querySelectorAll('[data-step]').map(node=>node.getAttribute('aria-label')));
});

test('progress excludes card and other categories, other users, and submissions outside activity',()=>{
  let state=orders(2);
  for(const [id,category,now] of [
    ['card','卡牌',T],['other','配饰',T],['early','包袋',START-1],['late','美妆',END]
  ])state=submitOrder(state,{id,category},now).state;
  state.orders.push({id:'different-user',uid:'other',category:'美妆',eligible:true,at:T});
  state.orders.push({id:'excluded-even-if-valid-category',uid:state.uid,category:'美妆',eligible:false,at:T});
  assert.equal(state.orders.length,8);
  assert.equal(eventCount(state),2);
  assert.match(view(progressMarkup(state)).querySelector('.ev-progress-heading').textContent,/已完成\s*2\s*单/);
});

test('all seven approved category groups contribute to the same progress count',()=>{
  let state=fresh();
  ['beauty','bags','footwear','apparel','watches','electronics-appliances','electronics-nondestructive'].forEach((category,index)=>{
    state=submitOrder(state,{id:`group-${index}`,category},T).state;
  });
  assert.equal(eventCount(state),7);
  assert.match(view(progressMarkup(state)).querySelector('.ev-progress-note').textContent,/距高级券\s*3\s*单/);
});

test('a no-prize single draw shows encouragement and directs the user to expert identification',()=>{
  const document=view(resultMarkup({pool:'ordinary',rewards:[{id:'no-prize',type:'none'}]}));
  assert.equal(document.querySelector('h2').textContent,'再接再厉');
  assert.equal(document.querySelectorAll('[data-comfort]').length,1);
  assert.equal(document.querySelector('[data-comfort]').dataset.emptyCount,'1');
  assert(document.querySelector('[data-comfort-hug]'));
  assert.match(document.querySelector('[data-comfort-caption]').textContent,/抱抱/);
  assert.equal(document.querySelectorAll('.is-physical').length,0);
  assert.match(document.querySelector('[data-result-expert]').textContent,/去专鉴/);
  assert.doesNotMatch(document.querySelector('.ev-result-heading').textContent,/好礼已抵达/);
});

test('five draw results retain each blank result and distinguish the actual physical and voucher wins',()=>{
  const document=view(resultMarkup({
    pool:'advanced',rewards:[
      {id:'p',type:'physical',prizeId:'ysl-cushion'},
      {id:'v1',type:'voucher',expiresAt:VOUCHER_END},
      {id:'n1',type:'none'},
      {id:'v2',type:'voucher',expiresAt:VOUCHER_END},
      {id:'n2',type:'none'}
    ]
  }));
  assert.equal(document.querySelector('h2').textContent,'恭喜，抽中实物好礼');
  const cards=document.querySelectorAll('.ev-result-card');
  assert.equal(cards.length,3);
  assert.equal(cards.filter(card=>card.classList.contains('is-empty')).length,2);
  assert.equal(cards.filter(card=>card.classList.contains('is-physical')).length,1);
  assert.deepEqual(cards.map(card=>card.querySelector('strong').textContent),['YSL气垫','再接再厉','再接再厉']);
  assert.equal(document.querySelectorAll('.reward-coupon').length,1);
  assert.match(document.querySelector('.coupon-value').textContent,/×2/);
  assert.match(document.querySelector('.coupon-content').textContent,/专家线上鉴别券/);
  assert.match(document.querySelector('.ev-result-heading').textContent,/高级奖池\s*·\s*五连抽/);
  assert.match(document.querySelector('[data-result-again]').textContent,/再扭五次/);
});

test('five blanks do not become a five-prize celebration',()=>{
  const document=view(resultMarkup({pool:'ordinary',rewards:Array.from({length:5},(_,index)=>({id:`empty-${index}`,type:'none'}))}));
  assert.equal(document.querySelector('h2').textContent,'再接再厉');
  assert.equal(document.querySelectorAll('[data-comfort]').length,1);
  assert.equal(document.querySelector('[data-comfort]').dataset.emptyCount,'5');
  assert.match(document.querySelector('.gc-batch-note').textContent,/5 枚扭蛋均为再接再厉/);
  assert.doesNotMatch(document.querySelector('.ev-result-heading').textContent,/好礼已抵达/);
});

test('first free ticket explains the activity visually without exposing the forced first result',()=>{
  const document=view(firstGuideMarkup());
  assert.equal(document.querySelector('.ev-onboarding-lead').textContent,'免费专鉴，攒券扭好礼');
  assert(document.querySelector('.ev-onboarding-machine .gm-machine'));
  assert.equal(document.querySelector('.eh-guide-ticket .ev-reward-art').getAttribute('src'),'assets/gacha/reward-ordinary-v6.png');
  assert.match(document.querySelector('.eh-guide-ticket').textContent,/今日赠送\s*×1\s*今日有效/);
  assert.equal(document.querySelector('[data-guide]').textContent.trim(),'免费扭一次');
  assert.equal(document.querySelector('[data-later]').textContent.trim(),'稍后再用');
  assert.equal(document.querySelectorAll('.ev-primary').length,1);
  assert.doesNotMatch(document.root.textContent,/必不中|不中奖|固定未中奖/);
});

test('first-result guidance follows the consumed guide ticket even after its remaining balance becomes zero',()=>{
  const state=claimDaily(orders(2),T).state;
  const consumed=draw(state,{pool:'ordinary',count:1,requestId:'first-guide-binding'},T+20,()=>.4);
  assert.equal(consumed.state.tickets.find(ticket=>ticket.firstGuide).remaining,0);
  assert.equal(isFirstGuideBatch(consumed.batch,consumed.state),true);
  const regular=draw(consumed.state,{pool:'ordinary',count:1,requestId:'earned-ticket'},T+30,()=>.4);
  assert.equal(isFirstGuideBatch(regular.batch,regular.state),false);
  assert.equal(isFirstGuideBatch({ticketDebits:[]},state),false);
  assert.equal(isFirstGuideBatch({ticketDebits:[{ticketId:state.guideTicketId,amount:0}]},state),false);
});

test('an expired unused guide does not transfer onboarding to the next daily ticket',()=>{
  const old=claimDaily(fresh(),T).state;
  const next=claimDaily(old,T+DAY).state;
  const drawn=draw(next,{pool:'ordinary',count:1,requestId:'next-day-guide-expired'},T+DAY+1,()=>.4);
  assert.equal(drawn.batch.rewards[0].type,'voucher');
  assert.equal(isFirstGuideBatch(drawn.batch,drawn.state),false);
  assert.equal(drawn.state.tickets.find(ticket=>ticket.id===old.guideTicketId).remaining,1);
});

test('first no-prize result keeps comfort and presents two illustrated earning milestones with one clear expert CTA',()=>{
  for(const [currentCount,distance] of [[0,'再鉴 2 单，得普通抽奖券'],[9,'再鉴 1 单，得高级抽奖券'],[10,'再鉴 2 单，得普通抽奖券']]) {
    const document=view(resultMarkup({pool:'ordinary',rewards:[{type:'none'}]},{firstGuide:true,currentCount,canReturn:true}));
    assert.equal(document.querySelectorAll('[data-comfort]').length,1);
    assert.match(document.querySelector('[data-comfort-caption]').textContent,/奖品没跟上，抱抱先到/);
    assert.equal(document.querySelector('.ev-guide-earn h3').textContent,'免费专鉴，继续领抽奖券');
    const art=document.querySelectorAll('.ev-guide-rewards .ev-reward-art').map(node=>node.getAttribute('src'));
    assert.deepEqual(art,['assets/gacha/reward-ordinary-v6.png','assets/gacha/reward-advanced-v6.png']);
    assert.match(document.querySelector('.ev-guide-rewards').textContent,/每\s*2\s*单得普通券/);
    assert.match(document.querySelector('.ev-guide-rewards').textContent,/每\s*10\s*单得高级券\s*该节点仅发高级券/);
    assert.equal(document.querySelector('.ev-guide-distance').textContent.replace(/\s+/g,' ').trim(),distance);
    assert.equal(document.querySelectorAll('.ev-primary').length,1);
    assert.equal(document.querySelector('[data-result-expert]').textContent.trim(),'去专鉴赢抽奖券');
    assert.equal(document.querySelector('[data-result-later]').textContent,'稍后再去');
    assert.equal(document.querySelector('[data-result-again]'),null);
    assert.equal(document.querySelector('[data-result-prizes]'),null);
    assert.equal(document.querySelector('[data-result-back]'),null);
  }
});

test('a deferred guide included in a winning five-draw keeps all actual rewards and adds the guide without another draw button',()=>{
  const claimed=claimDaily(orders(8),T).state;
  const response=draw(claimed,{pool:'ordinary',count:5,requestId:'deferred-guide-five'},T+100,()=>.4);
  assert.equal(isFirstGuideBatch(response.batch,response.state),true);
  assert.equal(response.batch.rewards.filter(reward=>reward.type==='none').length,1);
  const document=view(resultMarkup(response.batch,{firstGuide:true,currentCount:8}));
  assert.match(document.querySelector('.coupon-value').textContent,/×4/);
  assert.equal(document.querySelectorAll('.ev-result-card.is-empty').length,1);
  assert.equal(document.querySelectorAll('.ev-guide-earn').length,1);
  assert.equal(document.querySelector('[data-result-prizes]').classList.contains('ev-primary'),false);
  assert.equal(document.querySelector('[data-result-expert]').classList.contains('ev-primary'),true);
  assert.equal(document.querySelector('[data-result-again]'),null);
  assert.equal(document.querySelector('[data-comfort]'),null,'winning batches retain their winning result atmosphere');
});

test('rail geometry uses actual count, including odd counts, and preserves all fifty-order history',()=>{
  for(const [count,end,ratio,next] of [[0,10,0,2],[9,20,.45,10],[14,20,.7,16],[50,60,5/6,52]]) {
    const geometry=progressGeometry(count);
    assert.equal(geometry.end,end);
    assert.equal(geometry.ratio,ratio);
    assert.equal(geometry.next,next);
    assert.equal(geometry.nodeCount,end/2+1);
    const document=view(progressMarkup(orders(count)));
    const rail=document.querySelector('[role="progressbar"]');
    assert.equal(rail.getAttribute('aria-valuenow'),String(count));
    assert.equal(rail.getAttribute('aria-valuemax'),String(end));
    assert.equal(document.querySelector('.ev-current-marker').dataset.currentCount,String(count));
    assert.equal(document.querySelectorAll('[data-step]').length,end/2);
    assert.match(document.querySelector('.ev-progress-heading').textContent,/我的专鉴进度/);
    assert.doesNotMatch(document.querySelector('.ev-progress-heading').textContent,/专鉴有礼/);
  }
  const fifty=view(progressMarkup(orders(50)));
  assert.equal(fifty.querySelector('[data-step="2"]').classList.contains('is-done'),true);
  assert.equal(fifty.querySelector('[data-step="50"]').classList.contains('is-done'),true);
  assert.equal(fifty.querySelector('[data-step="52"]').classList.contains('is-next'),true);
});

test('both progress sizes share fresh ticket artwork and accessible states without redundant status copy',()=>{
  for(const compact of [false,true]) {
    const document=view(progressMarkup(orders(9),{compact}));
    assert.equal(document.querySelector('[data-step="2"] img').getAttribute('src'),'assets/gacha/reward-ordinary-v6.png');
    assert.equal(document.querySelector('[data-step="10"] img').getAttribute('src'),'assets/gacha/reward-advanced-v6.png');
    assert.equal(document.querySelectorAll('.ev-node-state').length,0);
    assert.doesNotMatch(document.querySelector('.ev-progress').textContent,/已获得|下一奖励|待解锁/);
    assert.match(document.querySelector('[data-step="8"]').getAttribute('aria-label'),/已达成/);
    assert.match(document.querySelector('[data-step="10"]').getAttribute('aria-label'),/未达成/);
    assert.match(document.querySelector('[data-step="12"]').getAttribute('aria-label'),/未达成/);
    assert.equal(document.querySelectorAll('[data-step="10"]').length,1);
    assert.equal(document.querySelector('[data-step="10"] small').textContent,'高级券');
  }
});

test('focusProgress centers the actual marker using viewport coordinates rather than a nested offset',t=>{
  const {document}=dialogHarness(t);
  document.body.innerHTML=progressMarkup(orders(50));
  const scroll=document.querySelector('.ev-milestone-scroll');
  const marker=document.querySelector('.ev-current-marker');
  scroll.scrollLeft=120;scroll.clientWidth=300;
  scroll.getBoundingClientRect=()=>({left:30});
  marker.getBoundingClientRect=()=>({left:1800,width:0});
  focusProgress(document);
  assert.equal(scroll.scrollLeft,1755);
  assert.equal(document.querySelector('[data-step="2"]').classList.contains('is-done'),true);
});

test('hub keeps separate balances, full progress, daily expiry and single versus five availability',()=>{
  const state=claimDaily(orders(10),T+1000).state,before=structuredClone(state);
  const ordinary=view(activityHubMarkup(state,T+1000,{pool:'ordinary'}));
  assert.equal(ordinary.querySelector('[data-hub-pool="ordinary"]').getAttribute('aria-selected'),'true');
  assert.match(ordinary.querySelector('[data-hub-pool="ordinary"]').textContent,/可用\s*5\s*张券/);
  assert.match(ordinary.querySelector('[data-hub-pool="advanced"]').textContent,/可用\s*1\s*张券/);
  assert.equal(ordinary.querySelector('[data-hub-draw="5"]').disabled,false);
  assert.match(ordinary.querySelector('[data-hub-draw="1"]').textContent,/免费扭一次/);
  assert.match(ordinary.querySelector('.ev-hub-expiry').textContent,/今日赠券当天有效/);
  assert.equal(ordinary.querySelector('.ev-progress').dataset.current,'10');
  const advanced=view(activityHubMarkup(state,T+1000,{pool:'advanced'}));
  assert.equal(advanced.querySelector('[data-hub-draw="1"]').disabled,false);
  assert.equal(advanced.querySelector('[data-hub-draw="5"]').disabled,true);
  assert.match(advanced.querySelector('[data-hub-draw="1"]').textContent,/高级券/);
  assert.doesNotMatch(advanced.querySelector('[data-hub-draw="1"]').textContent,/免费扭一次/);
  assert.deepEqual(state,before);
});

test('hub disables both draw buttons outside the activity without removing saved progress',()=>{
  const state=orders(50);
  for(const [now,text]of [[START-1,'活动尚未开始'],[END,'活动已结束']]) {
    const document=view(activityHubMarkup(state,now,{pool:'advanced'}));
    assert.equal(document.querySelector('[data-hub-draw="1"]').disabled,true);
    assert.equal(document.querySelector('[data-hub-draw="5"]').disabled,true);
    assert.match(document.querySelector('.ev-hub-expiry').textContent,new RegExp(text));
    assert.equal(document.querySelector('.ev-progress').dataset.current,'50');
    assert.equal(document.querySelector('.ev-hub-earn'),null);
  }
});

test('empty ticket wallets replace disabled draw controls with one primary expert action and the actual next reward',()=>{
  for(const [count,gap,pool]of [[0,2,'普通'],[1,1,'普通'],[9,1,'高级'],[10,2,'普通'],[19,1,'高级']]) {
    const state=orders(count);
    state.tickets.forEach(ticket=>ticket.remaining=0);
    for(const selected of ['ordinary','advanced']) {
      const document=view(activityHubMarkup(state,T+1000,{pool:selected}));
      const cta=document.querySelector('[data-hub-expert]');
      assert.equal(cta.classList.contains('ev-primary'),true);
      assert.match(cta.textContent,/去专鉴赢抽奖券/);
      assert.equal(document.querySelectorAll('[data-hub-expert]').length,1);
      assert.equal(document.querySelectorAll('[data-hub-draw]').length,0);
      assert.match(document.querySelector('.ev-hub-earn-benefit').textContent,new RegExp(`再鉴\\s*${gap}\\s*单，得 1 张${pool}抽奖券`));
      assert.equal(document.querySelector('.ev-progress').dataset.current,String(count));
      assert(document.querySelector('[data-hub-prizes]'));
    }
  }
});

test('tickets remaining in either pool retain draw controls even when the selected pool is empty',()=>{
  for(const remainingPool of ['ordinary','advanced']) {
    const state=orders(10);
    state.tickets.forEach(ticket=>{if(ticket.pool!==remainingPool)ticket.remaining=0;});
    const document=view(activityHubMarkup(state,T+1000,{pool:remainingPool==='ordinary'?'advanced':'ordinary'}));
    assert.equal(document.querySelector('.ev-hub-earn'),null);
    assert.equal(document.querySelectorAll('[data-hub-draw]').length,2);
    assert.equal(document.querySelector('[data-hub-draw="1"]').disabled,true);
  }
});

test('expired daily tickets do not hide the empty-wallet action',()=>{
  const state=claimDaily(fresh(),T).state;
  const document=view(activityHubMarkup(state,T+24*3600000));
  assert(document.querySelector('.ev-hub-earn'));
  assert.equal(document.querySelectorAll('[data-hub-draw]').length,0);
});

test('draw controls explain disabled states by selected-pool shortage, separately from activity availability',()=>{
  for(const pool of ['ordinary','advanced'])for(const amount of [0,1,4,5]) {
    const state=orders(50);
    state.tickets=state.tickets.filter(ticket=>ticket.pool!==pool);
    state.tickets.push({id:'available',pool,remaining:amount,amount,at:T,expiresAt:END});
    const document=view(activityHubMarkup(state,T+1000,{pool}));
    for(const count of [1,5]) {
      const button=document.querySelector(`[data-hub-draw="${count}"]`);
      assert.equal(button.disabled,amount<count);
      assert.equal(button.querySelector('small').textContent,amount<count?`还差 ${count-amount} 张${pool==='advanced'?'高级':'普通'}券`:`使用 ${count} 张${count===5?'同种':pool==='advanced'?'高级':'普通'}券`);
    }
  }
  for(const [now,label]of [[START-1,'活动尚未开始'],[END,'活动已结束']]) {
    const document=view(activityHubMarkup(orders(50),now));
    for(const button of document.querySelectorAll('[data-hub-draw]')) {
      assert.equal(button.disabled,true);
      assert.equal(button.querySelector('small').textContent,label);
    }
  }
});

test('empty-wallet primary action opens the category picker once and closes the hub without changing rewards',t=>{
  const state=orders(1),{dialog,window,navigations}=dialogHarness(t,state);
  let selections=0;window.openExpertSelection=()=>selections++;
  openActivityHub();
  dialog().querySelector('[data-hub-expert]').click();
  assert.equal(selections,1);
  assert.equal(dialog(),null);
  assert.equal(navigations.length,0);
  assert.deepEqual(loadEvent(),state);
});

test('empty-wallet primary action also routes from a standalone activity surface',t=>{
  const {dialog,navigations}=dialogHarness(t,orders(1));
  openActivityHub();
  dialog().querySelector('[data-hub-expert]').click();
  assert.deepEqual(navigations,[['expert',{intent:'open-expert'}]]);
  assert.equal(dialog(),null);
});

test('consuming the last ticket changes the reopened hub to the primary expert action',t=>{
  const state=orders(2),{dialog}=dialogHarness(t,state);
  openActivityHub();
  dialog().querySelector('[data-hub-draw="1"]').click();
  dialog().querySelector('[data-skip]').click();
  dialog().querySelector('[data-result-back]').click();
  assert(dialog().querySelector('.ev-hub-earn'));
  assert.equal(dialog().querySelectorAll('[data-hub-draw]').length,0);
  assert.equal(loadEvent().draws.length,1);
});

test('explicit ranking scenarios remain intact without the generic leaderboard fixture',()=>{
  const state={...orders(2),demoRanking:true,users:[{uid:'current-user',username:'陈**7'}]};
  assert.equal(rankingState(state),state);
  assert.equal(rankingState(state).orders.length,2);
  assert.deepEqual(rankingState(state).users,[{uid:'current-user',username:'陈**7'}]);
});

test('opening and switching hub pools preserves the scenario state and current progress',t=>{
  const state=orders(50),{dialog}=dialogHarness(t,state);
  openActivityHub();
  dialog().querySelector('[data-hub-pool="advanced"]').click();
  assert.equal(dialog().querySelector('[data-hub-pool="advanced"]').getAttribute('aria-selected'),'true');
  assert.equal(dialog().querySelector('.ev-progress').dataset.current,'50');
  assert.deepEqual(loadEvent(),state);
  dialog().querySelector('[data-hub-rules]').click();
  assert.equal(dialog().getAttribute('aria-label'),'专鉴有礼 · 活动规则');
  dialog().querySelector('[data-ev-close]').click();
  assert.equal(dialog().querySelector('[data-hub-pool="advanced"]').getAttribute('aria-selected'),'true');
  assert.deepEqual(loadEvent(),state);
});

test('switching leaderboard tabs updates reward and personal final-result count without changing session data',t=>{
  const state=orders(14);
  state.demoRanking=true;
  state.users=[{uid:state.uid,username:'自己的名字'}];
  state.orders=state.orders.map((order,index)=>({...order,result:index<5?'true':'false',resultAt:T+100+index}));
  const {dialog}=dialogHarness(t,state);
  openLeaderboard();
  assert.equal(dialog().querySelector('[data-kind="true"]').getAttribute('aria-selected'),'true');
  assert.match(dialog().querySelector('.ev-rank-reward').textContent,/200/);
  assert.match(dialog().querySelector('.ev-my-rank').textContent,/5\s*单鉴真/);
  dialog().querySelector('[data-kind="false"]').click();
  assert.equal(dialog().querySelector('[data-kind="false"]').getAttribute('aria-selected'),'true');
  assert.equal(dialog().querySelector('[data-kind="true"]').getAttribute('aria-selected'),'false');
  assert.match(dialog().querySelector('.ev-rank-reward').textContent,/终身免费专鉴/);
  assert.match(dialog().querySelector('.ev-my-rank').textContent,/9\s*单鉴假/);
  dialog().querySelector('[data-kind="true"]').click();
  assert.match(dialog().querySelector('.ev-my-rank').textContent,/5\s*单鉴真/);
  assert.deepEqual(loadEvent(),state);
});

test('leaderboard keyboard tab navigation updates the selection and keeps focus on the selected tab',t=>{
  const {dialog,document}=dialogHarness(t);
  openLeaderboard();
  for(const [key,expected] of [['ArrowRight','false'],['Home','true'],['End','false'],['ArrowLeft','true']]) {
    const selected=dialog().querySelector('[aria-selected="true"]');
    const event={type:'keydown',key};
    selected.dispatchEvent(event);
    const next=dialog().querySelector(`[data-kind="${expected}"]`);
    assert.equal(event.defaultPrevented,true);
    assert.equal(next.getAttribute('aria-selected'),'true');
    assert.equal(document.activeElement,next);
  }
});

test('hub ranking rules return to the same ranking tab and closing it restores the original selected pool',t=>{
  const state=orders(20),{dialog}=dialogHarness(t,state);
  openActivityHub({pool:'advanced'});
  dialog().querySelector('[data-hub-rank]').click();
  assert(dialog().classList.contains('ev-ranking-dialog'));
  dialog().querySelector('[data-kind="false"]').click();
  dialog().querySelector('[data-rules]').click();
  assert.equal(dialog().getAttribute('aria-label'),'专鉴有礼 · 活动规则');
  dialog().querySelector('[data-ev-close]').click();
  assert(dialog().classList.contains('ev-ranking-dialog'));
  assert.equal(dialog().querySelector('[data-kind="false"]').getAttribute('aria-selected'),'true');
  assert.match(dialog().querySelector('.ev-rank-reward').textContent,/终身免费专鉴/);
  dialog().querySelector('[data-ev-close]').click();
  assert(dialog().classList.contains('ev-hub-dialog'));
  assert.equal(dialog().querySelector('[data-hub-pool="advanced"]').getAttribute('aria-selected'),'true');
  assert.deepEqual(loadEvent(),state);
});

test('going to expert identification from a hub leaderboard navigates once and does not reopen the hub',t=>{
  const state=orders(20),{dialog,navigations}=dialogHarness(t,state);
  openActivityHub({pool:'advanced'});
  dialog().querySelector('[data-hub-rank]').click();
  dialog().querySelector('[data-kind="false"]').click();
  dialog().querySelector('[data-rank-expert]').click();
  assert.deepEqual(navigations,[['expert',{intent:'open-expert'}]]);
  assert.equal(dialog(),null);
  assert.deepEqual(loadEvent(),state);
});

test('an explicitly supplied draw generator produces one saved result and skipping never debits twice',t=>{
  const {dialog}=dialogHarness(t,orders(10));
  let changes=0,returns=0,randomCalls=0;
  const batch=openDraw({pool:'advanced',count:1,onChange:()=>changes++,onReturn:()=>returns++,random:()=>{randomCalls++;return .4;}});
  assert.equal(batch.rewards[0].type,'voucher');
  assert.equal(changes,1);
  assert.equal(randomCalls,1);
  assert.equal(loadEvent().draws.length,1);
  const skip=dialog().querySelector('[data-skip]');
  skip.click();skip.click();
  assert.equal(dialog().querySelectorAll('.reward-coupon').length,1);
  assert.equal(loadEvent().draws.length,1);
  assert.equal(loadEvent().tickets.filter(ticket=>ticket.pool==='advanced').reduce((sum,ticket)=>sum+ticket.remaining,0),0);
  dialog().querySelector('[data-result-back]').click();
  assert.equal(returns,1);
  assert.equal(dialog(),null);
});

test('a deferred first guide drawn through the hub opens one result and routes directly to expert selection',t=>{
  const state=claimDaily(orders(9),T).state;
  state.guideShownTicketId=state.guideTicketId;
  const {dialog,window,navigations}=dialogHarness(t,state);
  let selections=0,changes=0;
  window.openExpertSelection=()=>{assert.equal(dialog(),null);selections++;};
  openActivityHub({onChange:()=>changes++});
  dialog().querySelector('[data-hub-draw="1"]').click();
  const skip=dialog().querySelector('[data-skip]');
  skip.click();skip.click();
  const saved=loadEvent();
  assert.equal(changes,1);
  assert.equal(saved.draws.length,1);
  assert.equal(saved.draws[0].rewards[0].type,'none');
  assert.equal(saved.tickets.find(ticket=>ticket.firstGuide).remaining,0);
  assert.equal(dialog().classList.contains('ev-onboarding-result'),true);
  assert.match(dialog().querySelector('.ev-guide-distance').textContent,/再鉴\s*1\s*单，得高级抽奖券/);
  assert.equal(dialog().querySelector('[data-result-again]'),null);
  dialog().querySelector('[data-comfort-hug]').click();
  assert.deepEqual(loadEvent(),saved);
  dialog().querySelector('[data-result-expert]').click();
  assert.equal(selections,1);
  assert.deepEqual(navigations,[]);
  assert.equal(dialog(),null,'expert entry must not reopen its originating hub');
  assert.deepEqual(loadEvent(),saved);
});

test('post-guide later action closes cleanly, restores the originating hub once, and never debits again',t=>{
  const state=claimDaily(fresh(),T).state;
  const {dialog}=dialogHarness(t,state);
  let changes=0;
  openActivityHub({onChange:()=>changes++});
  dialog().querySelector('[data-hub-draw="1"]').click();
  dialog().querySelector('[data-skip]').click();
  const saved=loadEvent(),later=dialog().querySelector('[data-result-later]');
  later.click();later.click();
  assert.equal(changes,1);
  assert.equal(dialog().classList.contains('ev-hub-dialog'),true);
  assert.equal(dialog().querySelector('[data-hub-expert]').textContent.trim(),'去专鉴赢抽奖券');
  assert.deepEqual(loadEvent(),saved);
});

test('closing a guide draw before reveal keeps the saved result and does not open another popup',t=>{
  const {dialog}=dialogHarness(t,claimDaily(fresh(),T).state);
  t.mock.timers.enable({apis:['setTimeout']});
  openDraw();
  const saved=loadEvent();
  dialog().querySelector('[data-ev-close]').click();
  t.mock.timers.tick(10000);
  assert.equal(dialog(),null);
  assert.equal(saved.draws.length,1);
  assert.deepEqual(loadEvent(),saved);
});

test('after an unused guide expires, the new daily draw gets the regular result controls',t=>{
  const state=claimDaily(claimDaily(fresh(),T).state,T+DAY).state;
  const {dialog}=dialogHarness(t,state);
  setEventClock(T+DAY+1000);
  openDraw({random:()=>.4});
  dialog().querySelector('[data-skip]').click();
  assert.equal(dialog().querySelector('.ev-guide-earn'),null);
  assert.equal(dialog().querySelector('[data-result-later]'),null);
  assert(dialog().querySelector('[data-result-again]'));
  assert.equal(dialog().querySelector('[data-result-prizes]').classList.contains('ev-primary'),true);
});

test('dismissed hub draw returns to its selected pool without drawing again',t=>{
  const {dialog}=dialogHarness(t,orders(20));
  openActivityHub({pool:'advanced'});
  dialog().querySelector('[data-hub-draw="1"]').click();
  assert.match(dialog().getAttribute('aria-label'),/高级扭蛋/);
  assert.equal(loadEvent().draws.length,1);
  dialog().querySelector('[data-skip]').click();
  dialog().querySelector('[data-result-back]').click();
  assert.equal(dialog().querySelector('[data-hub-pool="advanced"]').getAttribute('aria-selected'),'true');
  assert.equal(dialog().querySelector('.ev-progress').dataset.current,'20');
  assert.equal(loadEvent().draws.length,1);
});

test('programmatic replacement does not reopen a hub and navigation leaves the modal closed',t=>{
  const {dialog,navigations}=dialogHarness(t,orders(20));
  let returns=0;
  openDraw({pool:'advanced',onReturn:()=>returns++,random:()=>.4});
  openRules();
  assert.equal(returns,0);
  assert.equal(dialog().getAttribute('aria-label'),'专鉴有礼 · 活动规则');
  openActivityHub({pool:'advanced'});
  dialog().querySelector('[data-hub-prizes]').click();
  assert.equal(dialog(),null);
  assert.deepEqual(navigations,[['prizes',{event:'expert',pool:'advanced'}]]);
  assert.equal(returns,0);
});

for(const [count,reward,title]of [
  [1,null,'提交成功'],
  [2,{pool:'ordinary',amount:1},'普通抽奖券 +1'],
  [10,{pool:'advanced',amount:1},'高级抽奖券 +1']
])test(`submission progress at ${count} orders shows its actual count and opens expert selection once without awarding again`,t=>{
  const state=orders(count),{dialog,window,navigations}=dialogHarness(t,state);
  let selections=0;
  window.openExpertSelection=()=>{
    assert.equal(dialog(),null,'the progress dialog closes before opening the native category picker');
    selections++;
  };
  const progress=openProgress({reward});
  assert.equal(progress.querySelector('h2').textContent,title);
  assert.equal(progress.querySelector('.ev-progress').dataset.current,String(count));
  assert.equal(progress.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),String(count));
  assert.match(progress.querySelector('.ev-progress-heading').textContent,new RegExp(`已完成\\s*${count}\\s*单`));
  const action=progress.querySelector('[data-progress-expert]');
  assert.equal(action.textContent.trim(),'去专鉴赢抽奖券');
  assert.equal(action.classList.contains('ev-primary'),true);
  assert.equal(progress.querySelectorAll('.ev-primary').length,1);
  assert.equal(progress.querySelector('[data-center]').classList.contains('ev-text-button'),true);
  assert.deepEqual(loadEvent(),state,'showing the progress must not grant another ticket');
  action.click();
  assert.equal(selections,1);
  assert.equal(progress.open,false);
  assert.equal(progress.returnValue,'navigate');
  assert.equal(dialog(),null);
  assert.deepEqual(navigations,[],'native expert selection takes priority over route navigation');
  assert.deepEqual(loadEvent(),state,'continuing identification must not grant or consume a ticket');
});

test('progress expert action falls back to the expert route on standalone surfaces for every reward state',t=>{
  const {dialog,navigations}=dialogHarness(t);
  for(const [count,reward]of [[1,null],[2,{pool:'ordinary',amount:1}],[10,{pool:'advanced',amount:1}]]) {
    const state=orders(count);saveEvent(state);
    const progress=openProgress({reward});
    progress.querySelector('[data-progress-expert]').click();
    assert.equal(progress.open,false);
    assert.equal(progress.returnValue,'navigate');
    assert.equal(dialog(),null);
    assert.deepEqual(loadEvent(),state);
  }
  assert.deepEqual(navigations,Array.from({length:3},()=>['expert',{intent:'open-expert'}]));
});

test('progress center entry always restores expert activity with the earned pool or ordinary fallback',t=>{
  const {dialog,navigations}=dialogHarness(t,orders(20));
  for(const reward of [null,{pool:'ordinary'},{pool:'advanced'}]) {
    openProgress({reward});
    dialog().querySelector('[data-center]').click();
    assert.equal(dialog(),null);
  }
  assert.deepEqual(navigations,[
    ['lottery',{event:'expert',pool:'ordinary'}],
    ['lottery',{event:'expert',pool:'ordinary'}],
    ['lottery',{event:'expert',pool:'advanced'}]
  ]);
});

test('draw result prize entry explicitly selects the expert activity and the drawn pool',t=>{
  const {dialog,navigations}=dialogHarness(t,orders(20));
  for(const pool of ['ordinary','advanced']) {
    openDraw({pool,random:()=>.4});
    dialog().querySelector('[data-skip]').click();
    dialog().querySelector('[data-result-prizes]').click();
    assert.equal(dialog(),null);
  }
  assert.deepEqual(navigations,[
    ['prizes',{event:'expert',pool:'ordinary'}],
    ['prizes',{event:'expert',pool:'advanced'}]
  ]);
});

test('the single hub prize entry carries the currently selected pool instead of stale card context',t=>{
  const {dialog,navigations}=dialogHarness(t,orders(20));
  for(const [button,route] of [['data-hub-prizes','prizes']]) {
    for(const pool of ['advanced','ordinary']) {
      openActivityHub({pool:pool==='advanced'?'ordinary':'advanced'});
      dialog().querySelector(`[data-hub-pool="${pool}"]`).click();
      dialog().querySelector(`[${button}]`).click();
      assert.equal(dialog(),null);
      assert.deepEqual(navigations.at(-1),[route,{event:'expert',pool}]);
    }
  }
  assert.equal(navigations.length,2);
});

test('submitted rewards select distinct celebration tiers and close removes the decoration',t=>{
  const {dialog,document}=dialogHarness(t,orders(20));
  t.mock.timers.enable({apis:['setTimeout']});
  globalThis.matchMedia=()=>({matches:false});
  for(const pool of ['ordinary','advanced']) {
    openProgress({reward:{pool}});
    assert.equal(dialog().querySelector('.gacha-celebration').dataset.tier,pool);
    assert.equal(dialog().querySelectorAll('.ev-reward-emblem img').length,1);
    assert.equal(dialog().querySelectorAll('.ev-reward-count').length,0);
    dialog().querySelector('[data-ev-close]').click();
    assert.equal(document.querySelector('.gacha-celebration'),null);
  }
  openProgress();
  assert.equal(dialog().querySelector('.gacha-celebration'),null);
  assert.equal(dialog().querySelector('.ev-reward-emblem'),null);
  assert.equal(dialog().querySelector('h2').textContent,'提交成功');
});

test('results use the strongest actual prize tier and make the appropriate next action primary',()=>{
  for(const [type,title] of [['none','再接再厉'],['voucher','获得专家线上鉴别券'],['physical','恭喜，抽中实物好礼']]) {
    const document=view(resultMarkup({pool:'ordinary',rewards:[{type,prizeId:'ysl-cushion',expiresAt:VOUCHER_END}]}));
    assert.equal(document.querySelector('.ev-result').dataset.resultTier,type);
    assert.equal(document.querySelector('h2').textContent,title);
    assert.equal(document.querySelectorAll('.ev-primary').length,1);
    assert.equal(document.querySelector(type==='none'?'[data-result-expert]':'[data-result-prizes]').classList.contains('ev-primary'),true);
    assert.equal(document.querySelector('.ev-result-rule'),null);
    assert.equal(document.querySelectorAll('.ev-result-saved').length,type==='none'?0:1);
  }
  const hub=view(activityHubMarkup(orders(14),T));
  assert.equal(hub.querySelectorAll('[data-hub-prizes]').length,1);
  assert.equal(hub.querySelector('[data-hub-center]'),null);
  assert.equal(hub.querySelector('.ev-hub-intro'),null);
});

for (const count of [1,5]) test(`all-miss ${count}-draw comfort interaction neither redraws nor spends more tickets`,t=>{
  const {dialog}=dialogHarness(t,orders(20));
  let changes=0;
  openDraw({count,random:()=>.99,onChange:()=>changes++});
  const saved=loadEvent();
  dialog().querySelector('[data-skip]').click();
  const hug=dialog().querySelector('[data-comfort-hug]');
  hug.click();hug.click();
  assert.match(dialog().querySelector('[data-comfort-caption]').textContent,/抱抱已送达/);
  assert.deepEqual(loadEvent(),saved);
  assert.equal(changes,1);
  assert.equal(saved.draws[0].rewards.length,count);
  dialog().close('dismiss');
  assert.equal(hug.events.get('click').length,0);
  assert.deepEqual(loadEvent(),saved);
});

test('historical no-prize dialog mounts the same comforting interaction without mutating records',t=>{
  const state=orders(20),{dialog}=dialogHarness(t,state);
  showEventDialog('扭蛋结果',resultMarkup({pool:'ordinary',rewards:[{type:'none'}]}));
  dialog().querySelector('[data-comfort-hug]').click();
  assert.match(dialog().querySelector('[data-comfort-caption]').textContent,/抱抱已送达/);
  assert.deepEqual(loadEvent(),state);
});

test('activity rules list the seven eligible catalog categories',t=>{
  const {dialog}=dialogHarness(t);openRules();
  const copy=dialog().querySelector('.ev-rules').textContent;
  assert.match(copy,/美妆、包袋、鞋靴、服饰、手表、数码家电、3C无损/);
  assert.doesNotMatch(copy,/六大品类|数码 3C|美妆无损/);
});
