import {START,END,PRIZES,ACTIVITY_CATEGORIES,active,balances,draw,leaderboard,isEligibleCategory} from './expert-event-model.js';
import {loadEvent,saveEvent,eventNow} from './expert-event-session.js';
import {machineMarkup,mountMachine,prizeArt} from './capsule-machine.js';
import {voucherMarkup} from './reward-ui.js';
import {celebrateGacha,outcomeTier} from './gacha-celebration.js';
import {comfortMarkup,mountComfort} from './gacha-comfort.js';

export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const eventCount=state=>state.orders.filter(o=>o.uid===state.uid&&o.at>=START&&o.at<END&&o.eligible!==false&&isEligibleCategory(o.category)).length;
export const icon=(name='arrow')=>{
 const paths={arrow:'m9 5 7 7-7 7',back:'m15 5-7 7 7 7',close:'m6 6 12 12M18 6 6 18',ticket:'M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5ZM9 8v2m0 4v2',crown:'m3 7 5 4 4-7 4 7 5-4-2 12H5L3 7Z',shield:'m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7l8-4Zm-4 9 3 3 5-6',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',gift:'M3 8h18v5H3V8Zm2 5v8h14v-8M12 8v13M12 8C5 8 4 2 8 3c3 0 4 5 4 5s1-5 4-5c4-1 3 5-4 5Z',photo:'M4 4h16v16H4V4Zm0 12 5-5 4 4 3-3 4 4M15 7h1',check:'m5 12 4 4L19 6'};
 return `<svg class="ev-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${paths[name]||paths.arrow}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};
export function progressGeometry(count){
 const current=Math.max(0,Math.floor(Number(count)||0)),end=Math.max(10,Math.ceil((current+2)/10)*10);
 return {current,end,next:(Math.floor(current/2)+1)*2,nextHigh:(Math.floor(current/10)+1)*10,
  nodeCount:end/2+1,ratio:current/end,steps:Array.from({length:end/2},(_,i)=>(i+1)*2)};
}
export const rewardArt=(pool='ordinary',className='')=>`<img class="ev-reward-art ${escapeHtml(className)}" src="assets/gacha/reward-${pool==='advanced'?'advanced':'ordinary'}-v6.png" alt="${pool==='advanced'?'高级香槟色抽奖券':'普通淡紫抽奖券'}" loading="lazy" decoding="async" draggable="false">`;
export function firstGuideMarkup(){
 return `<section class="ev-onboarding"><p class="ev-onboarding-lead">免费专鉴，攒券扭好礼</p>
 <div class="ev-onboarding-scene"><div class="ev-onboarding-machine">${machineMarkup({pool:'ordinary',compact:true})}</div>
 <div class="ev-onboarding-ticket eh-guide-ticket">${rewardArt('ordinary')}<span>今日赠送 <b>×1</b></span><small>今日有效</small></div></div>
 <button class="ev-primary" data-guide>免费扭一次 ${icon()}</button><button class="ev-text-button ev-full" data-later>稍后再用</button></section>`;
}
// The onboarding follows the consumed ticket, including a deferred draw from the center.
// It never follows the user's next arbitrary draw after that ticket has expired.
export function isFirstGuideBatch(batch,state){
 const guideIds=new Set((state.tickets||[]).filter(ticket=>ticket.firstGuide).map(ticket=>ticket.id));
 return (batch.ticketDebits||[]).some(debit=>debit.amount>0&&guideIds.has(debit.ticketId));
}
export function guideEarnMarkup(currentCount=0){
 const {current,next}=progressGeometry(currentCount);
 return `<section class="ev-guide-earn" aria-label="专鉴领抽奖券规则"><h3>免费专鉴，继续领抽奖券</h3>
 <div class="ev-guide-rewards"><div>${rewardArt('ordinary')}<span>每 <b>2</b> 单得普通券</span></div><div>${rewardArt('advanced')}<span>每 <b>10</b> 单得高级券</span><small>该节点仅发高级券</small></div></div>
 <p class="ev-guide-distance">再鉴 <b>${next-current}</b> 单，得${next%10===0?'高级':'普通'}抽奖券</p></section>`;
}
export function progressMarkup(state,{compact=false}={}){
 const {current:n,end,next,nextHigh,nodeCount,ratio,steps}=progressGeometry(eventCount(state));
 return `<section class="ev-progress ${compact?'is-compact':''}" aria-label="专鉴活动进度" data-current="${n}">
 <div class="ev-progress-heading"><span>我的专鉴进度</span><span>已完成 <b>${n}</b> 单</span></div>
 <div class="ev-milestone-scroll" tabindex="0" aria-label="左右滑动查看全部奖励里程碑"><div class="ev-milestone-track" style="--ev-node-count:${nodeCount};--ev-progress-ratio:${ratio}">
 <div class="ev-progress-rail" role="progressbar" aria-label="累计专鉴单数" aria-valuemin="0" aria-valuemax="${end}" aria-valuenow="${n}" aria-valuetext="已完成 ${n} 单，下一奖励在第 ${next} 单"><div class="ev-progress-fill" style="width:${ratio*100}%"></div><span class="ev-rail-shine"></span></div>
 <div class="ev-milestone-origin" aria-hidden="true"><span></span><b>出发</b></div>
 ${steps.map(step=>`<div class="ev-milestone ${step<=n?'is-done':''} ${step===next?'is-next':''} ${step%10===0?'is-premium':''}" data-step="${step}" aria-label="第${step}单，${step%10===0?'高级':'普通'}券${step<=n?'已达成':'未达成'}"><span class="ev-milestone-dot">${rewardArt(step%10===0?'advanced':'ordinary')}</span><b>${step} 单</b><small>${step%10===0?'高级券':'普通券'}</small></div>`).join('')}
 <div class="ev-current-marker" data-current-count="${n}" aria-label="当前累计第 ${n} 单"><span class="ev-current-pin"></span></div>
 </div></div><div class="ev-progress-note"><span>再鉴 <b>${next-n}</b> 单，得${next%10===0?'高级':'普通'}券</span><span>${next===nextHigh?'尊享奖池即将开启':`距高级券 ${nextHigh-n} 单`} ${icon('spark')}</span></div>
 </section>`;
}
export function focusProgress(root=document){
 requestAnimationFrame(()=>root.querySelectorAll('.ev-milestone-scroll').forEach(scroll=>{
  const marker=scroll.querySelector('.ev-current-marker');
  if(!marker)return;
  const rect=marker.getBoundingClientRect(),viewport=scroll.getBoundingClientRect();
  const position=rect.left-viewport.left+scroll.scrollLeft+rect.width/2;
  const left=Math.max(0,position-scroll.clientWidth*.45);
  if(scroll.scrollTo)scroll.scrollTo({left,behavior:'instant'});else scroll.scrollLeft=left;
 }));
}
export function goExpert(){
 if(window.openExpertSelection)window.openExpertSelection();
 else window.jianxNavigate?.('expert',{intent:'open-expert'});
}
let currentDialog=null;
export function closeEventDialog(){if(currentDialog?.open)currentDialog.close('programmatic');}
export function showEventDialog(title,body,{className='',onClose,celebration=null}={}){
 closeEventDialog();
 const previousFocus=document.activeElement;let stopCelebration=null;
 const dialog=document.createElement('dialog');dialog.className=`ev-dialog ${className}`;
 dialog.innerHTML=`<header class="ev-dialog-head"><span>${escapeHtml(title)}</span><button class="ev-icon-button" data-ev-close aria-label="关闭">${icon('close')}</button></header><div class="ev-dialog-body">${body}</div>`;
 dialog.setAttribute('aria-label',title);dialog.setAttribute('tabindex','-1');document.body.append(dialog);currentDialog=dialog;
 dialog.querySelector('[data-ev-close]').onclick=()=>dialog.close('dismiss');
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close('dismiss');}});
 const stopComfort=mountComfort(dialog);
 dialog.addEventListener('close',()=>{const reason=dialog.returnValue||'dismiss';stopCelebration?.();stopComfort();dialog.remove();if(currentDialog===dialog)currentDialog=null;if(reason==='dismiss'&&previousFocus?.isConnected)previousFocus.focus?.({preventScroll:true});onClose?.({reason});},{once:true});
 dialog.showModal();dialog.focus?.({preventScroll:true});focusProgress(dialog);if(celebration)stopCelebration=celebrateGacha(dialog,celebration);return dialog;
}
export function openRules({onReturn}={}){
 return showEventDialog('专鉴有礼 · 活动规则',`<div class="ev-rules">
 <p>活动时间：2026 年 10 月 27 日 00:00 至 11 月 11 日 00:00（北京时间）。</p>
 <h3>七大品类，专鉴有礼</h3><p>${ACTIVITY_CATEGORIES.map(category=>category.name).join('、')}参与。提交成功即累计 1 单，每 2 单得 1 张普通券；每 10 单得 1 张高级券，该节点不再发普通券。跨天累计，无次数上限。其他品类仍可免费专鉴，不计入本活动。</p>
 <h3>每天一次免费机会</h3><p>每日首次进入活动自动领取 1 张普通券，当天有效，未使用不顺延。鉴定获得的券有效至活动结束。优先使用即将到期的券。</p>
 <h3>普通与高级奖池</h3><p>普通池：实物 8%、鉴定券 72%、再接再厉 20%。高级池：实物 5%、鉴定券 75%、再接再厉 20%。同池可抽实物等概率；库存为零后不再抽出该奖品。</p>
 <p>本活动每人最多获得 1 份实物，普通与高级池合计计算，与卡牌活动独立。已中实物或奖池实物全部领完后，实物概率转为鉴定券。鉴定券有效至 2026 年 12 月 12 日 23:59:59。</p>
 <h3>单抽与五连抽</h3><p>选择一种券，每次使用 1 张或同种 5 张。不同券种、不同活动的券不能混用。结果自动保存，统一在「我的奖品」查看。</p>
 <h3>鉴真王者与避雷王者</h3><p>按活动期间七大品类的专家最终鉴真、鉴假订单数分别排名；同数按先达到者优先。活动结束后才出结果的订单不计入。两榜可同时获奖。</p><p>鉴真榜前三名：每人称号与 200 元现金红包。避雷榜前三名：每人称号与终身免费专鉴权益，不限品类与次数。活动结束时统一结算。</p>
 <p class="ev-demo-note">当前为交互演示。鉴定、奖励、榜单及库存为本机模拟，商品图为奖品示意。</p></div>`,{onClose:({reason})=>{if(reason==='dismiss')onReturn?.();}});
}
export function openProgress({reward=null}={}){
 const s=loadEvent(),premium=reward?.pool==='advanced';
 const d=showEventDialog(reward?'抽奖券到账':'专鉴进度',`
 <div class="ev-reward-hero ${premium?'is-premium':''} ${reward?'is-awarded':''}">
 ${reward?`<div class="ev-reward-emblem">${rewardArt(premium?'advanced':'ordinary')}</div>`:''}
 <h2>${reward?`${premium?'高级':'普通'}抽奖券 <em>+1</em>`:'提交成功'}</h2>
 </div>${progressMarkup(s)}
 <button class="ev-primary" data-progress-expert>去专鉴赢抽奖券 ${icon()}</button>
 <button class="ev-text-button ev-full" data-center>去抽奖中心 ${icon()}</button>
 <button class="ev-rank-teaser" data-rank><span class="ev-rank-small">${icon('crown')}</span><span><strong>王者榜</strong><small>前三名有礼</small></span>${icon()}</button>`,{className:`ev-progress-dialog ${premium?'ev-premium-dialog':''}`,celebration:reward?(premium?'advanced':'ordinary'):null});
 d.querySelector('[data-center]').onclick=()=>{d.close('navigate');window.jianxNavigate('lottery',{event:'expert',pool:premium?'advanced':'ordinary'});};
 d.querySelector('[data-progress-expert]').onclick=()=>{d.close('navigate');goExpert();};
 d.querySelector('[data-rank]').onclick=()=>{d.close();openLeaderboard();};
 return d;
}
export function openDraw({pool='ordinary',count=1,onChange,onReturn,random}={}){
 const s=loadEvent(),now=eventNow();
 const response=draw(s,{pool,count,requestId:crypto.randomUUID()},now,random);
 if(response.error){showEventDialog('暂时无法扭蛋',`<div class="ev-empty">${rewardArt(pool)}<h2>${escapeHtml(response.error)}</h2><button class="ev-primary" data-expert>去专鉴 ${icon()}</button></div>`,{onClose:({reason})=>{if(reason==='dismiss')onReturn?.();}}).querySelector('[data-expert]').onclick=()=>{closeEventDialog();goExpert();};return null;}
 const firstGuide=isFirstGuideBatch(response.batch,response.state);
 saveEvent(response.state);onChange?.(response);let controller=null,done=false,stopCelebration=null,stopComfort=null;
 const d=showEventDialog(pool==='advanced'?'高级扭蛋':'普通扭蛋',`<div class="ev-draw-stage">${machineMarkup({pool,compact:true})}<p>正在开启 ${count} 枚扭蛋</p><button class="ev-text-button" data-skip>跳过动画 ${icon()}</button></div>`,{className:'ev-draw-dialog',onClose:({reason})=>{controller?.destroy();stopCelebration?.();stopComfort?.();if(reason==='dismiss')onReturn?.();}});
 const reveal=()=>{if(done||!d.open)return;done=true;controller?.destroy();d.querySelector('.ev-dialog-body').innerHTML=resultMarkup(response.batch,{canReturn:Boolean(onReturn),firstGuide,currentCount:eventCount(response.state)});d.classList.add('ev-result-dialog');if(firstGuide)d.classList.add('ev-onboarding-result');const resultTitle=firstGuide?'双11专鉴有礼':'扭蛋结果';d.querySelector('.ev-dialog-head>span').textContent=resultTitle;d.setAttribute('aria-label',resultTitle);stopCelebration=celebrateGacha(d,outcomeTier(response.batch));stopComfort=mountComfort(d);
 d.querySelector('[data-result-prizes]')?.addEventListener('click',()=>{d.close('navigate');window.jianxNavigate('prizes',{event:'expert',pool:response.batch.pool});});
 d.querySelector('[data-result-expert]').onclick=()=>{d.close('navigate');goExpert();};
 d.querySelector('[data-result-again]')?.addEventListener('click',()=>{d.close('repeat');openDraw({pool,count,onChange,onReturn});});
 d.querySelector('[data-result-later]')?.addEventListener('click',()=>d.close('dismiss'));
 d.querySelector('[data-result-back]')?.addEventListener('click',()=>d.close('dismiss'));};
 controller=mountMachine(d.querySelector('.gm-machine')||d.querySelector('.ev-draw-stage'));
 controller.play({count,pool,onReveal:reveal});
 d.querySelector('[data-skip]').onclick=()=>{controller.skip();reveal();};
 return response.batch;
}
export function resultMarkup(batch,{canReturn=false,firstGuide=false,currentCount=0}={}){
 const tier=outcomeTier(batch),won=tier!=='none',many=batch.rewards.length===5;
 const vouchers=batch.rewards.filter(r=>r.type==='voucher');
 const other=batch.rewards.filter(r=>r.type!=='voucher');
 return `<section class="ev-result" data-result-tier="${tier}"><div class="ev-result-heading"><span class="ev-eyebrow">${batch.pool==='advanced'?'高级奖池':'普通奖池'} · ${many?'五连抽':'单次抽取'}</span><h2>${tier==='physical'?'恭喜，抽中实物好礼':tier==='voucher'?'获得专家线上鉴别券':'再接再厉'}</h2></div>
 ${!won?comfortMarkup(batch.rewards.length):''}
 ${won&&other.length?`<div class="ev-result-grid ${many?'is-five':''}">${other.map(r=>`<article class="ev-result-card ${r.type==='physical'?'is-physical':'is-empty'}">${prizeArt(r.type==='physical'?r.prizeId:'none')}<strong>${escapeHtml(r.type==='physical'?PRIZES.find(p=>p.id===r.prizeId)?.name:'再接再厉')}</strong></article>`).join('')}</div>`:''}
 ${vouchers.length?voucherMarkup(vouchers.length,vouchers[0].expiresAt,{title:'专家线上鉴别券',category:'双11扭蛋 · 专家服务',displayExpiresAt:vouchers[0].expiresAt-1,action:'result-voucher',readOnly:true}):''}
 ${won?'<p class="ev-result-saved">已存入「我的奖品」</p>':''}
 ${firstGuide?`${guideEarnMarkup(currentCount)}<div class="ev-result-actions"><button class="ev-primary" data-result-expert>去专鉴赢抽奖券 ${icon()}</button>${won?`<button class="ev-text-button" data-result-prizes>查看我的奖品 ${icon()}</button>`:''}<button class="ev-text-button" data-result-later>稍后再去</button></div>`:`<div class="ev-result-actions"><button class="${won?'ev-primary':'ev-text-button'}" data-result-prizes>查看我的奖品 ${icon()}</button><button class="${won?'ev-text-button':'ev-primary'}" data-result-expert>去专鉴 ${icon()}</button><button class="ev-secondary" data-result-again>再扭${many?'五次':'一次'}</button></div>${canReturn?'<button class="ev-text-button ev-full ev-result-back" data-result-back>返回活动</button>':''}`}</section>`;
}

export function activityHubMarkup(state,now,{pool='ordinary'}={}){
 const balance=balances(state,now),available=active(now),advanced=pool==='advanced';
 const needsTickets=available&&balance.ordinary+balance.advanced===0;
 const {current,next}=progressGeometry(eventCount(state)),nextPool=next%10===0?'advanced':'ordinary';
 const drawHint=count=>!available?(now<START?'活动尚未开始':'活动已结束'):balance[pool]<count?`还差 ${count-balance[pool]} 张${advanced?'高级':'普通'}券`:`使用 ${count} 张${count===5?'同种':advanced?'高级':'普通'}券`;
 return `<div class="ev-hub-top"><div class="ev-hub-tools"><button data-hub-rules>${icon('spark')}规则</button><button data-hub-rank>${icon('crown')}王者榜</button></div></div>
 <div class="ev-hub-pools" role="tablist" aria-label="选择扭蛋奖池">${['ordinary','advanced'].map(value=>`<button role="tab" data-hub-pool="${value}" aria-selected="${pool===value}">${rewardArt(value)}<span><strong>${value==='advanced'?'高级奖池':'普通奖池'}</strong><small>可用 <b>${balance[value]}</b> 张券</small></span><i>${pool===value?icon('check'):''}</i></button>`).join('')}</div>
 <div class="ev-hub-stage">${machineMarkup({pool,compact:true})}</div>
 ${needsTickets?`<div class="ev-hub-earn">
 <div class="ev-hub-earn-benefit">${rewardArt(nextPool)}<span>再鉴 <b>${next-current}</b> 单，得 1 张${nextPool==='advanced'?'高级':'普通'}抽奖券</span></div>
 <button class="ev-primary" data-hub-expert>去专鉴赢抽奖券 ${icon()}</button></div>`:`
 <div class="ev-hub-draw-controls"><button class="ev-secondary draw-state-button" data-hub-draw="1" ${!available||balance[pool]<1?'disabled':''}><strong>${pool==='ordinary'&&balance.daily?'免费扭一次':'扭一次'}</strong><small>${drawHint(1)}</small></button><button class="ev-primary draw-state-button ${advanced?'ev-gold-primary':''}" data-hub-draw="5" ${!available||balance[pool]<5?'disabled':''}><strong>五次一起扭</strong><small>${drawHint(5)}</small></button></div>
 <p class="ev-hub-expiry">${icon('clock')}${!available?(now<START?'活动尚未开始':'活动已结束，奖品与记录保留'):balance.daily&&pool==='ordinary'?'今日赠券当天有效，扭蛋时优先使用':balance[pool]<1?'当前奖池暂无可用券，去专鉴继续积累':'鉴定获得的抽奖券，活动结束时失效'}</p>`}
 ${progressMarkup(state)}
 <div class="ev-hub-footer"><button class="ev-text-button" data-hub-prizes>${icon('gift')}我的奖品</button>${needsTickets?'':`<button class="ev-text-button" data-hub-expert>去专鉴 ${icon()}</button>`}</div>`;
}

export function openActivityHub({onChange,pool='ordinary'}={}){
 let selected=pool==='advanced'?'advanced':'ordinary',controller=null,d=null;
 const reopen=()=>openActivityHub({onChange,pool:selected});
 const cleanup=()=>{controller?.destroy();controller=null;window.removeEventListener('expert-event-change',refresh);};
 const render=()=>{
  controller?.destroy();
  d.querySelector('.ev-dialog-body').innerHTML=activityHubMarkup(loadEvent(),eventNow(),{pool:selected});
  controller=mountMachine(d.querySelector('.gm-machine'));
  d.querySelectorAll('[data-hub-pool]').forEach(button=>button.onclick=()=>{selected=button.dataset.hubPool;render();});
  d.querySelectorAll('[data-hub-draw]').forEach(button=>button.onclick=()=>{
   const count=Number(button.dataset.hubDraw);if(button.disabled)return;
   d.close('draw');openDraw({pool:selected,count,onChange,onReturn:reopen});
  });
  d.querySelector('[data-hub-rules]').onclick=()=>{d.close('rules');openRules({onReturn:reopen});};
  d.querySelector('[data-hub-rank]').onclick=()=>{d.close('ranking');openLeaderboard('true',{onReturn:reopen});};
  d.querySelector('[data-hub-prizes]').onclick=()=>{d.close('navigate');window.jianxNavigate?.('prizes',{event:'expert',pool:selected});};
  d.querySelector('[data-hub-expert]').onclick=()=>{d.close('navigate');goExpert();};
  focusProgress(d);
 };
 const refresh=()=>{if(d?.open)render();};
 d=showEventDialog('双11扭蛋','',{className:'ev-hub-dialog',onClose:cleanup});
 render();window.addEventListener('expert-event-change',refresh);return d;
}

let demoRankOrders=null;
export function rankingState(state){
 if(state.demoRanking)return state;
 if(!demoRankOrders){
  demoRankOrders=[];const labels=['林','许','周','陈','苏','杨','王','宋','吴','程','叶','江'];
  for(let u=0;u<24;u++){const amount=68-u*2;for(let i=0;i<amount;i++)demoRankOrders.push({id:`rank-demo-${u}-${i}`,uid:`rank-${u}`,category:'美妆',eligible:true,at:START+1000+i*100,result:i%3===u%3?'false':'true',resultAt:START+(u+1)*60000+i*1000});}
  demoRankOrders.names=Array.from({length:24},(_,i)=>({uid:`rank-${i}`,username:`${labels[i%labels.length]}**${String(i+11).slice(-1)}`,phone:`138****${6000+i}`}));
 }
 // Fixture phone numbers are already masked; supplied profiles take precedence.
 const users=new Map([...demoRankOrders.names,{uid:state.uid,username:'我',phone:'139****2026'},...(state.users||[])].map(user=>[user.uid,user]));
 return {...state,orders:[...demoRankOrders,...state.orders],users:[...users.values()]};
}
export function maskedRankName(value){
 const text=String(value||'鉴友').trim();
 if(/^[^\s*]\*{2,}[^\s*]?$/u.test(text))return text;
 const chars=Array.from(text);
 return chars.length>1?`${chars[0]}**${chars.at(-1)}`:`${chars[0]||'鉴'}**`;
}
export function maskedRankPhone(value){
 if(!['string','number'].includes(typeof value))return '手机号未提供';
 const phone=String(value??'').trim().replace(/[\s()-]/g,'').replace(/^(?:\+86|0086)/,'');
 const match=phone.match(/^(1[3-9]\d)(?:\d{4}|\*{4})(\d{4})$/);
 return match?`${match[1]}****${match[2]}`:'手机号未提供';
}
export function leaderboardMarkup(state,kind='true'){
 const rows=leaderboard(state,kind),me=rows.find(row=>row.uid===state.uid),top=rows.slice(0,3);
 const users=new Map((state.users||[]).map(user=>[user.uid,user]));
 const name=row=>row.uid===state.uid?'我':maskedRankName(users.get(row.uid)?.username);
 const phone=row=>maskedRankPhone(users.get(row.uid)?.phone);
 const avatar=(row,className='')=>`<span class="ev-rank-avatar ${className}" data-tone="${row.rank%4}" aria-hidden="true"><span>${escapeHtml(Array.from(name(row))[0])}</span></span>`;
 return `<div class="ev-ranking-top"><button class="ev-rank-rules-button" data-rules>规则</button>
 <div class="ev-ranking-tabs" role="tablist" aria-label="选择排行榜">${['true','false'].map(value=>`<button role="tab" data-kind="${value}" aria-selected="${kind===value}"><span>${value==='true'?'鉴真王者':'避雷王者'}</span></button>`).join('')}</div>
 <div class="ev-rank-reward"><span>前三名每人</span><strong>${kind==='true'?'<b>200</b> 元红包':'终身免费专鉴'}</strong><span>＋专属称号</span></div></div>
 <div class="ev-ranking-scroll" tabindex="0" aria-label="排行榜名单">
 <div class="ev-podium" aria-label="前三名领奖台">
 ${[1,0,2].map(index=>{const row=top[index],rank=index+1;return `<article class="ev-podium-person place-${rank} ${row?'':'is-vacant'}" data-rank="${rank}" aria-label="第 ${rank} 名${row?`，${escapeHtml(name(row))}，${row.count} 单`:'，虚位以待'}">
 ${row?avatar(row,'ev-podium-avatar'):'<span class="ev-podium-avatar ev-vacant-avatar" aria-hidden="true">?</span>'}
 <span class="ev-podium-rank" aria-hidden="true">${String(rank).padStart(2,'0')}</span>
 <div class="ev-podium-info"><strong>${row?escapeHtml(name(row)):'虚位以待'}</strong>${row?`<span class="ev-podium-count"><b>${row.count}</b><small> 单</small></span>`:'<span class="ev-vacant-note">期待你的加入</span>'}</div></article>`;}).join('')}
 </div>
 <div class="ev-rank-table-head"><span>排名 / 用户</span><span>${kind==='true'?'鉴真':'鉴假'}单数</span></div>
 <div class="ev-rank-list">${rows.slice(3,100).map(row=>`<article class="ev-rank-row ${row.uid===state.uid?'is-me':''}" data-rank="${row.rank}"><b class="ev-rank-number">${String(row.rank).padStart(2,'0')}</b>${avatar(row)}<span class="ev-rank-user"><span class="ev-rank-username">${escapeHtml(name(row))}</span><span class="ev-rank-phone">${phone(row)}</span></span><strong>${row.count}<small> 单</small></strong></article>`).join('')}</div>
 ${rows.length<4?`<p class="ev-rank-empty">${rows.length?'更多席位，等你来争取':'完成专鉴，争取你的榜上席位'}</p>`:''}
 <p class="ev-rank-note">按专家最终结论计数 · 当前为演示数据</p></div>
 <aside class="ev-my-rank"><span class="ev-my-rank-position"><small>我的排名</small><b>${me?`第 ${me.rank} 名`:'暂未上榜'}</b></span><span class="ev-my-rank-score"><b>${me?.count||0}</b><small> 单${kind==='true'?'鉴真':'鉴假'}</small></span><button data-rank-expert>去专鉴 ${icon()}</button></aside>`;
}
export function openLeaderboard(initial='true',{onReturn}={}){
 let kind=initial==='false'?'false':'true';const d=showEventDialog('专鉴王者榜','',{className:'ev-ranking-dialog',onClose:({reason})=>{if(reason==='dismiss')onReturn?.();}});
 const render=()=>{
 d.querySelector('.ev-dialog-body').innerHTML=leaderboardMarkup(rankingState(loadEvent()),kind);
 d.querySelectorAll('[data-kind]').forEach(button=>{
  button.onclick=()=>{kind=button.dataset.kind;render();d.querySelector(`[data-kind="${kind}"]`).focus?.({preventScroll:true});};
  button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();kind=event.key==='Home'?'true':event.key==='End'?'false':kind==='true'?'false':'true';render();d.querySelector(`[data-kind="${kind}"]`).focus?.({preventScroll:true});}});
 });
 d.querySelector('[data-rank-expert]').onclick=()=>{d.close('navigate');goExpert();};
 d.querySelector('[data-rules]').onclick=()=>{d.close('rules');openRules({onReturn:()=>openLeaderboard(kind,{onReturn})});};
 };
 render();return d;
}
