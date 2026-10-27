import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_SCENE_GROUPS,DEMO_DRAW_OPTIONS,buildDemoScene,applyDemoScene
} from '../../public/events/expert-event-demo.js';
import {
  START,END,PRIZES,balances,draw,submitOrder,leaderboard,ticketInventory
} from '../../public/events/expert-event-model.js';
import {EVENT_KEY,loadEvent,eventNow} from '../../public/events/expert-event-session.js';

const mockStorage=()=>{
  const values=new Map(),writes=[];
  return {values,writes,getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes.push(key);values.set(key,value);}};
};
const runScene=scene=>draw(scene.state,{
  pool:scene.pool,count:scene.count,requestId:`test-${scene.id}`
},scene.now,scene.random??(()=>.5));
const ownCount=state=>state.orders.filter(order=>order.uid===state.uid&&order.eligible).length;

test('six scene groups have unique, buildable presets',()=>{
  assert.equal(DEMO_SCENE_GROUPS.length,6);
  const ids=DEMO_SCENE_GROUPS.flatMap(group=>group.scenes.map(scene=>scene.id));
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ids) {
    const scene=buildDemoScene(id);
    assert.equal(scene.id,id);assert(Number.isFinite(scene.now));
    assert(['home','progress','draw','lottery','upload','ranking'].includes(scene.destination));
  }
  assert.throws(()=>buildDemoScene('missing'),/未找到/);
});

test('first introduction consumes only its marked daily ticket and always shows none',()=>{
  const scene=buildDemoScene('first');
  assert.equal(scene.guide,true);
  assert.deepEqual(balances(scene.state,scene.now),{ordinary:1,advanced:0,daily:1});
  const result=draw(scene.state,{pool:'ordinary',count:1,requestId:'first'},scene.now,()=>.01);
  assert.equal(result.batch.rewards[0].type,'none');
  assert.equal(scene.state.tickets[0].remaining,1,'pure fixture is not mutated');
});

test('used-daily scene records its first draw and cannot draw again without appraisal',()=>{
  const scene=buildDemoScene('daily-used');
  assert.deepEqual(balances(scene.state,scene.now),{ordinary:0,advanced:0,daily:0});
  assert.equal(scene.state.draws[0].rewards[0].type,'none');
});

test('next day silently refreshes its gift, preserves yesterday as expired and uses normal probabilities',()=>{
  const scene=buildDemoScene('next-day'),inventory=ticketInventory(scene.state,scene.now);
  assert.equal(scene.guide,false);
  assert.equal(scene.notice,undefined);
  assert.equal(scene.destination,'home');
  assert.equal(inventory.counts.expired,1);
  assert.equal(inventory.counts.unused,1);
  assert.equal(scene.state.tickets[1].firstGuide,false);
  const result=draw(scene.state,{pool:'ordinary',count:1,requestId:'second-day'},scene.now,()=>.01);
  assert.equal(result.batch.rewards[0].type,'physical');
});

for(const [count,ordinary,advanced,reward] of [
  [1,0,0,null],[2,1,0,'ordinary'],[9,4,0,null],[10,4,1,'advanced'],
  [14,6,1,'ordinary'],[20,8,2,'advanced'],[50,20,5,'advanced']
])test(`progress ${count} follows real milestone rules and exposes the appropriate reward`,()=>{
  const scene=buildDemoScene(`progress-${count}`);
  assert.equal(ownCount(scene.state),count);
  assert.deepEqual(balances(scene.state,scene.now),{ordinary,advanced,daily:0});
  assert.equal(scene.reward?.pool??null,reward);
  assert.equal(scene.destination,'progress');
  assert(scene.state.orders.every(order=>order.eligible));
});

test('demo progress cycles through the same seven activity categories without legacy merged labels',()=>{
  const scene=buildDemoScene('progress-14');
  const expected=['美妆','包袋','鞋靴','服饰','手表','数码家电','3C无损'];
  assert.deepEqual(scene.state.orders.map(order=>order.category),[...expected,...expected]);
  assert(scene.state.orders.every(order=>order.eligible));
});

test('draw scenarios supply valid same-pool tickets without changing global randomness',()=>{
  const original=Math.random;
  for(const pool of ['ordinary','advanced'])for(const count of [1,5]) {
    const scene=buildDemoScene('draw',{pool,count,outcome:'random'});
    assert(balances(scene.state,scene.now)[pool]>=count);
    assert.equal(scene.random,undefined);
    assert.equal(Math.random,original);
    assert.equal(runScene(scene).batch.rewards.length,count);
  }
});

test('targeted physical scene selects every requested prize through the real draw model',()=>{
  for(const prize of PRIZES) {
    const scene=buildDemoScene('draw',{pool:prize.pool,count:1,outcome:'physical',prizeId:prize.id});
    const result=runScene(scene);
    assert.equal(result.batch.rewards[0].prizeId,prize.id);
    assert.equal(result.batch.rewards[0].type,'physical');
  }
});

test('targeted voucher and none work with both pools and single or five draws',()=>{
  for(const pool of ['ordinary','advanced'])for(const count of [1,5])for(const outcome of ['voucher','none']) {
    const result=runScene(buildDemoScene('draw',{pool,count,outcome}));
    assert.equal(result.batch.rewards.length,count);
    assert(result.batch.rewards.every(reward=>reward.type===outcome));
  }
});

test('mixed five draws reveal exactly one physical, three vouchers, and one none',()=>{
  for(const pool of ['ordinary','advanced']) {
    const scene=buildDemoScene('draw',{pool,count:5,outcome:'mixed'});
    const rewards=runScene(scene).batch.rewards;
    assert.deepEqual(rewards.map(reward=>reward.type),['physical','voucher','none','voucher','voucher']);
  }
});

test('physical five draw keeps the cross-pool per-user physical ceiling',()=>{
  const scene=buildDemoScene('draw',{pool:'advanced',count:5,outcome:'physical'});
  assert.deepEqual(runScene(scene).batch.rewards.map(reward=>reward.type),['physical','voucher','voucher','voucher','voucher']);
});

test('draw settings reject unsupported combinations without writing state',()=>{
  assert.equal(DEMO_DRAW_OPTIONS.outcomes.length,5);
  for(const options of [{pool:'card'},{count:3},{outcome:'win'},{outcome:'mixed',count:1},{pool:'ordinary',outcome:'physical',prizeId:'coach-belt'}]) {
    assert.throws(()=>buildDemoScene('draw',options),RangeError);
  }
});

test('insufficient scene has exactly four ordinary tickets and five draw remains blocked',()=>{
  const scene=buildDemoScene('insufficient');
  assert.equal(balances(scene.state,scene.now).ordinary,4);
  assert.match(runScene(scene).error,/不足/);
});

test('prior ordinary physical win also prevents an advanced physical and transfers probability',()=>{
  const scene=buildDemoScene('physical-won');
  assert.equal(scene.state.physicalWon,true);
  assert(scene.state.draws.some(batch=>batch.pool==='ordinary'&&batch.rewards.some(reward=>reward.type==='physical')));
  assert.equal(scene.pool,'advanced');
  assert.equal(runScene(scene).batch.rewards[0].type,'voucher');
});

test('sold-out preset leaves none probability intact while physical roll becomes a voucher',()=>{
  const scene=buildDemoScene('sold-out');
  assert(Object.values(scene.state.stocks).every(stock=>stock===0));
  assert.equal(runScene(scene).batch.rewards[0].type,'voucher');
  const none=draw(scene.state,{pool:'advanced',count:1,requestId:'sold-none'},scene.now,()=>.9);
  assert.equal(none.batch.rewards[0].type,'none');
});

test('excluded card expert submission remains free-flow-compatible but earns no reward',()=>{
  const scene=buildDemoScene('excluded');
  assert.equal(scene.destination,'upload');
  assert.equal(scene.selection.category,'卡牌');
  const result=submitOrder(scene.state,{id:'excluded-card',category:scene.selection.category},scene.now);
  assert.equal(result.order.eligible,false);assert.equal(result.reward,null);
  assert.equal(ownCount(result.state),0);
});

test('time presets show unopened and ended states without erasing earned records',()=>{
  const before=buildDemoScene('not-started'),after=buildDemoScene('ended');
  assert(before.now<START);assert(after.now>=END);
  assert.deepEqual(balances(after.state,after.now),{ordinary:0,advanced:0,daily:0});
  assert(ticketInventory(after.state,after.now).counts.expired>0);
  assert(after.state.vouchers.length>0);
  assert(after.state.draws.length>0);
});

test('leaderboard presets place me at the promised positions with masked peers',()=>{
  for(const [id,range] of [['rank-unranked',null],['rank-normal',[4,100]],['rank-top3',[1,3]],['rank-dual',[1,3]]]) {
    const scene=buildDemoScene(id),rows=leaderboard(scene.state,'true');
    assert.equal(scene.state.demoRanking,true);
    assert(scene.state.users.filter(user=>user.uid!==scene.state.uid).every(user=>user.username.includes('**')));
    assert(scene.state.users.every(user=>/^1[3-9]\d\*{4}\d{4}$/.test(user.phone)),
      'all ranking fixture identities carry only already-masked demonstration phone numbers');
    const me=rows.find(row=>row.uid===scene.state.uid);
    if(range)assert(me.rank>=range[0]&&me.rank<=range[1],`${id}: ${me.rank}`);
    else assert.equal(me,undefined);
    if(id==='rank-dual')assert(leaderboard(scene.state,'false').find(row=>row.uid===scene.state.uid).rank<=3);
  }
});

test('building scenes is repeatable and does not mutate options',()=>{
  const options={pool:'advanced',count:5,outcome:'mixed'};
  const a=buildDemoScene('draw',options),b=buildDemoScene('draw',options);
  assert.deepEqual(a.state,b.state);
  assert.deepEqual(runScene(a).batch,runScene(b).batch);
  assert.deepEqual(options,{pool:'advanced',count:5,outcome:'mixed'});
});

test('applying a scene writes only the dedicated expert key and preserves legacy card data',()=>{
  const storage=mockStorage(),legacy='{"state":{"keep":"card history"}}';
  storage.values.set('jianx-card-preview-v1',legacy);
  const scene=applyDemoScene('progress-14',{storage});
  assert.deepEqual(loadEvent(storage),scene.state);
  assert(Math.abs(eventNow(storage)-scene.now)<1000);
  assert(storage.writes.length>0);
  assert(storage.writes.every(key=>key===EVENT_KEY));
  assert.equal(storage.values.get('jianx-card-preview-v1'),legacy);
});

test('card presets only navigate and do not read, reset or write either activity session',()=>{
  const storage={getItem(){throw new Error('Unexpected read');},setItem(){throw new Error('Unexpected write');}};
  for(const [id,event] of [['card-history','card-past'],['card-next','card-next']]) {
    const scene=applyDemoScene(id,{storage});
    assert.equal(scene.event,event);assert.equal(scene.destination,'lottery');assert.equal(scene.persist,false);
  }
});
