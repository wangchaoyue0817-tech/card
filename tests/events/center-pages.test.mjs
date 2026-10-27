import test from 'node:test';
import assert from 'node:assert/strict';
import {START,END,DAY,fresh,welcome,invite,draw} from '../../public/events/lottery-model.js';
import {ticketPanel,prizePanel,ticketHistory} from '../../public/events/center-pages.js';
import {ticketInventory} from '../../public/events/ticket-inventory.js';
const t=START+3600000;
test('center shows management hierarchy, not marketing or card navigation',()=>{
  const html=ticketPanel(fresh(),t);
  assert.match(html,/可用抽奖券/);assert.match(html,/获得记录/);assert.match(html,/暂无未使用抽奖券/);
  assert.doesNotMatch(html,/今日鉴定获券/);
  assert.doesNotMatch(html,/让热爱|2026 卡牌收藏季|nav-card|cl-lottery-hero/);
});
test('newcomer gift retains used state after expiry; acquisition history stays positive',()=>{
  let state=welcome(fresh('new',START),t).state;
  state=draw(state,'welcome',5,t+1000,()=>0.9).state;
  const html=ticketHistory(state,t+2*DAY);
  assert.match(html,/已使用 5 张/);assert.equal(ticketInventory(state,t+2*DAY).counts.expired,0);
  assert.match(html,/>\+5<small>/);assert.doesNotMatch(html,/data-action="draw-welcome"/);
  assert.match(prizePanel(state,t+2*DAY,()=>''),/专家线上鉴别券/);
  assert.match(prizePanel(state,t+2*DAY,()=>''),/到期时间<br>2026/);
});
test('expiry applies to remaining ordinary balance, not historical incoming rows',()=>{
  let state=fresh('old',START-DAY);
  state=invite(state,{id:'friend',registeredAt:t,clicks:[{uid:state.uid,at:t-1}]},t).state;
  state=draw(state,'ordinary',1,t+1,()=>0.9).state;
  const html=ticketPanel(state,END);
  assert.match(html,/4 张未使用普通券已失效/);assert.match(ticketHistory(state,END),/>\+5<small>/);
  assert.doesNotMatch(html,/邀请新用户注册.*已使用/);
});
test('physical rewards keep address entry; vouchers have a non-mutating use entry',()=>{
  let state=fresh('old',START-DAY);
  state=invite(state,{id:'friend',registeredAt:t,clicks:[{uid:state.uid,at:t-1}]},t).state;
  state=draw(state,'ordinary',5,t+1,()=>0).state;
  const html=prizePanel(state,t+2,()=>'<div>photo</div>');
  assert.match(html,/填写收货信息/);assert.match(html,/到期时间/);assert.match(html,/×4/);
  assert.match(html,/coupon-use/);assert.match(html,/去使用/);assert.doesNotMatch(html,/已自动发放至账户/);
  assert.doesNotMatch(html,/物流|去兑换|data-action="nav-card"/);
});
test('ordinary wallet totals exclude welcome tickets; welcome expiry remains exact',()=>{
  let state=welcome(fresh('new',START),t).state;
  const pending=ticketPanel(state,t);
  assert.match(pending,/有效至 2026\/09\/26 01:00/);
  state=draw(state,'welcome',5,t+1000,()=>0.9).state;
  const html=ticketPanel(state,t+2000);
  assert.match(html,/累计获得 <b>0<\/b>/);
  assert.match(html,/累计使用 <b>0<\/b>/);
});
