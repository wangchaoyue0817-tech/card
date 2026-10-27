import test from 'node:test';
import assert from 'node:assert/strict';
import {START,END,DAY,fresh,welcome,identify,invite,draw} from '../../public/events/lottery-model.js';
import {ticketInventory} from '../../public/events/ticket-inventory.js';
import {selectionMarkup,rarityCopy,rewardTier} from '../../public/events/draw-experience.js';
import {grantMarkup,rulesMarkup} from '../../public/events/reward-ui.js';
import {ticketPanel} from '../../public/events/center-pages.js';
const t=START+3600000;
test('five choices for either draw type, explicit five-draw consumption',()=>{
  for(const count of [1,5])assert.equal((selectionMarkup(count,'ordinary').match(/data-pick=/g)||[]).length,5);
  assert.match(selectionMarkup(5,'welcome'),/一次使用 5 张/);
  assert.match(selectionMarkup(1,'ordinary'),/未选牌，不消耗抽奖券/);
});
test('all ticket grants expose immediate draw, center and dismiss',()=>{
  for(const source of ['AI 鉴定','专家鉴定','满额分享','邀请注册']){
    const html=grantMarkup({source,amount:1,expiresAt:END});
    for(const action of ['draw-one','grant-center','close'])assert.match(html,new RegExp(`data-action="${action}"`));
  }
  assert.match(grantMarkup({pool:'welcome',amount:5,expiresAt:t+DAY}),/data-action="draw-welcome"/);
});
test('10th ticket combines award, daily cap, and one-off sharing in one modal',()=>{
  const html=grantMarkup({amount:1,today:10,sharePrompt:true,expiresAt:END});
  for(const text of ['+1','10 / 10','share-claim','grant-center','draw-one','每天限领一次','关闭或离开此弹窗'])assert.ok(html.includes(text));
});
test('public rules remove requested rows and internal physical-win restriction',()=>{
  const html=rulesMarkup();
  assert.doesNotMatch(html,/<td>新人五连抽|已中过实物|最多中一次|中实物后的|交互原型|模拟/);
  assert.match(html,/<td>普通抽奖/);
  assert.equal(rewardTier({type:'physical'}),'rare');assert.match(rarityCopy('welcome'),/1%/);assert.match(rarityCopy('ordinary'),/5%/);
});
test('partial consumption produces exact unused, used, expired counts',()=>{
  let state=fresh('old',START-DAY);
  state=invite(state,{id:'friend',registeredAt:t,clicks:[{uid:state.uid,at:t-1}]},t).state;
  state=identify(state,{id:'ai',kind:'ai'},t+1).state;
  state=draw(state,'ordinary',1,t+2,()=>.9).state;
  const inventory=ticketInventory(state,t+3);
  assert.deepEqual(inventory.counts,{unused:5,used:1,expired:0});
  assert.equal(inventory.lots.find(l=>l.source==='邀请新用户注册').remaining,4);
  assert.equal(inventory.lots.find(l=>l.source==='AI 鉴定').remaining,1);
  assert.deepEqual(ticketInventory(state,END).counts,{unused:0,used:1,expired:5});
  const html=ticketPanel(state,t+3,'used');assert.match(html,/普通单抽/);assert.match(html,/−1/);assert.match(html,/专家鉴定券 ×1/);assert.match(html,/data-action="result-batch/);
});
test('welcome and ordinary remain separate, used never becomes expired',()=>{
  let state=welcome(fresh('new',START),t).state;
  state=identify(state,{id:'ai',kind:'ai'},t+1).state;
  state=draw(state,'welcome',5,t+2,()=>.9).state;
  assert.deepEqual(ticketInventory(state,t+2*DAY).counts,{unused:1,used:5,expired:0});
  assert.deepEqual(ticketInventory(state,END).counts,{unused:0,used:5,expired:1});
  const expired=ticketPanel(state,END,'expired');assert.match(expired,/is-expired/);assert.match(expired,/disabled/);
});
