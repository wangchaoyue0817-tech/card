import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASE2_KEY,DEFAULT_TIME,loadPhase2,savePhase2,phase2Now,phase2Clock,setPhase2Clock,resetPhase2,applyPhase2Scenario} from '../public/phase2-session.js';
import {START,END,DAY,PHASE2,claimWelcome,available,dailyCount,dailyResultCount,prizeStatus,share,recordResult} from '../public/phase2-model.js';

function storage(){const map=new Map([['jianx-card-preview-v1','legacy'],['jianx-expert-event-2026-v1','double11']]);return {map,keys:[],getItem:key=>map.get(key)||null,setItem(key,value){this.keys.push(key);map.set(key,value);}};}
test('session starts in an explicitly dated demo without auto-claiming newcomer tickets or touching old keys',()=>{
  const store=storage(),state=loadPhase2(store),now=phase2Now(store);
  assert.equal(state.activityId,PHASE2.id);assert.equal(state.welcome,null);assert.equal(state.tickets.length,0);
  assert.ok(now>=DEFAULT_TIME&&now<DEFAULT_TIME+1000);assert.equal(phase2Clock(store).mode,'demo');
  assert.ok(state.registeredAt>=START&&state.registeredAt<now);
  assert.deepEqual(new Set(store.keys),new Set([PHASE2_KEY]));
  assert.equal(store.map.get('jianx-card-preview-v1'),'legacy');assert.equal(store.map.get('jianx-expert-event-2026-v1'),'double11');
});
test('session reads and saves defensive copies and persists claimed welcome',()=>{
  const store=storage(),state=loadPhase2(store),now=phase2Now(store);
  const response=claimWelcome(state,now);savePhase2(response.state,store);
  response.state.tickets[0].remaining=0;
  assert.equal(available(loadPhase2(store),now).welcome,5);
  const read=loadPhase2(store);read.tickets[0].remaining=0;
  assert.equal(available(loadPhase2(store),now).welcome,5);
});
test('pending share survives another iframe first load but is dismissed after a top-page reload',async()=>{
  const store=storage();let state=loadPhase2(store,{navigationMarker:'page-one'});
  for(let index=0;index<10;index++)state=recordResult(state,{id:`ai-${index}`},DEFAULT_TIME).state;
  savePhase2(state,store);
  assert.equal(share(loadPhase2(store),DEFAULT_TIME).amount,5);
  const reloaded=await import(`../public/phase2-session.js?reload=${Date.now()}`);
  assert.equal(share(reloaded.loadPhase2(store,{navigationMarker:'page-one'}),DEFAULT_TIME).amount,5);
  const afterReload=reloaded.loadPhase2(store,{navigationMarker:'page-two'});
  assert.equal(share(afterReload,DEFAULT_TIME).amount,0);
  assert.equal(dailyCount(afterReload,DEFAULT_TIME),10);
});
test('storage read and write errors preserve the latest session in memory',()=>{
  const store=storage();loadPhase2(store);
  store.setItem=()=>{throw new Error('quota');};
  const claimed=claimWelcome(loadPhase2(store),DEFAULT_TIME).state;
  savePhase2(claimed,store);
  assert.equal(available(loadPhase2(store),DEFAULT_TIME).welcome,5,'stale but readable persisted state cannot replace a failed write');
  store.getItem=()=>{throw new Error('blocked');};
  assert.equal(available(loadPhase2(store),DEFAULT_TIME).welcome,5);
  setPhase2Clock(END,store);assert.ok(phase2Now(store)>=END);
});
test('corrupt sessions are repaired only in the second campaign namespace',()=>{
  const store=storage();store.map.set(PHASE2_KEY,'{broken');
  assert.equal(loadPhase2(store).activityId,PHASE2.id);
  assert.equal(store.map.get('jianx-card-preview-v1'),'legacy');
  assert.throws(()=>savePhase2({activityId:'another'},store),/只可保存/);
});
test('clock changes and resets preserve the configured Shanghai dates',()=>{
  const store=storage();loadPhase2(store);setPhase2Clock(END-1,store);
  assert.equal(phase2Clock(store).base,END-1);
  setPhase2Clock(null,store);assert.equal(phase2Clock(store).mode,'real');
  assert.throws(()=>setPhase2Clock(NaN,store),/有效/);
  const state=resetPhase2(store);assert.equal(state.welcome,null);assert.equal(phase2Clock(store).base,DEFAULT_TIME);
});
test('threshold scenarios exercise 69/70/99/100 boundaries without fabricating daily grant counts',()=>{
  const store=storage();
  for(const count of [69,70,99,100]){
    const state=applyPhase2Scenario(String(count),store),now=phase2Now(store);
    assert.equal(dailyResultCount(state,now),count);assert.equal(dailyCount(state,now),0);
    assert.equal(prizeStatus(state,'chopper',now).open,count>=70);
    assert.equal(prizeStatus(state,'selection',now).open,count>=100);
    assert.equal(available(state,now).ordinary,5);
  }
});
test('scenarios model next-day relocking, sold-out fallback, expiry, tenth-grant sharing and ended claims',()=>{
  const store=storage();
  let state=applyPhase2Scenario('next-day',store);
  assert.equal(dailyResultCount(state,phase2Now(store)),0);assert.equal(prizeStatus(state,'chopper',phase2Now(store)).open,false);
  state=applyPhase2Scenario('soldout',store);assert.equal(prizeStatus(state,'chopper',phase2Now(store)).soldOut,true);
  state=applyPhase2Scenario('expired',store);assert.equal(available(state,phase2Now(store)).welcome,0);assert.equal(available(state,phase2Now(store)).ordinary,5);
  state=applyPhase2Scenario('ten',store);assert.equal(share(loadPhase2(store),phase2Now(store)).amount,5);
  state=applyPhase2Scenario('ended',store);assert.equal(state.draws[0].rewards[0].type,'physical');assert.ok(phase2Now(store)>END);
  state=applyPhase2Scenario('new',store);assert.equal(state.welcome,null);assert.equal(phase2Clock(store).base,DEFAULT_TIME);
  assert.throws(()=>applyPhase2Scenario('unknown',store),/未知/);
});
