import {START,active,dayKey,balances,claimDaily,submitOrder,completeOrder,isEligibleCategory} from './expert-event-model.js';
import {loadEvent,saveEvent,eventNow} from './expert-event-session.js';
import {machineMarkup,mountMachine,prizeArt} from './capsule-machine.js';
import {progressMarkup,rewardArt,firstGuideMarkup,focusProgress,openActivityHub,openDraw,openProgress,openLeaderboard,openRules,showEventDialog,closeEventDialog,eventCount,icon,escapeHtml as esc} from './expert-event-ui.js';
import {DEMO_SCENE_GROUPS,applyDemoScene} from './expert-event-demo.js';
import '../phase2-service-bridge.js';

const $=id=>document.getElementById(id);
let homeMachine=null,flow=null,reportId=null,product=null,submitting=false,aiTimer=null,lastScene=null;
const section=document.createElement('section');section.id='expertEvent';section.className='eh-event';
$('expertHome').append(section);

function renderHome(){
 const now=eventNow(),enabled=active(now);
 homeMachine?.destroy();
 section.innerHTML=`<div class="eh-campaign">
 <div class="eh-campaign-copy"><h2><span>专鉴有礼·</span><strong>替你的双11 <em>战利品兜底</em></strong></h2></div>
 <div class="eh-machine-stage">
 <button class="eh-rank-pill" data-eh="ranking"><span class="eh-rank-emblem" aria-hidden="true">${icon('crown')}</span><span>王者榜</span>${icon()}</button>
 <button class="eh-machine-display" data-eh="hub" aria-label="打开扭蛋机，选择抽奖券"><div class="eh-machine">${machineMarkup({pool:'advanced'})}</div></button>
 <button class="eh-enter-button" data-eh="hub"><span>${enabled?'去扭蛋':'查看活动'}</span>${icon()}</button>
 </div></div><div class="eh-footer"><button class="eh-rule-button" data-eh="rules">活动规则 ${icon()}</button>${enabled?'':`<span class="eh-event-status">${now<START?'10 月 27 日开启':'本期活动已结束'}</span>`}<button data-eh="demo">${icon('spark')}模拟场景</button></div>`;
 homeMachine=mountMachine(section.querySelector('.gm-machine'));
 section.querySelectorAll('[data-eh]').forEach(b=>b.onclick=()=>{
  const a=b.dataset.eh;if(a==='rules')openRules();if(a==='ranking')openLeaderboard();
  if(a==='hub')openActivityHub();if(a==='progress')openProgress();
  if(a==='expert')window.openExpertSelection();if(a==='center')window.jianxNavigate('lottery',{event:'expert'});if(a==='demo')openDemo();
 });
 if(window.jianxActive===false)homeMachine.destroy();
}
function enterEvent({scroll=false}={}){
 const r=claimDaily(loadEvent(),eventNow());if(r.awarded)saveEvent(r.state);else renderHome();
 if(scroll)requestAnimationFrame(()=>section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'}));
 const now=eventNow(),guide=r.state.tickets.find(ticket=>ticket.firstGuide&&ticket.remaining>0&&ticket.at<=now&&ticket.expiresAt>now);
 if(active(now)&&guide&&r.state.guideShownTicketId!==guide.id){
  saveEvent({...r.state,guideShownTicketId:guide.id});
  let machine=null,feedTimer=null,feeding=false;
  const d=showEventDialog('双11专鉴有礼',firstGuideMarkup(),{className:'ev-onboarding-dialog',onClose:()=>{machine?.destroy();clearTimeout(feedTimer);}});
  machine=mountMachine(d.querySelector('.gm-machine'));
  d.querySelector('[data-guide]').onclick=()=>{
   if(feeding)return;feeding=true;
   d.querySelector('.ev-onboarding').classList.add('is-feeding');
   d.querySelector('[data-guide]').disabled=true;d.querySelector('[data-later]').disabled=true;
   d.querySelector('[data-guide]').setAttribute('aria-busy','true');
   const begin=()=>{if(!d.open)return;d.close('draw');openDraw({pool:'ordinary',count:1});};
   if(matchMedia('(prefers-reduced-motion:reduce)').matches)begin();else feedTimer=setTimeout(begin,650);
  };
  d.querySelector('[data-later]').onclick=()=>d.close('dismiss');
 }
}
function eventHomeVisible(){
 return !document.hidden&&window.jianxActive!==false&&!$('expertHome').hidden&&!flow&&$('expertPickerRoot')?.hidden!==false;
}
function refreshVisibleEvent(){
 if(eventHomeVisible())enterEvent();
 else if(!document.hidden&&window.jianxActive!==false){renderHome();if(flow?.querySelector('.eh-convert-card'))renderAI();}
}
window.openExpertSelection=()=>{
 closeEventDialog();closeFlow();window.jianxSetTab?.('expert');window.expertPicker?.open();
};
window.onExpertSelected=selection=>openUpload(selection);
window.jianxShowBeautyDemo=()=>{
 clearTimeout(aiTimer);closeFlow();flow=makeFlow('AI 鉴别');
 flow.querySelector('.eh-flow-body').innerHTML=`<div class="eh-ai-loading"><div class="eh-loading-orbit">${icon('shield')}</div><h2>正在观察商品细节</h2><p>识别包装、工艺与印刷特征</p></div>`;
 aiTimer=setTimeout(()=>renderAI(),700);
};
function makeFlow(title){
 const el=document.createElement('section');el.className='eh-flow';el.setAttribute('aria-label',title);
 el.innerHTML=`<header class="eh-flow-nav"><button class="ev-icon-button" data-flow-back aria-label="返回">${icon('back')}</button><strong>${esc(title)}</strong><span>演示</span></header><div class="eh-flow-body"></div>`;
 for(const child of $('app').children)child.inert=true;
 $('app').append(el);el.querySelector('[data-flow-back]').onclick=()=>closeFlow();el.querySelector('[data-flow-back]').focus({preventScroll:true});return el;
}
function closeFlow(){clearTimeout(aiTimer);flow?.remove();flow=null;reportId=null;submitting=false;for(const child of $('app').children)child.inert=false;queueMicrotask(()=>{if(eventHomeVisible())enterEvent();});}
function renderAI(){
 if(!flow)return;
 product={category:'美妆',brand:'圣罗兰 YSL',style:'气垫粉底',name:'圣罗兰 · 气垫粉底'};
 const s=loadEvent(),eligible=active(eventNow())&&isEligibleCategory(product.category);
 flow.querySelector('.eh-flow-body').innerHTML=`<article class="eh-ai-report"><div class="eh-product-top"><span><small>YSL · SAINT LAURENT</small><h2>圣罗兰气垫粉底</h2><p>AI 鉴别报告</p></span>${prizeArt('ysl-cushion')}</div><div class="eh-ai-verdict"><span>${icon('shield')} 正品特征</span><b>75.3<small>%</small></b><p>AI 把握度 · 演示结果</p><div><i></i></div></div><p class="eh-ai-desc">当前图片的包装、标识与工艺呈现正品特征。进一步确认，建议交由专家结合更多细节综合鉴别。</p><div class="eh-ai-metrics"><span>图片完整度 <b>73.2%</b></span><span>已观察点位 <b>4 个</b></span></div></article>
 <article class="eh-convert-card"><div class="eh-convert-top"><h2>专家一对一鉴别</h2><span class="eh-free-badge">限时免费</span></div><p class="eh-convert-description">错一赔三•专家组研判•最快30分钟出结果</p>${eligible?progressMarkup(s,{compact:true}):''}<div class="eh-convert-actions"><button type="button" class="ev-secondary" data-ai-details>查看详情</button><button type="button" class="ev-primary" data-ai-expert>去专鉴</button></div></article>
 <p class="ev-demo-note">当前结果为流程演示，不构成真实鉴定结论。</p>`;
 flow.querySelector('[data-ai-expert]').onclick=()=>openUpload(product);
 focusProgress(flow);
}
function openUpload(selection={}){
 closeEventDialog();closeFlow();product={...selection,name:selection.name||[selection.brand,selection.style].filter(Boolean).join(' · ')||'待鉴定商品'};flow=makeFlow('图灵专鉴');
 const eligible=active(eventNow())&&isEligibleCategory(product.category),art=product.category==='美妆'?'ysl-cushion':/包袋/.test(product.category)?'coach-wallet':/手表/.test(product.category)?'coach-belt':/数码|3C/.test(product.category)?'razer-headphones':'ysl-cushion';
 flow.querySelector('.eh-flow-body').innerHTML=`<div class="eh-upload-notice">${icon('shield')}<span><strong>多角度细节，让判断更可靠</strong><small>按点位补充清晰实拍，交由专家综合鉴别</small></span><b>5 / 5</b></div>
 <div class="eh-selected-product"><div><small>${esc(product.category||'专家鉴定')}</small><h2>${esc(product.name)}</h2><p>专家一对一 · 在线鉴别</p></div>${prizeArt(art)}</div>
 <section class="eh-photo-card"><div class="eh-section-label"><strong>${icon('photo')} 鉴别点位</strong><span>5 个点位</span></div><p>照片为演示占位，已为你准备好所需点位</p><div class="eh-photo-grid">${['商品整体','品牌标识','工艺细节','底部信息','背面细节'].map((label,i)=>`<div class="eh-photo-item"><div style="--photo-angle:${i*12-20}deg">${prizeArt(art)}<i>${icon('check')}</i></div><span>${label}${i<2?'<em>必传</em>':''}</span></div>`).join('')}</div></section>
 <div class="eh-price-summary"><div>${icon('shield')}<span><strong>专家一对一鉴别</strong><small>全部品类免费专鉴</small></span></div><span><del>${selection.price?`¥${(selection.price/100).toFixed(2)}`:'¥4.99'}</del><b>¥0</b></span></div>
 ${eligible?'<div class="eh-order-benefit">本单参与专鉴有礼，提交成功即可累计进度</div>':''}
 <button class="ev-primary" data-submit>提交专家评估 ${icon('shield')}</button><p class="eh-agreement">提交即表示同意《图灵鉴X在线鉴别协议》</p>`;
 flow.querySelector('[data-submit]').onclick=()=>{
  if(submitting)return;submitting=true;const id=crypto.randomUUID();
  const r=submitOrder(loadEvent(),{id,category:product.category||'其他',product:product.name},eventNow());
  if(r.error){submitting=false;showEventDialog('提交未完成',`<p>${esc(r.error)}</p>`);return;}
  saveEvent(r.state);reportId=id;renderReport();submitting=false;if(r.order?.eligible)openProgress({reward:r.reward});
 };
}
function renderReport(){
 if(!flow||!reportId)return;
 const s=loadEvent(),order=s.orders.find(o=>o.id===reportId);if(!order)return;
 const resultLabel=order.result==='true'?'鉴真':order.result==='false'?'鉴假':order.result==='unknown'?'暂无法判断':'鉴别中';
 flow.querySelector('.eh-flow-nav strong').textContent='鉴别报告';
 flow.querySelector('.eh-flow-body').innerHTML=`<div class="eh-report-hero"><span class="ev-eyebrow">图灵专家鉴别报告</span><h1>${esc(product?.name||order.product)}</h1><p>${esc(order.category)} · 订单 ${esc(order.id.slice(-8).toUpperCase())}</p><span class="eh-report-status">${icon('shield')} ${order.result?'已完成':'专家已派单'}</span></div>
 <div class="eh-report-metrics"><span>服务方式<b>专家鉴别</b></span><span>鉴别状态<b>${resultLabel}</b></span><span>点位数量<b>5 个</b></span></div>
 <div class="eh-report-result"><div class="eh-section-label"><strong>图灵专家鉴别结果</strong><span>${order.result?'已完成':'已派单'}</span></div><div class="eh-result-shield ${order.result==='false'?'is-false':''}">${icon('shield')}</div><h2>${order.result?`专家结论：${resultLabel}`:'专家正在鉴别中'}</h2><p>${order.result?'当前为模拟结果，用于体验鉴别与榜单联动。':'评估完成后，你可以在此查看专家结论。'}</p></div>
 <details class="eh-demo-results"><summary>演示：生成专家结果</summary><p>仅用于体验报告与排行榜的联动</p><div>${[['true','鉴真'],['false','鉴假'],['unknown','无法判断']].map(([value,text])=>`<button data-result="${value}" ${order.result?'disabled':''}>${text}</button>`).join('')}</div></details>
 ${order.category==='卡牌'?`<details class="p2-service-payment"><summary>第二期演示：结算与发券</summary><p>免费提交不触发发券。此按钮仅模拟卡牌专鉴支付成功，不会实际扣款；同一订单只发放一次。</p><button data-p2-settle>模拟支付成功 · 领取抽奖券</button></details>`:''}`;
 flow.querySelector('[data-p2-settle]')?.addEventListener('click',event=>{
  if(typeof CustomEvent!=='function')return;
  window.dispatchEvent(new CustomEvent('jianx-card-expert-paid',{detail:{id:order.id,category:order.category,payment:'cash',success:true},cancelable:true}));
  event.currentTarget.disabled=true;event.currentTarget.textContent='已模拟结算 · 按活动规则发券';
 });
 flow.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{
  const r=completeOrder(loadEvent(),reportId,b.dataset.result,eventNow());saveEvent(r.state);renderReport();
  if(!r.error&&!order.result&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('jianx-card-expert-result',{detail:{id:order.id,category:order.category,result:b.dataset.result,success:true},cancelable:true}));
 });
}
function runDemoScene(id,options={}){
 closeEventDialog();closeFlow();lastScene={id,options:{...options}};
 const scene=applyDemoScene(id,options);
 window.jianxSetTab?.('expert');renderHome();
 if(scene.destination==='progress')openProgress({reward:scene.reward});
 else if(scene.destination==='draw')openDraw({pool:scene.pool,count:scene.count,random:scene.random});
 else if(scene.destination==='ranking')openLeaderboard(scene.rankingKind);
 else if(scene.destination==='upload')openUpload(scene.selection);
 else if(scene.destination==='lottery')window.jianxNavigate?.('lottery',{event:scene.event,pool:scene.pool,ticketStatus:scene.ticketStatus});
 else enterEvent();
}
function openDrawSetup(){
 const options=[['random','自然随机'],['physical','抽中实物'],['voucher','抽中鉴定券'],['none','再接再厉'],['mixed','五连混合结果']];
 const d=showEventDialog('配置抽奖演示',`<form class="eh-demo-form"><label>抽奖券种<select name="pool"><option value="ordinary">普通抽奖券</option><option value="advanced">高级抽奖券</option></select></label><label>扭蛋次数<select name="count"><option value="1">单次扭蛋</option><option value="5">五次一起扭</option></select></label><label>演示结果<select name="outcome">${options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label><p>会自动准备对应抽奖券。指定结果仅用于本次演示，重播时恢复同一场景。</p><button class="ev-primary" type="submit">开始演示 ${icon()}</button></form>`);
 const form=d.querySelector('form');form.querySelector('[name="outcome"]').onchange=event=>{if(event.target.value==='mixed')form.querySelector('[name="count"]').value='5';};
 form.onsubmit=event=>{event.preventDefault();const data=new FormData(form);const options={pool:data.get('pool'),count:Number(data.get('count')),outcome:data.get('outcome')};if(options.outcome==='mixed')options.count=5;runDemoScene('draw',options);};
}
function openDemo(){
 const d=showEventDialog('模拟场景',`<div class="eh-demo-options"><p>一键进入场景，直接演示进度、动画与结果。仅切换当前浏览器的演示数据。</p><div class="eh-demo-tools"><button data-replay ${lastScene?'':'disabled'}>重播当前场景</button><button data-reset>恢复初始状态</button></div>${DEMO_SCENE_GROUPS.map(group=>`<section class="eh-scene-group"><h3>${esc(group.label)}</h3><div>${group.scenes.map(scene=>`<button data-scene="${scene.id}"><strong>${esc(scene.label)}</strong><small>${esc(scene.description)}</small>${icon()}</button>`).join('')}</div></section>`).join('')}</div>`,{className:'eh-demo-dialog'});
 d.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>b.dataset.scene==='draw'?openDrawSetup():runDemoScene(b.dataset.scene));
 d.querySelector('[data-replay]').onclick=()=>{if(lastScene)runDemoScene(lastScene.id,lastScene.options);};
 d.querySelector('[data-reset]').onclick=()=>runDemoScene('first');
}
// Defer tab entry until the shell's intent handler has opened a picker or upload flow.
window.addEventListener('expert-tab-open',()=>queueMicrotask(()=>{if(eventHomeVisible())enterEvent();}));
window.addEventListener('expert-event-change',()=>{
 renderHome();if(flow?.querySelector('.eh-convert-card'))renderAI();if(reportId&&flow?.querySelector('.eh-report-hero'))renderReport();
});
window.addEventListener('jianx-shell',event=>{
 const m=event.detail;
 if(m.type==='visibility'&&!m.active){closeEventDialog();homeMachine?.destroy();}
 if(m.type==='activate'){
  if(m.route==='expert'){
   closeFlow();
   if(m.intent==='card-expert')openUpload({category:'卡牌',brand:'收藏卡',style:'专家鉴别',name:'收藏卡 · 专家鉴别'});
   else if(m.intent==='open-expert')window.openExpertSelection();
   else enterEvent({scroll:m.intent==='gacha'});
  }
  else if(m.route==='home')closeFlow();
 }
 if(m.type==='reset-chat')closeFlow();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)homeMachine?.destroy();else refreshVisibleEvent();});
let calendarState=`${dayKey(eventNow())}:${active(eventNow())}`;
setInterval(()=>{
 const next=`${dayKey(eventNow())}:${active(eventNow())}`;
 if(next!==calendarState){calendarState=next;refreshVisibleEvent();}
},30000);
renderHome();
if(window.parent===window&&new URLSearchParams(location.search).get('tab')==='expert')enterEvent();
