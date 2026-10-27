import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PHASE2,activityState,pageMarkup,emptyMarkup,dialogContent,poolMarkup,earningMarkup,rulesMarkup} from '../public/phase2.js';

test('phase 2 preview uses confirmed EB05 dates, prize amounts and ordinary probabilities',()=>{
  assert.equal(PHASE2.name,'海贼王 · 海贼EB05上新 免费抽活动');
  assert.equal(activityState(Date.parse('2026-10-27T12:00:00+08:00')),'upcoming');
  assert.equal(activityState(Date.parse(PHASE2.startsAt)),'active');
  assert.equal(activityState(Date.parse(PHASE2.endsAt)),'active');
  assert.equal(activityState(Date.parse(PHASE2.endsAt)+1),'ended');
  assert.deepEqual(PHASE2.ordinary,{physicalPercent:8,voucherPercent:92});
  assert.deepEqual(PHASE2.prizes.map(p=>[p.quantity,p.weight]),[[3,20],[1,15],[40,50],[2,15]]);
  assert.equal(PHASE2.prizes.reduce((sum,p)=>sum+p.quantity,0),46);
  assert.equal(PHASE2.expertVoucherDays,7);
  assert.equal(PHASE2.shippingWorkingDays,7);
});

test('five earning channels keep their quantities and daily-cap treatment',()=>{
  assert.deepEqual(PHASE2.earning.map(row=>[row.id,row.amount,row.inDailyCap]),[['welcome',5,false],['ai',1,true],['expert',1,true],['share',5,false],['invite',5,false]]);
  assert.equal(PHASE2.dailyIdentificationCap,10);
  assert.match(earningMarkup(),/卡牌类专家鉴定订单/);
  assert.match(earningMarkup(),/转发小程序/);
  assert.doesNotMatch(earningMarkup(),/邀请链接/);
});

test('preview never enables draws or presents invented ticket expiry, newcomer odds or stock gates',()=>{
  assert.equal(PHASE2.drawEnabled,false);
  const html=pageMarkup(Date.parse('2026-10-31T12:00:00+08:00'));
  assert.match(html,/活动预览/);
  assert.match(html,/抽奖交互待规则确认后开放/);
  assert.equal((html.match(/<button disabled>/g)||[]).length,2);
  assert.doesNotMatch(html,/data-p2="draw|data-action="draw/);
  assert.match(rulesMarkup(),/新人抽奖概率、抽奖券有效期及实物分批开放细则确认后更新/);
  assert.doesNotMatch(rulesMarkup(),/24 小时|新人.*1%|100.*订单|最多抽中一次实物/);
  assert.match(poolMarkup(),/具体开放门槛与投放细则确认后更新/);
});

test('ticket tabs and dialogs preserve empty preview states and usable navigation',()=>{
  const html=pageMarkup();
  for(const state of ['unused','used','expired']){assert.match(html,new RegExp(`id="p2-tab-${state}"`));assert.match(emptyMarkup(state),/暂无/);}
  assert.match(emptyMarkup('used'),/消耗的券数与结果/);
  for(const action of ['back','card','prizes','rules','pool','earning','history'])assert.match(html,new RegExp(`data-p2="${action}"`));
  assert.equal(dialogContent('history').title,'获得记录');
  assert.equal(dialogContent('pool').title,'本期收藏好礼');
  assert.equal(dialogContent('earning').title,'把好运攒起来');
  assert.match(dialogContent('rules').content,/7 个工作日/);
});

test('preview is self-contained and does not modify existing activity data',async()=>{
  const source=await readFile(new URL('../public/phase2.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|lottery-model|campaign-session|\.setItem\(/);
  assert.match(source,/window\.jianxNavigate\(route\)/);
  assert.match(source,/back:'lottery',card:'card',prizes:'prizes'/);
  assert.match(source,/window\.jianxReady\(\)/);
  assert.match(source,/type==='visibility'/);
  assert.match(source,/type==='activate'/);
  assert.match(source,/ArrowLeft','ArrowRight','Home','End/);
  const html=await readFile(new URL('../public/phase2.html',import.meta.url),'utf8');
  assert.match(html,/src="site-bridge.js"/);
  assert.match(html,/href="phase2.css"/);
  assert.doesNotMatch(html,/card-app.js|events\/app.js/);
});

test('preview typography stays readable and disabled controls have a distinct neutral appearance',async()=>{
  const css=await readFile(new URL('../public/phase2.css',import.meta.url),'utf8');
  const decoration=new Set(['.p2-header>div>span','.p2-eyebrow','.p2-prize-art>span','.p2-expert-pass>div>span']);
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,selector,body])=>({selector:selector.trim(),body}));
  for(const rule of rules){
    const size=rule.body.match(/font-size:([\d.]+)px/);
    if(size)assert.ok(Number(size[1])>=(decoration.has(rule.selector)?9:11),`${rule.selector} text is too small`);
  }
  const find=selector=>rules.find(rule=>rule.selector===selector)?.body;
  for(const selector of ['.p2-rules p','.p2-earning-list p','.p2-info-note'])assert.match(find(selector),/font-size:13px/);
  for(const selector of ['.p2-header-link','.p2-wallet-top button','.p2-section-heading button','.p2-tabs button'])assert.match(find(selector),/font-size:12px/);
  assert.match(find('.p2-draw-actions>button'),/background:#202435/);
  assert.match(find('.p2-draw-actions>button'),/color:#AEB6C9/);
  assert.match(find('.p2-draw-actions>button'),/border:1px solid #3B4259/);
  assert.match(find('.p2-header'),/grid-template-columns:64px minmax\(0,1fr\) 64px/);
  assert.match(find('.p2-primary'),/linear-gradient\(112deg,#5B68ED,#7753DD 58%,#A660D1\)/);
});
