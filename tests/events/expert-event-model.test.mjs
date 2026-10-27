import test from 'node:test';
import assert from 'node:assert/strict';
import {
  START,END,VOUCHER_END,DAY,PRIZES,active,isEligibleCategory,fresh,balances,claimDaily,submitOrder,
  completeOrder,draw,ticketInventory,leaderboard
} from '../../public/events/expert-event-model.js';
import {
  EVENT_KEY,DEFAULT_TIME,loadEvent,saveEvent,eventNow,setEventClock,resetEvent
} from '../../public/events/expert-event-session.js';

const T=START+10*3600000;
const fill=(state,count,now=T) => {
  const initial=state.orders.filter(order => order.uid===state.uid).length;
  for(let i=1;i<=count;i++)state=submitOrder(state,{id:`order-${initial+i}`,category:'美妆',product:'测试商品'},now).state;
  return state;
};
const stocked=(pool,count=1) => fill(fresh(),pool==='advanced'?10*count:count===5?12:2);
const run=(state,pool,count=1,random=()=>.5,requestId='request-1',now=T) => draw(state,{pool,count,requestId},now,random);
const storage=() => {
  const values=new Map();
  return {getItem:key => values.get(key)||null,setItem:(key,value) => values.set(key,value),values};
};

test('expert activity and voucher deadlines use exclusive Shanghai midnight boundaries',() => {
  assert.equal(START,Date.parse('2026-10-27T00:00:00+08:00'));
  assert.equal(END,Date.parse('2026-11-11T00:00:00+08:00'));
  assert.equal(VOUCHER_END,Date.parse('2026-12-13T00:00:00+08:00'));
  assert(!active(START-1));assert(active(START));assert(active(END-1));assert(!active(END));
  assert.equal(claimDaily(fresh(),START-1).awarded,false);
  const late=submitOrder(fresh(),{id:'late',category:'美妆'},END);
  assert.equal(late.order.eligible,false);assert.equal(late.reward,null);
});

test('daily free ticket grants once per Shanghai date and expires at that day end',() => {
  const first=claimDaily(fresh(),T);
  assert.equal(first.awarded,true);assert.equal(first.ticket.expiresAt,START+DAY);
  assert.equal(first.ticket.firstGuide,true);
  assert.deepEqual(balances(first.state,T),{ordinary:1,advanced:0,daily:1});
  assert.equal(claimDaily(first.state,T+1).awarded,false);
  assert.deepEqual(balances(first.state,START+DAY),{ordinary:0,advanced:0,daily:0});
  const second=claimDaily(first.state,START+DAY);
  assert.equal(second.ticket.firstGuide,false);
  assert.equal(second.state.dailyClaims.length,2);
  assert.equal(claimDaily(fresh(),END-1).ticket.expiresAt,END);
  assert.equal(claimDaily(first.state,END).awarded,false);
});

test('first guide loss stays attached to first daily grant and never an advanced ticket',() => {
  let state=claimDaily(stocked('advanced'),T).state;
  const advanced=run(state,'advanced',1,()=>0);
  assert.equal(advanced.batch.rewards[0].type,'physical');
  const guide=run(advanced.state,'ordinary',1,()=>{throw Error('guide must not roll');},'guide');
  assert.equal(guide.batch.rewards[0].type,'none');
  assert.equal(guide.batch.ticketDebits[0].ticketId,state.guideTicketId);
  const expired=claimDaily(claimDaily(fresh(),T).state,T+DAY);
  assert.equal(run(expired.state,'ordinary',1,()=>0,'next-day',T+DAY).batch.rewards[0].type,'physical');
});

test('eligible expert orders count on submission, without a daily cap or result prerequisite',() => {
  let state=fill(fresh(),14);
  assert.equal(state.orders.length,14);
  assert.deepEqual(balances(state,T),{ordinary:6,advanced:1,daily:0});
  assert(state.orders.every(order => order.result===null));
  state=fill(state,16,T+DAY);
  assert.deepEqual(balances(state,T+DAY),{ordinary:12,advanced:3,daily:0});
  assert.equal(state.orders.at(-1).ordinal,30);
  assert(state.tickets.every(ticket => ticket.expiresAt===END));
});

test('seven activity categories use exact catalog names and IDs; other free categories are excluded',() => {
  for(const category of [
    '美妆','beauty','包袋','bags','鞋靴','footwear',
    '服饰','潮服','apparel','手表','腕表','watches','数码3C','数码家电','3C无损',
    'electronics-appliances','electronics-nondestructive','数码','3C',{id:'beauty',name:'美妆'}
  ])assert.equal(isEligibleCategory(category),true,JSON.stringify(category));
  for(const category of [
    '卡牌','trading-cards','配饰','accessories','JK制服','jk-uniforms','服饰签名',
    '美妆无损','beauty-nondestructive','美妆周边','手表配饰','数码玩具','',null,undefined,{id:'trading-cards',name:'美妆'}
  ])assert.equal(isEligibleCategory(category),false,JSON.stringify(category));
});

test('each of the seven activity categories counts submissions and awards ordinary and advanced milestones',() => {
  for(const category of ['美妆','包袋','鞋靴','服饰','手表','数码家电','3C无损']) {
    let state=fresh();
    for(let ordinal=1;ordinal<=10;ordinal++) {
      const submitted=submitOrder(state,{id:`${category}-${ordinal}`,category},T+ordinal);
      assert.equal(submitted.excluded,false,category);
      assert.equal(submitted.order.ordinal,ordinal,category);
      assert.deepEqual(submitted.reward,ordinal%2===0?{pool:ordinal===10?'advanced':'ordinary',amount:1}:null,category);
      state=completeOrder(submitted.state,submitted.order.id,'true',T+20+ordinal).state;
    }
    assert.deepEqual(balances(state,T+100),{ordinary:4,advanced:1,daily:0},category);
    assert.equal(leaderboard(state,'true')[0].count,10,category);
  }
});

test('beauty nondestructive orders remain separate from beauty activity progress and rankings',() => {
  for(const category of ['美妆无损','beauty-nondestructive',{id:'beauty-nondestructive',name:'美妆无损'}]) {
    let state=fresh();
    for(let i=1;i<=10;i++) {
      const submitted=submitOrder(state,{id:`excluded-${i}`,category},T+i);
      assert.equal(submitted.excluded,true);
      assert.equal(submitted.order.ordinal,null);
      assert.equal(submitted.reward,null);
      const complete=completeOrder(submitted.state,submitted.order.id,'true',T+20+i);
      assert.equal(complete.counted,false);
      state=complete.state;
    }
    assert.deepEqual(balances(state,T+100),{ordinary:0,advanced:0,daily:0});
    assert.deepEqual(leaderboard(state,'true'),[]);
  }
});

test('excluded categories and orders outside event remain free orders without milestones or leaderboard counts',() => {
  let state=fresh();
  for(const [id,category,now] of [
    ['card','卡牌',T],['other','配饰',T],['before','美妆',START-1],['after','美妆',END]
  ]) {
    const submitted=submitOrder(state,{id,category},now);
    assert.equal(submitted.excluded,true);assert.equal(submitted.order.eligible,false);
    assert.equal(submitted.order.ordinal,null);assert.equal(submitted.reward,null);
    const complete=completeOrder(submitted.state,id,'true',Math.max(T,now));
    assert.equal(complete.counted,false);state=complete.state;
  }
  assert.equal(state.orders.length,4);
  assert.equal(state.tickets.length,0);assert.deepEqual(leaderboard(state,'true'),[]);
  const first=submitOrder(state,{id:'eligible-1',category:'包袋'},T);
  assert.equal(first.order.ordinal,1);assert.equal(first.reward,null);
  const second=submitOrder(first.state,{id:'eligible-2',category:'数码3C'},T);
  assert.equal(second.order.ordinal,2);assert.deepEqual(second.reward,{pool:'ordinary',amount:1});
});

test('10th and 20th orders replace ordinary milestone with one advanced ticket',() => {
  let state=fill(fresh(),9);
  const tenth=submitOrder(state,{id:'ten',category:'美妆'},T);
  assert.deepEqual(tenth.reward,{pool:'advanced',amount:1});
  assert.deepEqual(balances(tenth.state,T),{ordinary:4,advanced:1,daily:0});
  const replay=submitOrder(tenth.state,{id:'ten'},T+DAY);
  assert(replay.duplicate);assert.equal(replay.reward,null);assert.equal(replay.state.orders.length,10);
  assert.equal(submitOrder(fresh(),{id:''},T).error,'订单编号不能为空');
});

test('pool selection, count validation and insufficient funds never debit any ticket',() => {
  const state=stocked('ordinary');
  for(const args of [
    {pool:'advanced',count:1,requestId:'a'},
    {pool:'ordinary',count:5,requestId:'b'},
    {pool:'ordinary',count:2,requestId:'c'},
    {pool:'mixed',count:1,requestId:'d'},
    {pool:'ordinary',count:1}
  ]) {
    const result=draw(state,args,T);
    assert(result.error);assert.deepEqual(result.state,state);
  }
  assert(run(state,'ordinary',1,()=>.5,'ended',END).error);
  assert.deepEqual(state,stocked('ordinary'));
});

test('five draws consume earliest-expiring daily ticket before milestone tickets',() => {
  const state=claimDaily(stocked('ordinary',5),T+1).state;
  const result=run(state,'ordinary',5,()=>.5,'five',T+1);
  assert.equal(result.batch.rewards.length,5);
  assert.equal(result.batch.rewards.filter(reward => reward.type==='none').length,1);
  assert.equal(result.batch.ticketDebits[0].ticketId,state.guideTicketId);
  assert.deepEqual(balances(result.state,T+1),{ordinary:1,advanced:1,daily:0});
  assert.equal(result.state.vouchers.length,4);
});

test('draw request replay recovers result without charging again, even after event end',() => {
  const first=run(stocked('ordinary',5),'ordinary',1,()=>.5,'same');
  const again=run(first.state,'ordinary',1,()=>{throw Error('must not roll');},'same',END);
  assert(again.duplicate);assert.deepEqual(again.batch,first.batch);assert.deepEqual(again.state,first.state);
  assert(run(first.state,'ordinary',5,()=>.5,'same').error);
  assert(run(first.state,'advanced',1,()=>.5,'same').error);
});

test('random failure rolls back all five ticket debits and partial rewards',() => {
  const state=stocked('ordinary',5);
  let calls=0;
  const result=run(state,'ordinary',5,()=>++calls===3?NaN:.5);
  assert(result.error);assert.deepEqual(result.state,state);assert.equal(result.batch,null);
});

test('ordinary and advanced pool probability boundaries match 8/72/20 and 5/75/20',() => {
  for(const [pool,rate] of [['ordinary',.08],['advanced',.05]]) {
    const state=stocked(pool);
    assert.equal(run(state,pool,1,()=>rate-.000001).batch.rewards[0].type,'physical');
    assert.equal(run(state,pool,1,()=>rate).batch.rewards[0].type,'voucher');
    assert.equal(run(state,pool,1,()=>.799999).batch.rewards[0].type,'voucher');
    assert.equal(run(state,pool,1,()=>.8).batch.rewards[0].type,'none');
    assert.equal(run(state,pool,1,()=>.999999).batch.rewards[0].type,'none');
  }
});

test('each available physical prize has equal selection weight within its pool',() => {
  for(const pool of ['ordinary','advanced']) {
    const prizes=PRIZES.filter(prize => prize.pool===pool);
    prizes.forEach((prize,index) => {
      const sequence=[0,(index+.5)/prizes.length];
      const result=run(stocked(pool),pool,1,()=>sequence.shift());
      assert.equal(result.batch.rewards[0].prizeId,prize.id);
    });
  }
});

test('advanced stock decrements once and exhausted prize is not selected',() => {
  const state=stocked('advanced');
  state.stocks['ysl-cushion']=0;
  const result=run(state,'advanced',1,()=>0);
  assert.equal(result.batch.rewards[0].prizeId,'coach-belt');
  assert.equal(result.state.stocks['coach-belt'],0);
  assert.equal(state.stocks['coach-belt'],1);
  assert.equal(result.state.physicalWon,true);
});

test('one physical limit covers both new event pools and converts full physical share to voucher',() => {
  let state=fill(fresh(),50);
  const first=run(state,'advanced',5,()=>0);
  assert.equal(first.batch.rewards.filter(reward => reward.type==='physical').length,1);
  assert.equal(first.batch.rewards.filter(reward => reward.type==='voucher').length,4);
  const second=run(first.state,'ordinary',5,()=>0,'ordinary-next');
  assert(second.batch.rewards.every(reward => reward.type==='voucher'));
  assert.equal(run(first.state,'ordinary',1,()=>.8,'none').batch.rewards[0].type,'none');
  assert.equal(run(stocked('ordinary'),'ordinary',1,()=>0).batch.rewards[0].type,'physical');
});

test('pool sold out transfers its entire physical chance to voucher but leaves 20% no prize',() => {
  for(const pool of ['ordinary','advanced']) {
    const state=stocked(pool);
    PRIZES.filter(prize => prize.pool===pool).forEach(prize => {state.stocks[prize.id]=0;});
    assert.equal(run(state,pool,1,()=>0).batch.rewards[0].type,'voucher');
    assert.equal(run(state,pool,1,()=>.799999).batch.rewards[0].type,'voucher');
    assert.equal(run(state,pool,1,()=>.8).batch.rewards[0].type,'none');
    assert.equal(state.physicalWon,false);
  }
});

test('all voucher wins expire after December 12 and blank results create no voucher',() => {
  const won=run(stocked('ordinary'),'ordinary',1,()=>.5,'voucher',END-1);
  assert.equal(won.state.vouchers[0].expiresAt,VOUCHER_END);
  assert.equal(won.batch.rewards[0].expiresAt,VOUCHER_END);
  const none=run(stocked('ordinary'),'ordinary',1,()=>.9);
  assert.equal(none.state.vouchers.length,0);
  assert.equal(none.batch.rewards.length,1);
});

test('ticket inventory preserves expired, used and unused lot quantities without counting blank wins as awards',() => {
  let state=claimDaily(stocked('ordinary',5),T).state;
  state=run(state,'ordinary',1,()=>0).state;
  state=claimDaily(state,T+DAY).state;
  const inventory=ticketInventory(state,T+2*DAY);
  assert.equal(inventory.counts.used,1);
  assert.equal(inventory.counts.expired,1);
  assert.equal(inventory.counts.unused,6);
  assert.equal(inventory.used[0].firstGuide,true);
  assert.equal(ticketInventory(state,END).counts.unused,0);
  assert.equal(ticketInventory(state,END).counts.expired,7);
});

test('final true/false results count for separate leaderboards; unknown and post-deadline results do not',() => {
  let state=fill(fresh(),4);
  state=completeOrder(state,'order-1','true',T+1).state;
  state=completeOrder(state,'order-2','false',T+2).state;
  state=completeOrder(state,'order-3','unknown',T+3).state;
  const late=completeOrder(state,'order-4','true',END);
  assert.equal(late.counted,false);
  assert.equal(leaderboard(late.state,'true')[0].count,1);
  assert.equal(leaderboard(late.state,'false')[0].count,1);
  assert.equal(late.state.orders.length,4);
  assert.deepEqual(balances(late.state,T),{ordinary:2,advanced:0,daily:0});
  assert(completeOrder(state,'order-1','true',T+10).duplicate);
  assert(completeOrder(state,'order-1','false',T+10).error);
  assert(completeOrder(state,'missing','true',T).error);
  assert(completeOrder(state,'order-4','true',T-1).error);
});

test('leaderboard ties use time each user reached their current total, independent of array order',() => {
  const state=fresh();
  state.orders=[
    {id:'a2',uid:'a',at:T,result:'true',resultAt:T+30},
    {id:'b2',uid:'b',at:T,result:'true',resultAt:T+20},
    {id:'b1',uid:'b',at:T,result:'true',resultAt:T+15},
    {id:'a1',uid:'a',at:T,result:'true',resultAt:T+10},
    {id:'c1',uid:'c',at:T,result:'true',resultAt:T+5},
    {id:'bad',uid:'c',at:START-1,result:'true',resultAt:T+1}
  ].map(order => ({...order,category:'美妆',eligible:true}));
  assert.deepEqual(leaderboard(state,'true').map(({uid,count,rank}) => ({uid,count,rank})),[
    {uid:'b',count:2,rank:1},{uid:'a',count:2,rank:2},{uid:'c',count:1,rank:3}
  ]);
});

test('session is independent of old campaign and supports next day, event end and real clock',() => {
  const store=storage();
  store.setItem('jianx-card-preview-v1','old-card-data');
  assert.equal(loadEvent(store).uid,'demo-me');
  assert(Math.abs(eventNow(store)-DEFAULT_TIME)<1000);
  const state=claimDaily(loadEvent(store),T).state;
  saveEvent(state,store);
  assert.equal(loadEvent(store).tickets.length,1);
  setEventClock(T+DAY,store);
  assert(Math.abs(eventNow(store)-(T+DAY))<1000);
  assert.equal(balances(loadEvent(store),eventNow(store)).daily,0);
  setEventClock(END,store);
  assert.equal(active(eventNow(store)),false);
  setEventClock(null,store);
  assert(Math.abs(eventNow(store)-Date.now())<1000);
  assert.equal(store.getItem('jianx-card-preview-v1'),'old-card-data');
  assert.equal(resetEvent(store).tickets.length,0);
  assert(Math.abs(eventNow(store)-DEFAULT_TIME)<1000);
});

test('session recovers malformed storage and saved state is cloned',() => {
  const store=storage();
  store.setItem(EVENT_KEY,'{bad');
  const state=loadEvent(store);
  assert.equal(state.version,1);
  saveEvent(state,store);
  state.orders.push({id:'not-saved'});
  assert.equal(loadEvent(store).orders.length,0);
  assert.throws(()=>setEventClock(NaN,store),TypeError);
});

test('session retains the current demo when browser storage writes are unavailable',() => {
  const store={getItem:()=>null,setItem:()=>{throw Error('storage blocked');}};
  const state=claimDaily(loadEvent(store),T).state;
  saveEvent(state,store);
  assert.equal(loadEvent(store).tickets.length,1);
  setEventClock(T+DAY,store);
  assert(Math.abs(eventNow(store)-(T+DAY))<1000);
});
