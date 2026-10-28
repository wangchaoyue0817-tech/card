import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASE2,START,END,DAY,fresh,active,activityState,claimWelcome,recordResult,recordExpertPayment,available,dailyCount,dailyResultCount,share,invite,draw,ticketRows,ticketCounts,prizeStatus,saveAddress,addressStatus,useVoucher,dismissPendingShares} from '../public/phase2-model.js';

const now=START+12*3_600_000;
const make=()=>fresh({uid:'current',registeredAt:now-1_000});
function ordinary(state=make(),at=now){return invite(state,{id:`friend-${state.invitations.length}`,registeredAt:at,lastInviter:state.uid},at).state;}
function results(state,count,at=now){for(let index=0;index<count;index++)state=recordResult(state,{id:`result-${at}-${index}`,kind:'expert',category:'card'},at).state;return state;}
const rolls=(...values)=>()=>values.length?values.shift():0.99;
const address={name:'演示用户',phone:'13800000000',region:'北京市 朝阳区',detail:'演示地址 1 号'};

test('activity uses Shanghai inclusive start and exclusive midnight end',()=>{
  assert.equal(active(START-1),false);assert.equal(active(START),true);
  assert.equal(active(END-1),true);assert.equal(active(END),false);
  assert.equal(activityState(START-1),'upcoming');assert.equal(activityState(END),'ended');
  assert.equal(PHASE2.prizes.reduce((sum,prize)=>sum+prize.quantity,0),46);
});
test('newly registered user claims only on the secondary card entry, once, with no input mutation',()=>{
  const original=make(),snapshot=structuredClone(original);
  for(const options of [{entry:'home'},{entry:'card',fromPhoto:true}])assert.equal(claimWelcome(original,now,options).awarded,false);
  const claimed=claimWelcome(original,now,{entry:'card'});
  assert.deepEqual(original,snapshot);assert.equal(claimed.amount,5);
  assert.deepEqual(available(claimed.state,now),{ordinary:0,welcome:5});
  assert.equal(claimed.state.welcome.expiresAt,now+DAY);
  assert.equal(claimWelcome(claimed.state,now+1).awarded,false);
  for(const registeredAt of [START-1,now+1,NaN])assert.equal(claimWelcome(fresh({registeredAt}),now).awarded,false);
});
test('welcome expires at 24 hours or the event end, cannot be split or mixed with ordinary tickets',()=>{
  let state=claimWelcome(make(),now).state;state=ordinary(state);
  assert.equal(draw(state,'welcome',1,now).state,state);
  assert.equal(draw(state,'welcome',4,now).state,state);
  assert.equal(available(state,now+DAY).welcome,0);
  const late=claimWelcome(fresh({registeredAt:END-2}),END-1).state;
  assert.equal(late.welcome.expiresAt,END);
  assert.equal(available(late,END).welcome,0);
  const outcome=draw(state,'welcome',5,now,()=>0.99);
  assert.equal(available(outcome.state,now).ordinary,5);
  assert.equal(available(outcome.state,now).welcome,0);
});
test('AI results and expert payments share the daily cap, while expert results only advance release thresholds',()=>{
  let state=make();
  state=recordResult(state,{id:'expert-1',kind:'expert',category:'card'},now).state;
  assert.equal(dailyResultCount(state,now),1);assert.equal(dailyCount(state,now),0);
  state=recordExpertPayment(state,{id:'pay-1',category:'card'},now).state;
  assert.equal(dailyResultCount(state,now),1);assert.equal(dailyCount(state,now),1);
  let response;
  for(let index=0;index<9;index++){response=recordResult(state,{id:`ai-${index}`,kind:'ai',category:'card'},now);state=response.state;}
  assert.equal(response.sharePrompt,true);assert.equal(dailyCount(state,now),10);
  const capped=recordResult(state,{id:'extra-result',kind:'ai',category:'card'},now);
  assert.equal(capped.capped,true);assert.equal(capped.amount,0);assert.equal(dailyResultCount(capped.state,now),11);
  assert.equal(available(capped.state,now).ordinary,10);
});
test('repeated callbacks and other categories cannot duplicate rewards or release counts',()=>{
  let state=recordResult(make(),{id:'one',kind:'ai',category:'card'},now).state;
  assert.equal(recordResult(state,{id:'one',kind:'ai',category:'card'},now).duplicate,true);
  state=recordExpertPayment(state,{id:'paid',category:'card'},now).state;
  assert.equal(recordExpertPayment(state,{id:'paid',category:'card'},now).duplicate,true);
  for(const category of ['skin','bags','']){
    assert.equal(recordResult(state,{id:'other',category},now).state,state);
    assert.equal(recordExpertPayment(state,{id:'other',category},now).state,state);
  }
  assert.equal(recordResult(state,{id:'failed',success:false},now).state,state);
  assert.equal(recordResult(state,{id:'old'},START-1).state,state);
  assert.equal(dailyCount(state,now),2);assert.equal(dailyResultCount(state,now),1);
});
test('daily result gates reset at Shanghai midnight and payments never unlock prizes',()=>{
  let state=results(make(),69);
  assert.equal(prizeStatus(state,'chopper',now).open,false);
  state=recordExpertPayment(state,{id:'payment'},now).state;
  assert.equal(prizeStatus(state,'chopper',now).open,false);
  state=recordResult(state,{id:'seventieth',kind:'expert'},now).state;
  assert.equal(prizeStatus(state,'chopper',now).open,true);
  assert.equal(prizeStatus(state,'selection',now).open,false);
  state=results(state,30,now+1);
  assert.equal(prizeStatus(state,'selection',now+1).open,true);assert.equal(prizeStatus(state,'eb05-box',now+1).open,true);
  assert.equal(prizeStatus(state,'chopper',START+DAY).open,false);
  assert.equal(prizeStatus(state,'eb05-pack',START+DAY).open,true);
  assert.equal(dailyCount(state,START+DAY),0);
});
test('welcome is one percent and ordinary eight percent at exact probability boundaries',()=>{
  const ordinaryState=ordinary(),welcomeState=claimWelcome(make(),now).state;
  assert.equal(draw(ordinaryState,'ordinary',1,now,rolls(.079999,.5)).batch.rewards[0].type,'physical');
  assert.equal(draw(ordinaryState,'ordinary',1,now,rolls(.08)).batch.rewards[0].type,'voucher');
  assert.equal(draw(welcomeState,'welcome',5,now,rolls(.009999,.5)).batch.rewards[0].type,'physical');
  assert.equal(draw(welcomeState,'welcome',5,now,rolls(.01)).batch.rewards[0].type,'voucher');
});
test('closed and sold-out weighted slots become expert vouchers without reallocating or refunding draw tickets',()=>{
  const state=ordinary();
  const closed=draw(state,'ordinary',1,now,rolls(.01,.1));
  assert.equal(closed.batch.rewards[0].type,'voucher');assert.equal(closed.state.stocks.chopper,3);
  assert.equal(available(closed.state,now).ordinary,4);assert.equal(closed.state.tickets.length,1);
  const open=results(state,100);open.stocks.chopper=0;
  const sold=draw(open,'ordinary',1,now,rolls(.01,.1));
  assert.equal(sold.batch.rewards[0].type,'voucher');assert.equal(sold.state.stocks['eb05-pack'],40);
  assert.equal(sold.batch.rewards[0].expiresAt,now+7*DAY);
});
test('four physical intervals retain their fixed weights after every threshold is met',()=>{
  const state=results(ordinary(),100);
  for(const [roll,prizeId] of [[0,'chopper'],[.19999,'chopper'],[.2,'selection'],[.34999,'selection'],[.35,'eb05-pack'],[.84999,'eb05-pack'],[.85,'eb05-box'],[.99999,'eb05-box']]){
    const response=draw(state,'ordinary',1,now,rolls(0,roll));
    assert.equal(response.batch.rewards[0].prizeId,prizeId);
  }
});
test('five draws commit all five results and consume only one physical inventory unit at most',()=>{
  const state=results(ordinary(),100),before=structuredClone(state);
  const response=draw(state,'ordinary',5,now,()=>0);
  assert.deepEqual(state,before);assert.equal(response.batch.rewards.length,5);
  assert.equal(response.batch.rewards.filter(reward=>reward.type==='physical').length,1);
  assert.equal(response.state.stocks.chopper,2);assert.equal(response.state.physicalWon,true);
  assert.equal(response.state.vouchers.length,4);assert.equal(available(response.state,now).ordinary,0);
  const replenished=ordinary(response.state);
  assert.equal(draw(replenished,'ordinary',1,now,()=>0).batch.rewards[0].type,'voucher');
});
test('draw requests can be replayed idempotently and random failures never partially debit',()=>{
  const state=ordinary();
  const first=draw(state,'ordinary',1,now,()=>.99,{requestId:'same'});
  const repeat=draw(first.state,'ordinary',1,now,()=>0,{requestId:'same'});
  assert.equal(repeat.duplicate,true);assert.equal(repeat.state,first.state);assert.equal(repeat.batch.id,first.batch.id);
  for(const value of [-.1,1,NaN])assert.equal(draw(state,'ordinary',1,now,()=>value).state,state);
  assert.equal(draw(state,'ordinary',5,END).state,state);
  assert.equal(draw(state,'ordinary',6,now).state,state);
  assert.equal(draw(make(),'ordinary',1,now).state.draws.length,0);
});
test('tenth grant opens one share chance; claim, dismissal and the next day are independent',()=>{
  let state=make();for(let index=0;index<10;index++)state=recordResult(state,{id:`ai-${index}`},now).state;
  const claimed=share(state,now);
  assert.equal(claimed.amount,5);assert.equal(share(claimed.state,now).amount,0);assert.equal(dailyCount(claimed.state,now),10);
  assert.equal(share(share(state,now,'dismiss').state,now).amount,0);
  assert.equal(share(dismissPendingShares(state),now).amount,0);
  assert.equal(share(state,START+DAY).amount,0);
  let tomorrow=state;for(let index=0;index<10;index++)tomorrow=recordResult(tomorrow,{id:`tomorrow-${index}`},START+DAY).state;
  assert.equal(share(tomorrow,START+DAY).amount,5);
});
test('invitation awards only a new registered friend attributed to this user, once, outside the cap',()=>{
  const state=make();
  for(const person of [{id:'other',registeredAt:now,lastInviter:'someone'},{id:'old',registeredAt:START-1,lastInviter:'current'},{id:'current',registeredAt:now,lastInviter:'current'},{id:'future',registeredAt:now+1,lastInviter:'current'}])assert.equal(invite(state,person,now).awarded,false);
  const person={id:'friend',registeredAt:now,lastInviter:'current'},first=invite(state,person,now);
  assert.equal(first.amount,5);assert.equal(dailyCount(first.state,now),0);
  assert.equal(invite(first.state,person,now).duplicate,true);
});
test('partial ticket usage is retained across unused, used and expired statuses',()=>{
  const state=draw(ordinary(),'ordinary',1,now,()=>.99).state;
  assert.deepEqual(ticketCounts(state,now),{unused:4,used:1,expired:0});
  assert.deepEqual(ticketCounts(state,END),{unused:0,used:1,expired:4});
  assert.equal(ticketRows(state,'used',END)[0].amount,1);
  assert.equal(ticketRows(state,'expired',END)[0].amount,4);
  assert.equal(available(state,END).ordinary,0);
});
test('physical addresses can be saved before end, then both new entry and edits are locked',()=>{
  const response=draw(results(ordinary(),100),'ordinary',1,now,()=>0),state=response.state,rewardId=response.batch.rewards[0].id;
  assert.equal(addressStatus(state,rewardId,now),'pending');assert.equal(addressStatus(state,rewardId,END),'forfeited');
  assert.ok(saveAddress(state,rewardId,{...address,phone:'bad'},now).error);
  const saved=saveAddress(state,rewardId,address,END-1);
  assert.equal(saved.saved,true);assert.equal(addressStatus(saved.state,rewardId,END),'locked');
  assert.equal(saveAddress(state,rewardId,address,END).state,state);
  assert.equal(saveAddress(saved.state,rewardId,{...address,name:'Changed'},END).state,saved.state);
  assert.ok(saveAddress(state,'missing',address,now).error);
});
test('expert vouchers survive the event end and can be used once without a post-event lottery grant',()=>{
  const state=ordinary(make(),END-1),drawn=draw(state,'ordinary',1,END-1,()=>.99).state,voucher=drawn.vouchers[0];
  assert.equal(voucher.expiresAt,END-1+7*DAY);
  const used=useVoucher(drawn,voucher.id,END+1,{paymentId:'after-end'});
  assert.equal(used.state.vouchers[0].used,true);assert.equal(used.amount,0);
  assert.equal(useVoucher(used.state,voucher.id,END+2,{paymentId:'again'}).state,used.state);
  assert.ok(useVoucher(drawn,voucher.id,voucher.expiresAt,{paymentId:'expired'}).error);
});
test('voucher payment grants one ticket but does not count an expert result until that result arrives',()=>{
  const state=draw(ordinary(),'ordinary',1,now,()=>.99).state,voucher=state.vouchers[0];
  const paid=recordExpertPayment(state,{id:'order',voucherId:voucher.id},now);
  assert.equal(paid.amount,1);assert.equal(paid.state.vouchers[0].used,true);assert.equal(dailyResultCount(paid.state,now),0);
  const completed=recordResult(paid.state,{id:'order',kind:'expert'},now);
  assert.equal(completed.amount,0);assert.equal(dailyResultCount(completed.state,now),1);
});
