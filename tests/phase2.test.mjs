import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as model from '../public/phase2-model.js';
import * as session from '../public/phase2-session.js';
import {PHASE2,activityState,pageMarkup,emptyMarkup,dialogContent,poolMarkup,earningMarkup,rulesMarkup,createDrawTransaction,createGrantPresenter,drawBlockReason,drawMarkup,ticketRecordsMarkup,historyMarkup,prizePageMarkup,physicalMarkup,addressMarkup,voucherMarkup,settingsMarkup,showStatusMessage,fillDemoAddress,DEMO_ADDRESS} from '../public/phase2.js';
import {createDocument} from './events/dom-fixture.mjs';

const now=session.DEFAULT_TIME;
const ordinaryState=()=>model.invite(model.fresh({registeredAt:now-model.DAY,uid:'current-user'}),{id:'new-friend',registeredAt:now,lastInviter:'current-user'},now).state;
const store=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};

test('confirmed EB05 rules are shared by the functional page and rule modal',()=>{
  assert.equal(PHASE2.name,'海贼王 · 海贼EB05上新 免费抽活动');
  assert.equal(activityState(model.START-1),'upcoming');
  assert.equal(activityState(model.START),'active');
  assert.equal(activityState(model.END-1),'active');
  assert.equal(activityState(model.END),'ended');
  assert.deepEqual(PHASE2.ordinary,{physicalPercent:8,voucherPercent:92});
  assert.deepEqual([PHASE2.welcome.physicalPercent,PHASE2.welcome.voucherPercent],[1,99]);
  assert.deepEqual(PHASE2.prizes.map(p=>[p.quantity,p.weight,p.threshold]),[[3,20,70],[1,15,100],[40,50,0],[2,15,100]]);
  const rules=rulesMarkup();
  for(const copy of ['24 小时','活动结束失效','1%','99%','8%','92%','70 单','100 单','7 个工作日','地址不可新增或修改'])assert.ok(rules.includes(copy));
  assert.doesNotMatch(rules,/待规则确认|确认后更新|最多抽中一次实物|已中过实物/);
});

test('five earning channels keep quantities and require a registered invitation, not forwarding alone',()=>{
  assert.deepEqual(PHASE2.earning.map(row=>[row.id,row.amount,row.inDailyCap]),[['welcome',5,false],['ai',1,true],['expert',1,true],['share',5,false],['invite',5,false]]);
  assert.match(earningMarkup(),/卡牌专家鉴定支付/);
  assert.match(earningMarkup(),/转发小程序/);
  assert.doesNotMatch(earningMarkup(),/邀请链接/);
  assert.match(rulesMarkup(),/仅转发本身不获得邀请奖励/);
});

test('ticket page renders independent welcome and ordinary balances and genuine enabled states',()=>{
  const none=pageMarkup(model.fresh(),now);
  assert.match(none,/data-p2="draw-one" disabled/);
  assert.match(none,/data-p2="draw-five" disabled/);
  assert.match(none,/前端演示/);
  let state=model.claimWelcome({...ordinaryState(),registeredAt:now},now).state;
  assert.deepEqual(model.available(state,now),{ordinary:5,welcome:5});
  const html=pageMarkup(state,now);
  assert.match(html,/新人专属礼遇 <b>5 张/);
  assert.match(html,/独立券池 · 5 张需一次抽完/);
  assert.match(html,/data-p2="draw-one">/);
  assert.match(html,/data-p2="draw-five">/);
  assert.match(html,/data-p2="draw-welcome">/);
  const ended=pageMarkup(state,model.END);
  assert.match(ended,/data-p2="draw-one" disabled/);
  assert.match(ended,/活动已结束，历史抽奖与奖品仍可查看/);
});

test('opening and cancelling draw spends nothing; reveal saves five outcomes atomically once despite double click',()=>{
  let state=ordinaryState(),writes=0;
  const transaction=createDrawTransaction({read:()=>state,save:next=>{state=next;writes++;},now:()=>now,rng:()=>.5});
  transaction.prepare('ordinary',5);
  assert.equal(model.available(state,now).ordinary,5);
  assert.equal(writes,0);
  transaction.cancel();
  assert.equal(transaction.reveal(),null);
  assert.equal(writes,0);
  transaction.prepare('ordinary',5);
  const outcome=transaction.reveal();
  assert.equal(outcome.batch.rewards.length,5);
  assert.equal(state.draws.length,1);
  assert.equal(state.vouchers.length,5);
  assert.equal(model.available(state,now).ordinary,0);
  assert.equal(writes,1);
  assert.equal(transaction.reveal(),null);
  assert.equal(writes,1);
  const before=drawMarkup('ordinary',5);
  assert.equal((before.match(/data-p2="reveal"/g)||[]).length,1);
  assert.equal((before.match(/class="p2-flip-card /g)||[]).length,5);
  const after=drawMarkup('ordinary',5,outcome.batch);
  assert.equal((after.match(/专家线上<br>鉴定券/g)||[]).length,5);
  assert.doesNotMatch(after,/data-p2="reveal"/);
  assert.match(after,/data-p2="result:/);
});

test('a draw that expires after opening is rejected without saved changes',()=>{
  let state=model.claimWelcome(model.fresh({registeredAt:now}),now).state,clock=now,writes=0;
  const transaction=createDrawTransaction({read:()=>state,save:next=>{state=next;writes++;},now:()=>clock,rng:()=>.5});
  transaction.prepare('welcome',5);clock+=model.DAY;
  const result=transaction.reveal();
  assert.ok(result.error);
  assert.equal(writes,0);
  assert.equal(state.draws.length,0);
  assert.equal(state.tickets[0].remaining,5);
});

test('draw blocking distinguishes an active empty balance from an inactive activity',()=>{
  assert.equal(drawBlockReason(model.fresh(),'ordinary',1,now),'可用抽奖券不足或已过期');
  assert.equal(drawBlockReason(ordinaryState(),'ordinary',5,now),null);
  assert.equal(drawBlockReason(ordinaryState(),'ordinary',1,model.END),'当前不在活动期间');
  const welcome=model.claimWelcome(model.fresh({registeredAt:now}),now).state;
  assert.equal(drawBlockReason(welcome,'welcome',5,now+model.DAY),'可用抽奖券不足或已过期');
});

test('grant presenter saves and opens synchronously with no deferred work',async()=>{
  let state=model.fresh(),events=[];
  const outcome=model.recordResult(state,{id:'ai-visible',kind:'ai',category:'card'},now);
  const showGrant=createGrantPresenter({read:()=>state,save:next=>{state=next;events.push('saved');},now:()=>now,close:()=>events.push('closed'),present:(result,options)=>{assert.equal(result,outcome);assert.deepEqual(options,{source:'AI 卡牌鉴定完成',pool:'ordinary'});events.push('presented');},pageWindow:{jianxActive:true},pageDocument:{hidden:false}});
  assert.equal(showGrant(outcome,'AI 卡牌鉴定完成'),true);
  assert.deepEqual(events,['closed','saved','presented']);
  assert.equal(model.available(state,now).ordinary,1);
  await Promise.resolve();
  assert.deepEqual(events,['closed','saved','presented']);
});

test('hidden and inactive grant presenters dismiss an undisplayed full-cap share opportunity immediately',async()=>{
  for(const page of [{jianxActive:false,hidden:false},{jianxActive:true,hidden:true}]){
    let state=session.applyPhase2Scenario('ten',store()),presentations=0,writes=0;
    const outcome={state,awarded:true,amount:1,sharePrompt:true};
    const showGrant=createGrantPresenter({read:()=>state,save:next=>{state=next;writes++;},now:()=>now,close:()=>{},present:()=>presentations++,pageWindow:page,pageDocument:page});
    assert.equal(showGrant(outcome,'AI 卡牌鉴定完成'),false);
    assert.equal(writes,2);
    assert.equal(model.share(state,now,'claim').awarded,false);
    assert.equal(model.available(state,now).ordinary,10);
    await Promise.resolve();
    assert.equal(presentations,0);
  }
});

test('grant presenter rechecks visibility after save notifications and never reopens after navigation',async()=>{
  let state=session.applyPhase2Scenario('ten',store()),presentations=0;
  const pageWindow={jianxActive:true},pageDocument={hidden:false};
  const showGrant=createGrantPresenter({read:()=>state,save:next=>{state=next;pageWindow.jianxActive=false;},now:()=>now,close:()=>{},present:()=>presentations++,pageWindow,pageDocument});
  assert.equal(showGrant({state,awarded:true,amount:1,sharePrompt:true},'AI 卡牌鉴定完成'),false);
  assert.equal(model.share(state,now,'claim').awarded,false);
  pageWindow.jianxActive=true;
  await Promise.resolve();
  assert.equal(presentations,0);
});

test('ticket usage records retain each result while partial unused quantities and acquisition history remain accurate',()=>{
  const result=model.draw(ordinaryState(),'ordinary',1,now,()=>.5),state=result.state;
  assert.deepEqual(model.ticketCounts(state,now),{unused:4,used:1,expired:0});
  const used=ticketRecordsMarkup(state,now,'used');
  assert.match(used,/普通单抽/);
  assert.match(used,/−1 张/);
  assert.match(used,/专家鉴定券 ×1/);
  assert.ok(used.includes(`result:${result.batch.id}`));
  assert.match(ticketRecordsMarkup(state,now,'unused'),/<b>4<small> 张/);
  assert.match(historyMarkup(state),/邀请新人注册/);
  assert.match(historyMarkup(state),/<b>\+5<\/b>/);
  assert.match(ticketRecordsMarkup(state,model.END,'expired'),/已过期/);
  for(const selected of ['unused','used','expired'])assert.match(emptyMarkup(selected),/暂无/);
});

test('stock cards display the 69/70/99/100 thresholds, sellout and next-day relocking',()=>{
  const storage=store();
  const unlocked=amount=>{const state=session.applyPhase2Scenario(String(amount),storage);return (poolMarkup(state,session.phase2Now(storage)).match(/is-open/g)||[]).length;};
  assert.equal(unlocked(69),1);
  assert.equal(unlocked(70),2);
  assert.equal(unlocked(99),2);
  assert.equal(unlocked(100),4);
  const sold=session.applyPhase2Scenario('soldout',storage);
  assert.match(poolMarkup(sold,session.phase2Now(storage)),/已领完/);
  const next=session.applyPhase2Scenario('next-day',storage);
  assert.equal((poolMarkup(next,session.phase2Now(storage)).match(/is-open/g)||[]).length,1);
  assert.match(poolMarkup(next,session.phase2Now(storage)),/不重新分配/);
});

test('physical prize address form supports save and shows the correct locked/forfeited ending',()=>{
  const storage=store(),state=session.applyPhase2Scenario('won',storage),reward=state.draws[0].rewards[0];
  assert.match(physicalMarkup(state,reward,now),/填写收货信息/);
  const form=addressMarkup(state,reward.id,now);
  for(const name of ['name','phone','region','detail'])assert.ok(form.includes(`name="${name}"`));
  assert.match(form,/aria-describedby="p2-error-phone"/);
  const saved=model.saveAddress(state,reward.id,{name:'小王',phone:'13800138000',region:'浙江省 杭州市 西湖区',detail:'测试路 1 号'},now).state;
  assert.match(physicalMarkup(saved,reward,now),/138\*\*\*\*8000/);
  assert.match(physicalMarkup(saved,reward,model.END),/地址已锁定/);
  assert.match(addressMarkup(saved,reward.id,model.END),/type="submit" disabled/);
  assert.match(physicalMarkup(state,reward,model.END),/已放弃领取/);
  assert.doesNotMatch(physicalMarkup(state,reward,model.END),/data-p2="address:/);
});

test('voucher states use seven-day expiry and the use button stays an intentional placeholder',()=>{
  const state=model.draw(ordinaryState(),'ordinary',1,now,()=>.5).state,voucher=state.vouchers[0];
  assert.match(voucherMarkup(voucher,now),/去使用/);
  assert.match(voucherMarkup(voucher,now+7*model.DAY),/已过期/);
  const used=model.useVoucher(state,voucher.id,now,{paymentId:'coupon-use',category:'card'}).state;
  assert.match(prizePageMarkup(used,now,'used'),/使用于/);
  assert.match(prizePageMarkup(state,now+7*model.DAY,'expired'),/已过期/);
  assert.match(prizePageMarkup(state,now,'unused'),/海贼 EB05 活动专属奖品/);
});

test('status feedback stays inside an open native dialog and otherwise uses the page toast',()=>{
  const document=createDocument('<body><dialog id="dialog"></dialog><div id="toast" hidden></div></body>');
  const dialog=document.getElementById('dialog'),toast=document.getElementById('toast');
  dialog.open=true;let visibleCalls=0;
  const createElement=tag=>{const element=document.createElement(tag);element.scrollIntoView=()=>visibleCalls++;return element;};
  const target=showStatusMessage('去使用入口演示，不会跳转',{dialog,toast,createElement});
  assert.equal(target.parentElement,dialog);
  assert.equal(target.hidden,false);
  assert.equal(target.getAttribute('role'),'status');
  assert.equal(target.getAttribute('aria-live'),'polite');
  assert.equal(toast.hidden,true);
  assert.equal(visibleCalls,1);
  assert.equal(showStatusMessage('可用抽奖券不足',{dialog,toast,createElement}),target);
  assert.equal(dialog.querySelectorAll('.p2-dialog-notice').length,1);
  assert.equal(target.textContent,'可用抽奖券不足');
  dialog.open=false;
  assert.equal(showStatusMessage('地址已保存',{dialog,toast,createElement}),toast);
  assert.equal(toast.textContent,'地址已保存');
  assert.equal(toast.hidden,false);
});

test('demo address autofill is explicit, locally valid, and cannot alter a locked form',()=>{
  const state=session.applyPhase2Scenario('won',store()),reward=state.draws[0].rewards[0];
  const markup=addressMarkup(state,reward.id,now);
  assert.match(markup,/仅前端演示，请勿填写真实信息/);
  assert.match(markup,/仅本机保存，不用于配送/);
  assert.match(markup,/type="button" class="p2-secondary" data-p2="fill-demo-address"/);
  const document=createDocument(markup),form=document.getElementById('p2-address-form');
  fillDemoAddress(form);
  for(const [key,value] of Object.entries(DEMO_ADDRESS))assert.equal(form.querySelector(`[name="${key}"]`).value,value);
  assert.equal(Object.values(model.validateAddress(DEMO_ADDRESS)).some(Boolean),false);
  const locked=createDocument(addressMarkup(state,reward.id,model.END)).getElementById('p2-address-form');
  assert.equal(locked.querySelector('[data-p2="fill-demo-address"]').disabled,true);
  fillDemoAddress(locked);
  assert.equal(locked.querySelector('[name="name"]').value,'');
});

test('all explicit demo scenarios and real shell intents are wired without touching the old model',async()=>{
  const html=settingsMarkup(model.fresh(),now);
  for(const key of ['new','ordinary','69','70','99','100','soldout','next-day','expired','ten','won','ended','before'])assert.ok(html.includes(`scenario:${key}`));
  const source=await readFile(new URL('../public/phase2.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/localStorage|campaign-session|lottery-model|fetch\(|XMLHttpRequest/);
  for(const intent of ['draw-welcome','draw-ordinary','demo'])assert.ok(source.includes(`detail.intent==='${intent}'`));
  assert.match(source,/card-eb05-prizes/);
  assert.match(source,/window\.jianxReady\(\)/);
  assert.match(source,/window\.addEventListener\('phase2-change'/);
  assert.match(source,/type==='visibility'/);
  assert.match(source,/ArrowLeft','ArrowRight','Home','End/);
  assert.match(source,/import \{showPhase2Grant,closePhase2Grant\} from '\.\/phase2-grant-dialog\.js'/);
  assert.match(source,/present:showPhase2Grant,pageWindow:window,pageDocument:document/);
  assert.doesNotMatch(source,/await showGrant|import\('\.\/phase2-grant-dialog\.js'\)|model\.active\(now\)\?/);
  assert.match(source,/if\(key==='invite-register'\)\{if\(!inviteForwarded\)return;inviteForwarded=false;/);
  assert.equal(dialogContent('history').title,'获得记录');
});

test('readable text, shared page tabs, neutral disabled controls and simultaneous flip layout are retained',async()=>{
  const css=await readFile(new URL('../public/phase2.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/c9bdecjustify/);
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,selector,body])=>({selector:selector.trim(),body}));
  const decoration=new Set(['.p2-header>div>span','.p2-eyebrow','.p2-prize-art>span','.p2-expert-pass>div>span','.p2-ticket-strip','.p2-physical-art small','.p2-draw-eyebrow']);
  for(const rule of rules){const size=rule.body.match(/font-size:([\d.]+)px/);if(size)assert.ok(Number(size[1])>=(decoration.has(rule.selector)?9:11),`${rule.selector} text is too small`);}
  const find=selector=>rules.find(rule=>rule.selector===selector)?.body;
  for(const selector of ['.p2-rules p','.p2-earning-list p','.p2-info-note'])assert.match(find(selector),/font-size:13px/);
  assert.match(find('.p2-draw-actions>button'),/background:#202435/);
  assert.match(find('.p2-header'),/grid-template-columns:64px minmax\(0,1fr\) 64px/);
  assert.match(find('.p2-primary'),/linear-gradient\(112deg,#5B68ED,#7753DD 58%,#A660D1\)/);
  assert.match(find('.p2-view-tabs button[aria-selected="true"]'),/background:#6958EE/);
  assert.match(find('.p2-view-tabs button[aria-selected="true"]'),/inset 0 1px #9185F2/);
  assert.match(find('.p2-flip-card:nth-child(4)'),/grid-column:2\/span 2/);
  assert.match(find('.p2-flip-card:nth-child(5)'),/grid-column:4\/span 2/);
  assert.doesNotMatch(css,/transition-delay/);
});
