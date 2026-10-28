import * as model from './phase2-model.js';
import * as session from './phase2-session.js';
import {showPhase2Grant,closePhase2Grant} from './phase2-grant-dialog.js';

export const PHASE2=model.PHASE2;
export const activityState=model.activityState;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(value);
const expiry=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(value===model.END?value-1:value);
const arrow='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const back='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 5-7 7 7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ticket='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 8h22v5a3 3 0 0 0 0 6v5H5v-5a3 3 0 0 0 0-6V8Z" stroke="currentColor" stroke-width="1.3"/><path d="M21 9v3m0 3v2m0 3v3M10 12l6 8m-6-2 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const sparkle='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 3 3.3 9.7L29 16l-9.7 3.3L16 29l-3.3-9.7L3 16l9.7-3.3L16 3Z" stroke="currentColor" stroke-width="1.3"/><path d="m16 10 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="currentColor"/></svg>';
const emblem='<img src="assets/icons/crystal-reward.svg" class="p2-emblem" alt="" aria-hidden="true">';
const action=(label,key,style='p2-primary',disabled=false)=>`<button class="${style}" data-p2="${key}"${disabled?' disabled':''}>${label}</button>`;
const batchName=batch=>batch.pool==='welcome'?'新人五连抽':batch.count===5?'普通五连抽':'普通单抽';
const prizeFor=id=>PHASE2.prizes.find(prize=>prize.id===id);
const getReward=(state,id)=>state.draws.flatMap(batch=>batch.rewards).find(reward=>reward.id===id);
const voucherState=(voucher,now)=>voucher.used?'used':now>=voucher.expiresAt?'expired':'unused';
const rewardSummary=batch=>{const names=batch.rewards.filter(reward=>reward.type==='physical').map(reward=>prizeFor(reward.prizeId)?.name||'实物奖品'),vouchers=batch.rewards.filter(reward=>reward.type==='voucher').length;return [...names,...(vouchers?[`专家鉴定券 ×${vouchers}`]:[])].join(' · ');};

export const DEMO_ADDRESS=Object.freeze({name:'演示收货人',phone:'13800000000',region:'演示省 演示市 演示区',detail:'演示路 1 号（测试数据，不配送）'});

export function fillDemoAddress(form) {
  for(const [key,value] of Object.entries(DEMO_ADDRESS)){
    const input=form.querySelector(`[name="${key}"]`);if(input&&!input.disabled){input.value=value;input.setAttribute('aria-invalid','false');}
    const error=form.querySelector(`[data-error-for="${key}"]`);if(error)error.textContent='';
  }
  const summary=form.querySelector('#p2-address-error');if(summary)summary.textContent='';
}

export function showStatusMessage(message,{dialog,toast,createElement}) {
  let output=toast;
  if(dialog?.open){
    output=dialog.querySelector('.p2-dialog-notice');
    if(!output){output=createElement('div');output.className='p2-dialog-notice';output.setAttribute('role','status');output.setAttribute('aria-live','polite');dialog.append(output);}
    toast.hidden=true;
  }
  output.textContent=message;output.hidden=false;
  if(dialog?.open)output.scrollIntoView({block:'nearest',behavior:'instant'});
  return output;
}

export function emptyMarkup(state='unused') {
  const copy={unused:['暂无未使用抽奖券','去鉴卡牌、分享或邀请新人，把好运攒起来。'],used:['暂无使用记录','每次抽奖消耗的券数与结果，会一起记录在这里。'],expired:['暂无已过期抽奖券','已过期的抽奖券会保留记录，方便随时查看。'],prizes:['还没有中奖记录','使用抽奖券后，你的每一份好礼都会保存在这里。']};
  const [title,description]=copy[state]||copy.unused;
  return `<div class="p2-empty"><span class="p2-empty-art">${ticket}</span><h3>${title}</h3><p>${description}</p></div>`;
}

export function ticketRecordsMarkup(state,now,selected='unused') {
  if(selected==='used')return state.draws.length?`<div class="p2-record-list">${state.draws.map(batch=>`<button class="p2-use-record" data-p2="result:${esc(batch.id)}"><div><strong>${batchName(batch)}</strong><b>−${batch.count} 张</b></div><p>${date(batch.at)} · ${batch.pool==='welcome'?'新人专属券':'普通抽奖券'}</p><span>${esc(rewardSummary(batch))}${arrow}</span></button>`).join('')}</div>`:emptyMarkup('used');
  const rows=model.ticketRows(state,selected,now);
  return rows.length?`<div class="p2-ticket-list">${rows.map(row=>`<article class="p2-ticket ${selected==='expired'?'is-expired':''}"><div class="p2-ticket-strip">${row.pool==='welcome'?'WELCOME':'LUCKY'}</div><div class="p2-ticket-copy"><h3>${row.pool==='welcome'?'新人专属抽奖券':'卡牌专属抽奖券'}</h3><p>${esc(row.source)} · ${date(row.at)}</p><small>${selected==='expired'?'已于':'有效至'} ${expiry(row.expiresAt)}${selected==='expired'?' 过期':''}</small></div><div class="p2-ticket-action"><b>${row.amount}<small> 张</small></b>${action(selected==='expired'?'已过期':row.pool==='welcome'?'五连抽':'去抽奖',row.pool==='welcome'?'draw-welcome':'draw-one','p2-pill',selected==='expired'||!model.active(now))}</div></article>`).join('')}</div>`:emptyMarkup(selected);
}

export function ticketPageMarkup(state,now,selected='unused') {
  const balance=model.available(state,now),counts=model.ticketCounts(state,now),ended=activityState(now)==='ended',upcoming=activityState(now)==='upcoming';
  const earned=state.ledger.filter(row=>row.amount>0&&row.pool==='ordinary').reduce((sum,row)=>sum+row.amount,0),used=state.ledger.filter(row=>row.amount<0&&row.pool==='ordinary').reduce((sum,row)=>sum-row.amount,0);
  return `<section class="p2-hero" aria-label="${PHASE2.name}"><div class="p2-hero-art" aria-hidden="true"><i></i><img src="assets/lottery-card-back.png" alt=""><img src="assets/lottery-card-back.png" alt=""></div><div class="p2-hero-copy"><span class="p2-eyebrow">ONE PIECE · COLLECTION 02</span><p class="p2-kicker">海贼王 · 收藏新篇</p><h2>海贼 EB05 上新<span>免费抽，开启新惊喜</span></h2><p class="p2-period">10.30 00:00 — 11.05 23:59</p><span class="p2-status">${ended?'活动已结束':upcoming?'即将开始':'活动进行中'}</span></div></section>
  <section class="p2-wallet" aria-label="第二期普通抽奖券"><div class="p2-wallet-top"><span>${ticket}普通抽奖券</span><button data-p2="rules">使用规则 <b>ⓘ</b></button></div><div class="p2-balance"><div><strong>${balance.ordinary}</strong><span>张可用</span></div><p>累计获得 ${earned}<br><span>累计使用 ${used}</span></p></div><p class="p2-wallet-expiry">本期专属 · ${expiry(model.END)} 到期</p><div class="p2-draw-actions">${action('抽一次<small>使用 1 张普通券</small>','draw-one','p2-draw-single',balance.ordinary<1)}${action('五连抽<small>使用 5 张普通券</small>','draw-five','p2-draw-five',balance.ordinary<5)}</div>${ended||upcoming?`<p class="p2-wallet-condition">${ended?'活动已结束，历史抽奖与奖品仍可查看。':'活动尚未开始，开始后即可使用抽奖券。'}</p>`:''}</section>
  ${state.welcome?`<section class="p2-welcome-wallet"><span>${emblem}</span><div><h3>新人专属礼遇 <b>${balance.welcome} 张</b></h3><p>${state.welcome.used?'新人五连抽已使用':now>=state.welcome.expiresAt?'新人券已过期':`有效至 ${expiry(state.welcome.expiresAt)}`}</p><small>独立券池 · 5 张需一次抽完</small></div>${action(state.welcome.used?'已使用':now>=state.welcome.expiresAt?'已过期':'五连抽','draw-welcome','p2-pill',balance.welcome!==5)}</section>`:''}
  <nav class="p2-utilities" aria-label="活动信息"><button data-p2="earning"><span class="p2-utility-icon">${ticket}</span><span><strong>获券方式</strong><small>5 种方式，积攒好运</small></span>${arrow}</button><button data-p2="pool"><span class="p2-utility-icon">${sparkle}</span><span><strong>查看奖池</strong><small>好礼随鉴定进度开放</small></span>${arrow}</button></nav>
  <section class="p2-inventory"><div class="p2-section-heading"><h2>我的抽奖券</h2><button data-p2="history">获得记录 ${arrow}</button></div><div class="p2-tabs" role="tablist" aria-label="抽奖券状态">${[['unused','未使用'],['used','已使用'],['expired','已过期']].map(([key,label])=>`<button id="p2-tab-${key}" data-state="${key}" role="tab" aria-selected="${key===selected}" aria-controls="p2-ticket-panel" tabindex="${key===selected?0:-1}">${label}<b>${counts[key]}</b></button>`).join('')}</div><div id="p2-ticket-panel" role="tabpanel" aria-labelledby="p2-tab-${selected}" tabindex="0">${ticketRecordsMarkup(state,now,selected)}</div></section>
  <button class="p2-appraisal-link" data-p2="card"><span>去鉴卡牌<span>继续探索你的收藏</span></span>${arrow}</button>`;
}

export function voucherMarkup(voucher,now) {
  const status=voucherState(voucher,now),labels={unused:'去使用',used:'已使用',expired:'已过期'};
  return `<article class="p2-expert-pass ${status==='expired'?'is-expired':''}"><span class="p2-pass-icon">${emblem}</span><div><span>EXPERT PASS</span><h3>专家线上鉴定券</h3><p>${status==='used'?`使用于 ${date(voucher.usedAt)}`:`有效至 ${expiry(voucher.expiresAt)}`}</p></div><div class="p2-pass-action"><b>×1</b>${action(labels[status],`voucher:${esc(voucher.id)}`,'p2-pill',status!=='unused')}</div></article>`;
}

export function physicalMarkup(state,reward,now) {
  const prize=prizeFor(reward.prizeId),status=model.addressStatus(state,reward.id,now),address=state.addresses[reward.id];
  return `<article class="p2-physical"><div class="p2-physical-top"><div class="p2-physical-art" aria-hidden="true"><small>ONE PIECE</small><b>${prize.mark}</b></div><div><span>实物好礼</span><h3>${esc(prize.name)}</h3><p>${esc(prize.spec)} × 1</p></div><span class="p2-claim-status">${{pending:'待填写地址',saved:'已填写地址',locked:'待寄出',forfeited:'已放弃领取'}[status]}</span></div>${address?`<div class="p2-saved-address"><strong>${esc(address.name)} · ${esc(address.phone.slice(0,3)+'****'+address.phone.slice(-4))}</strong><p>${esc(address.region)} ${esc(address.detail)}</p></div>`:''}${status==='forfeited'?'<p class="p2-address-warning">活动结束前未填写收货地址，已视为放弃领取。</p>':`${action(status==='locked'?'活动已结束，地址已锁定':address?'修改收货信息':'填写收货信息',`address:${esc(reward.id)}`,'p2-secondary',status==='locked')}<p class="p2-modal-footnote">活动结束后 7 个工作日内寄出</p>`}</article>`;
}

export function prizePageMarkup(state,now,selected='unused') {
  const physical=state.draws.flatMap(batch=>batch.rewards).filter(reward=>reward.type==='physical'),counts={unused:0,used:0,expired:0};state.vouchers.forEach(voucher=>counts[voucherState(voucher,now)]++);
  return `<div class="p2-prize-overview"><div><b>${state.draws.reduce((sum,batch)=>sum+batch.count,0)}</b><span>累计获得奖品</span></div><div><b>${physical.length}</b><span>实物奖品</span></div><div><b>${state.vouchers.length}</b><span>专家鉴定券</span></div></div><p class="p2-prize-context">海贼 EB05 活动专属奖品</p>${physical.length?`<section><div class="p2-section-heading"><h2>实物奖品</h2></div>${physical.map(reward=>physicalMarkup(state,reward,now)).join('')}</section>`:''}<section><div class="p2-section-heading"><h2>专家鉴定券</h2><button data-p2="draw-history">抽奖记录 ${arrow}</button></div><div class="p2-tabs" role="tablist" aria-label="鉴定券状态">${[['unused','未使用'],['used','已使用'],['expired','已过期']].map(([key,label])=>`<button id="p2-voucher-${key}" data-voucher-state="${key}" role="tab" aria-selected="${key===selected}" aria-controls="p2-voucher-panel" tabindex="${key===selected?0:-1}">${label}<b>${counts[key]}</b></button>`).join('')}</div><div id="p2-voucher-panel" role="tabpanel" aria-labelledby="p2-voucher-${selected}" tabindex="0">${state.vouchers.filter(voucher=>voucherState(voucher,now)===selected).map(voucher=>voucherMarkup(voucher,now)).join('')||`<div class="p2-empty"><span class="p2-empty-art">${sparkle}</span><h3>暂无${{unused:'未使用',used:'已使用',expired:'已过期'}[selected]}鉴定券</h3><p>抽中的专家鉴定券有效期为 7 天。</p></div>`}</div></section>${action('查看我的抽奖券','tickets','p2-secondary')}`;
}

export function pageMarkup(state=model.fresh(),now=session.DEFAULT_TIME,{view='tickets',ticketState='unused',voucherFilter='unused'}={}) {
  return `<header class="p2-header"><button class="p2-icon-button" data-p2="back" aria-label="返回活动列表">${back}</button><div><span>REWARDS CENTER</span><h1>抽奖中心</h1></div><button class="p2-header-link" data-p2="settings">演示设置</button></header><div class="p2-content"><div class="p2-view-tabs" role="tablist" aria-label="第二期活动页面"><button id="p2-view-tickets" role="tab" aria-selected="${view==='tickets'}" aria-controls="p2-main-view" tabindex="${view==='tickets'?0:-1}" data-p2="tickets">抽奖券</button><button id="p2-view-prizes" role="tab" aria-selected="${view==='prizes'}" aria-controls="p2-main-view" tabindex="${view==='prizes'?0:-1}" data-p2="prizes">我的奖品</button></div><p class="p2-demo-clock">前端演示 · ${date(now)} <span>海贼 EB05 活动</span></p><section id="p2-main-view" role="tabpanel" aria-labelledby="p2-view-${view}">${view==='prizes'?prizePageMarkup(state,now,voucherFilter):ticketPageMarkup(state,now,ticketState)}</section><p class="p2-footer">图灵鉴 X · 让每一份收藏被认真对待</p></div>`;
}

export function earningMarkup() {
  return `<p class="p2-modal-intro">从每一次鉴定开始，让收藏多一份惊喜。</p><div class="p2-earning-list">${PHASE2.earning.map((item,index)=>`<article><span class="p2-number">0${index+1}</span><div><h3>${item.name}</h3><p>${item.detail}</p><small>${item.inDailyCap?'计入每日鉴定获券额度':'不占每日鉴定获券额度'}</small></div><b>+${item.amount}<small>张</small></b></article>`).join('')}</div><div class="p2-info-note">每日通过 AI 与专家鉴定合计最多获得 <strong>10 张</strong>，次日凌晨重置。达到上限后仍可继续鉴定。</div><div class="p2-stacked-actions">${action(`去鉴卡牌 ${arrow}`,'card')}${action('转发小程序，邀请新人','invite','p2-secondary')}</div>`;
}

export function poolMarkup(state=model.fresh(),now=session.DEFAULT_TIME) {
  return `<div class="p2-probabilities"><div><strong>8<small>%</small></strong><span>实物奖品</span></div><i></i><div><strong>92<small>%</small></strong><span>专家鉴定券</span></div><p>普通单抽 / 五连抽 · 基础概率</p></div><p class="p2-pool-progress">今日卡牌鉴定出结果 <b>${model.dailyResultCount(state,now)}</b> 单<span>AI 与人工结果合计</span></p><div class="p2-prize-grid">${PHASE2.prizes.map((prize,index)=>{const status=model.prizeStatus(state,prize.id,now),label=status.soldOut?'已领完':status.open?'已开放':`待解锁 · ${prize.threshold} 单`;return `<article class="p2-prize p2-prize-${index}"><div class="p2-prize-art" aria-hidden="true"><span>${prize.category}</span><b>${prize.mark}</b><i>✦</i></div><div class="p2-prize-copy"><span class="p2-prize-quantity">余 ${status.remaining} 份</span><h3>${prize.name}</h3><p>${prize.spec}</p><small class="p2-stock-status ${status.open&&!status.soldOut?'is-open':''}">${label}</small><div class="p2-prize-weight">实物命中权重 <b>${prize.weight}%</b></div></div></article>`;}).join('')}</div><div class="p2-expert-pass"><span class="p2-pass-icon">${emblem}</span><div><span>EXPERT PASS</span><h3>专家线上鉴定券</h3><p>每张有效期 7 天</p></div><b>×1</b></div><p class="p2-modal-footnote">实物按固定权重抽取。命中未开放或已领完的奖品时，获得专家鉴定券；其余实物权重不重新分配。海贼 EB05（1 包）全程开放。</p>`;
}

export function rulesMarkup() {
  return `<div class="p2-rules"><p class="p2-modal-intro">海贼王 · 海贼 EB05 上新 免费抽活动</p><h3>01 · 活动时间</h3><p>2026 年 10 月 30 日 00:00 至 11 月 5 日 23:59，所有用户均可参与。</p><h3>02 · 认识你的抽奖券</h3><p>活动期间新注册用户首次进入卡牌鉴定二级页面，可获 5 张新人专属券。新人券到账 24 小时有效，最迟活动结束失效，需一次性五连抽，不可拆分或与普通券混用。</p><p>普通券可合并积攒，支持单抽与五连抽，活动结束失效。余额不足 5 张时不可五连抽。</p><h3>03 · 获券与分享</h3><p>AI 卡牌鉴定成功出结果、卡牌类专家鉴定支付或用券支付成功，各送 1 张普通券；每日合计最多 10 张。人工鉴定出结果计入奖池开放进度，不再次发券。</p><p>当日鉴定获券满 10 张，在当次弹窗转发小程序可额外获 5 张，每日一次；关闭、离开或刷新后，当天不可补领。转发小程序邀请新用户完成注册，每位新用户奖励邀请人 5 张。仅转发本身不获得邀请奖励。新人、满额分享与邀请注册奖励不占每日鉴定额度。</p><h3>04 · 奖池与概率</h3><table><thead><tr><th>抽奖类型</th><th>实物</th><th>鉴定券</th></tr></thead><tbody><tr><td>新人五连抽</td><td>1%</td><td>99%</td></tr><tr><td>普通单抽 / 五连抽</td><td>8%</td><td>92%</td></tr></tbody></table><p>实物命中权重：乔巴杂志 20%、海贼精选套装 15%、EB05 单包 50%、EB05 整盒 15%。每日卡牌 AI 与人工鉴定出结果合计达到 70 单开放乔巴杂志，达到 100 单开放精选套装与 EB05 整盒，EB05 单包全程开放。</p><p>命中未开放或已领完的实物时转为专家鉴定券，其他实物权重不重新分配。每日开放进度于次日重置，活动奖品库存持续扣减。</p><h3>05 · 奖品领取</h3><p>专家鉴定券中奖后有效期 7 天，未到期券不随活动结束失效。实物奖品在活动结束后 7 个工作日内寄出。请在活动结束前填写收货地址，逾期未填写视为放弃领取；活动结束后地址不可新增或修改。</p></div>`;
}

export function historyMarkup(state) {
  const rows=state.ledger.filter(row=>row.amount>0);
  return rows.length?`<div class="p2-history">${rows.map(row=>`<article><span>${ticket}</span><div><h3>${esc(row.source)}</h3><p>${date(row.at)} · ${row.pool==='welcome'?'新人专属券':'普通抽奖券'}</p><small>有效至 ${expiry(row.expiresAt)}</small></div><b>+${row.amount}</b></article>`).join('')}</div>`:'<div class="p2-empty"><h3>还没有获得抽奖券</h3><p>每一笔获券记录都会保存在这里。</p></div>';
}

export function drawMarkup(pool,count,batch=null) {
  const revealed=Boolean(batch),title=count===5?'五重惊喜，全部收下':'让这一刻，遇见好礼';
  const cards=Array.from({length:count},(_,index)=>{const reward=batch?.rewards[index],prize=reward?.type==='physical'?prizeFor(reward.prizeId):null;return `<span class="p2-flip-card ${prize?'is-physical':''}"><span class="p2-card-inner"><span class="p2-card-back"><img src="assets/lottery-card-back.png" alt=""></span><span class="p2-card-front">${reward?`<span class="p2-card-kind">${prize?'收藏好礼':'专属礼遇'}</span>${prize?`<b class="p2-card-mark">${prize.mark}</b>`:emblem}<strong>${prize?esc(prize.name):'专家线上<br>鉴定券'}</strong><small>${prize?esc(prize.spec):'1 张 · 有效期 7 天'}</small>`:''}</span></span></span>`;}).join('');
  return `<section class="p2-draw-experience" data-count="${count}" data-revealed="${revealed}"><span class="p2-draw-eyebrow">${revealed?'A GIFT FOR YOUR COLLECTION':'YOUR NEXT MOMENT OF LUCK'}</span><h3>${title}</h3><p>${revealed?`恭喜，${count} 份好礼已全部揭晓`:'轻触卡牌，好运为你展开'}</p>${revealed?`<div class="p2-flip-grid" aria-label="本次 ${count} 份抽奖结果">${cards}</div>`:`<button class="p2-flip-grid p2-reveal-trigger" data-p2="reveal" aria-label="${count===5?'一键同时翻开五张卡牌':'翻开幸运卡牌'}">${cards}</button>`}<p class="p2-draw-cost">${revealed?`已使用 ${count} 张${pool==='welcome'?'新人专属券':'普通抽奖券'}`:`本次使用 ${count} 张${pool==='welcome'?'新人专属券':'普通抽奖券'} · 每次都有好礼`}</p>${revealed?`${action(`查看奖品详情 ${arrow}`,`result:${esc(batch.id)}`)}${action('前往我的奖品','prizes','p2-text-button')}`:'<p class="p2-draw-hint">点击卡牌后开始抽取；未点击前离开不消耗抽奖券。</p>'}</section>`;
}

export function resultMarkup(state,batch,now) {
  return `<div class="p2-result-heading"><span>收藏好礼，已为你留存</span><h3>${batch.count===5?'五重惊喜，尽数收入囊中':'你的热爱，又添一份惊喜'}</h3><p>${date(batch.at)} · ${batchName(batch)} · 使用 ${batch.count} 张券</p></div><div class="p2-result-rewards">${batch.rewards.map(reward=>reward.type==='physical'?physicalMarkup(state,reward,now):voucherMarkup(state.vouchers.find(voucher=>voucher.id===reward.id)||reward,now)).join('')}</div><div class="p2-stacked-actions">${action('查看我的奖品','prizes')}${action('收下好运','close','p2-secondary')}</div>`;
}

export function addressMarkup(state,rewardId,now) {
  const status=model.addressStatus(state,rewardId,now),address=state.addresses[rewardId]||{},locked=['locked','forfeited','missing'].includes(status);
  return `<form id="p2-address-form" data-reward-id="${esc(rewardId)}"><div class="p2-address-demo-note"><strong>仅前端演示，请勿填写真实信息</strong><p>仅本机保存，不用于配送。</p><button type="button" class="p2-secondary" data-p2="fill-demo-address"${locked?' disabled':''}>填入演示地址</button></div><p class="p2-modal-intro">活动规则：请在活动结束前填写，实物好礼将于活动结束后 7 个工作日内寄出。</p>${[['name','收货人','请输入收货人姓名','text'],['phone','手机号码','请输入手机号码','tel'],['region','所在地区','省 / 市 / 区','text'],['detail','详细地址','街道、门牌号等','text']].map(([key,label,placeholder,type])=>`<label class="p2-field">${label}<input name="${key}" type="${type}" autocomplete="off" placeholder="${placeholder}" value="${esc(address[key])}"${key==='phone'?' inputmode="tel" maxlength="11"':''}${locked?' disabled':''} aria-describedby="p2-error-${key}" required><span id="p2-error-${key}" class="p2-field-error" data-error-for="${key}"></span></label>`).join('')}<p id="p2-address-error" class="p2-form-error" role="alert">${locked?'活动已结束，收货信息不可新增或修改。':''}</p><button class="p2-primary" type="submit"${locked?' disabled':''}>保存收货信息</button></form>`;
}

export function settingsMarkup(state,now) {
  const scenarios=[['new','新用户 · 去鉴卡领 5 张'],['ordinary','普通券 5 张'],['69','今日结果 69 单'],['70','今日结果 70 单'],['99','今日结果 99 单'],['100','今日结果 100 单'],['soldout','乔巴杂志已领完'],['next-day','次日 · 进度重置'],['expired','新人券已过期'],['ten','当日鉴定获券满 10 张'],['won','已中实物 · 填地址'],['ended','活动已结束'],['before','活动未开始']];
  return `<p class="p2-modal-intro">仅改变本期前端演示，不影响其他活动。切换场景会替换本期演示记录。</p><div class="p2-settings-summary"><span>当前演示时间</span><strong>${expiry(now)}</strong><p>当日鉴定获券 ${model.dailyCount(state,now)} / 10 张 · 奖池进度 ${model.dailyResultCount(state,now)} 单</p></div><div class="p2-scenario-grid">${scenarios.map(([key,label])=>action(label,`scenario:${key}`,'p2-secondary')).join('')}</div><h3 class="p2-settings-subtitle">在当前场景继续演示</h3><div class="p2-scenario-grid">${action('AI 卡牌出结果 +1','demo-ai','p2-secondary')}${action('专家卡牌支付成功','demo-payment','p2-secondary')}${action('人工卡牌出结果 +1','demo-result','p2-secondary')}${action('模拟使用 1 张鉴定券','demo-voucher','p2-secondary')}</div><p class="p2-modal-footnote">专家支付或用券成功获券，人工出结果只累计奖池开放进度。以上均为本机模拟。</p>`;
}

export function dialogContent(kind,state=model.fresh(),now=session.DEFAULT_TIME) {
  const entries={earning:['把好运攒起来',()=>earningMarkup()],pool:['本期收藏好礼',()=>poolMarkup(state,now)],history:['获得记录',()=>historyMarkup(state)],'draw-history':['抽奖记录',()=>ticketRecordsMarkup(state,now,'used')],rules:['活动规则',()=>rulesMarkup()],settings:['演示设置',()=>settingsMarkup(state,now)]};
  const [title,render]=entries[kind]||entries.rules;return {title,content:render()};
}

// The transaction is independent of animation: entering and leaving never spends a ticket.
export function createDrawTransaction({read,save,now,rng=Math.random}) {
  let current=null,locked=false;
  return {
    prepare(pool,count){current={pool,count};locked=false;return current;},
    reveal(){if(!current||locked)return null;locked=true;const outcome=model.draw(read(),current.pool,current.count,now(),rng);if(outcome.error){locked=false;return outcome;}save(outcome.state);return outcome;},
    cancel(){current=null;locked=false;},
    get pending(){return current;},
  };
}

// Keep presentation synchronous: no deferred module load can reopen a hidden frame.
export function createGrantPresenter({read,save,now,close,present,pageWindow,pageDocument}) {
  return (outcome,source,pool='ordinary')=>{
    close();
    save(outcome.state);
    // Saving notifies other frames synchronously, so check visibility afterwards.
    if(pageWindow.jianxActive===false||pageDocument.hidden){
      if(outcome.sharePrompt)save(model.share(read(),now(),'dismiss').state);
      return false;
    }
    present(outcome,{source,pool});
    return true;
  };
}

export function drawBlockReason(state,pool,count,now) {
  if(!model.active(now))return '当前不在活动期间';
  return model.available(state,now)[pool]<count?'可用抽奖券不足或已过期':null;
}

if(typeof document!=='undefined') {
  const root=document.getElementById('phase2-page'),dialog=document.getElementById('phase2-dialog'),toast=document.getElementById('phase2-toast');
  let state=session.loadPhase2(),view=location.hash.includes('prizes')?'prizes':'tickets',ticketState='unused',voucherFilter='unused',opener=null,dialogKind='',inviteForwarded=false,toastTimer;
  const now=()=>session.phase2Now();
  const render=()=>{state=session.loadPhase2();root.innerHTML=pageMarkup(state,now(),{view,ticketState,voucherFilter});};
  const notify=message=>{const output=showStatusMessage(message,{dialog:document.querySelector('dialog[open]'),toast,createElement:tag=>document.createElement(tag)});clearTimeout(toastTimer);toastTimer=setTimeout(()=>output.hidden=true,4200);};
  const transaction=createDrawTransaction({read:()=>session.loadPhase2(),save:session.savePhase2,now});
  const close=()=>{transaction.cancel();inviteForwarded=false;closePhase2Grant();if(dialog.open)dialog.close();};
  const show=(title,content,kind='info')=>{if(!dialog.open)opener=document.activeElement;dialogKind=kind;dialog.classList.toggle('p2-draw-dialog',kind==='draw');dialog.innerHTML=`<header class="p2-modal-header"><h2 id="p2-dialog-title">${title}</h2><button class="p2-icon-button" data-p2="close" aria-label="关闭">×</button></header>${content}`;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;};
  const showInfo=kind=>{const content=dialogContent(kind,state,now());show(content.title,content.content,kind);};
  const navigate=(route,extra={})=>{close();window.jianxNavigate(route,extra);};
  const setView=next=>{close();view=next;render();window.jianxRoute(next==='prizes'?'card-eb05-prizes':'card-eb05');window.scrollTo(0,0);};
  const showGrant=createGrantPresenter({read:session.loadPhase2,save:session.savePhase2,now,close,present:showPhase2Grant,pageWindow:window,pageDocument:document});
  const openDraw=(pool,count)=>{state=session.loadPhase2();const blocked=drawBlockReason(state,pool,count,now());if(blocked){notify(blocked);return;}transaction.prepare(pool,count);show(pool==='welcome'?'新人专属五连抽':count===5?'开启五连抽':'开启幸运单抽',drawMarkup(pool,count),'draw');};
  const openResult=id=>{const batch=state.draws.find(item=>item.id===id);if(!batch){notify('未找到该次抽奖记录');return;}show('抽奖结果',resultMarkup(state,batch,now()),'result');};
  const inviteDialog=forwarded=>show('邀请好友，一起收藏好运',`<div class="p2-invite-card">${emblem}<h3>${forwarded?'已模拟转发小程序':'把收藏的快乐，分享给好友'}</h3><p>${forwarded?'好友完成注册后，你可获得 5 张普通抽奖券。':'通过转发小程序邀请新用户注册，每位可为你带来 5 张抽奖券。'}</p><span>${forwarded?'演示下一步：好友完成注册':'仅转发不发券，新用户注册后到账'}</span></div>${action(forwarded?'模拟新用户完成注册':'转发小程序',forwarded?'invite-register':'invite-forward')}`,'invite');
  document.body.classList.toggle('p2-embedded',new URLSearchParams(location.search).get('embedded')==='1');render();
  document.addEventListener('click',event=>{
    const stateTab=event.target.closest('[data-state]'),voucherTab=event.target.closest('[data-voucher-state]');
    if(stateTab||voucherTab){if(stateTab)ticketState=stateTab.dataset.state;else voucherFilter=voucherTab.dataset.voucherState;const id=(stateTab||voucherTab).id;render();document.getElementById(id)?.focus();return;}
    const button=event.target.closest('[data-p2]');if(!button||button.disabled)return;const key=button.dataset.p2;
    if(key==='close'){close();return;}if(key==='back'){navigate('lottery');return;}if(key==='card'){navigate('card',{intent:'phase2-entry'});return;}
    if(key==='tickets'||key==='prizes'){setView(key);return;}
    if(['rules','earning','pool','history','draw-history','settings'].includes(key)){showInfo(key);return;}
    if(key==='draw-one'||key==='draw-five'||key==='draw-welcome'){openDraw(key==='draw-welcome'?'welcome':'ordinary',key==='draw-one'?1:5);return;}
    if(key==='reveal'){
      const pending=transaction.pending,outcome=transaction.reveal();if(!outcome)return;if(outcome.error){notify(outcome.error);return;}
      state=outcome.state;dialog.innerHTML=`<header class="p2-modal-header"><h2 id="p2-dialog-title">${pending.pool==='welcome'?'新人专属五连抽':pending.count===5?'五连抽结果':'抽奖结果'}</h2><button class="p2-icon-button" data-p2="close" aria-label="关闭">×</button></header>${drawMarkup(pending.pool,pending.count,outcome.batch)}`;
      requestAnimationFrame(()=>requestAnimationFrame(()=>dialog.querySelector('.p2-flip-grid')?.classList.add('is-flipped')));dialog.querySelector('[data-p2^="result:"]')?.focus({preventScroll:true});return;
    }
    if(key.startsWith('result:')){openResult(key.slice(7));return;}
    if(key.startsWith('address:')){const id=key.slice(8);if(!getReward(state,id)){notify('未找到对应奖品');return;}show('收货信息',addressMarkup(state,id,now()),'address');return;}
    if(key==='fill-demo-address'){const form=dialog.querySelector('#p2-address-form');if(form){fillDemoAddress(form);notify('演示地址已填入，可继续保存');}return;}
    if(key.startsWith('voucher:')){notify('“去使用”入口演示：后续将进入专家卡牌鉴定');return;}
    if(key==='invite'){inviteForwarded=false;inviteDialog(false);return;}
    if(key==='invite-forward'){inviteForwarded=true;inviteDialog(true);return;}
    if(key==='invite-register'){if(!inviteForwarded)return;inviteForwarded=false;const outcome=model.invite(session.loadPhase2(),{id:`friend-${crypto.randomUUID()}`,registeredAt:now(),lastInviter:state.uid},now());if(!outcome.awarded){notify('当前不在活动期间，无法获得邀请奖励');return;}showGrant(outcome,'邀请新人注册成功');return;}
    if(key.startsWith('scenario:')){const scenario=key.slice(9);close();state=session.applyPhase2Scenario(scenario);render();if(scenario==='new'){navigate('card',{intent:'phase2-entry'});return;}if(scenario==='ten'){showGrant({state,awarded:true,amount:1,sharePrompt:true},'AI 卡牌鉴定完成');return;}if(scenario==='won'||scenario==='ended')setView('prizes');else showInfo('settings');notify('已切换本期演示场景');return;}
    if(key.startsWith('demo-')){
      const current=session.loadPhase2(),eventId=`demo-${crypto.randomUUID()}`;let outcome;
      if(key==='demo-ai')outcome=model.recordResult(current,{id:eventId,kind:'ai',category:'card'},now());
      if(key==='demo-payment')outcome=model.recordExpertPayment(current,{id:eventId,category:'card'},now());
      if(key==='demo-result'){outcome=model.recordResult(current,{id:eventId,kind:'expert',category:'card'},now());session.savePhase2(outcome.state);showInfo('settings');notify(model.active(now())?'人工结果已累计，未重复发券':'当前不在活动期间');return;}
      if(key==='demo-voucher'){const voucher=current.vouchers.find(item=>voucherState(item,now())==='unused');if(!voucher){notify('暂无可使用的专家鉴定券');return;}outcome=model.useVoucher(current,voucher.id,now(),{paymentId:eventId,category:'card'});}
      if(!outcome)return;if(outcome.error){notify(outcome.error);return;}if(!outcome.awarded&&!outcome.capped){session.savePhase2(outcome.state);notify('当前不在活动期间，未新增抽奖券');return;}showGrant(outcome,key==='demo-ai'?'AI 卡牌鉴定完成':key==='demo-payment'?'专家卡牌鉴定支付成功':'专家鉴定券兑换成功');
    }
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='p2-address-form')return;event.preventDefault();const form=event.target,address=Object.fromEntries(new FormData(form)),outcome=model.saveAddress(session.loadPhase2(),form.dataset.rewardId,address,now());
    for(const input of form.querySelectorAll('input')){const message=outcome.errors?.[input.name]||'';input.setAttribute('aria-invalid',String(Boolean(message)));form.querySelector(`[data-error-for="${input.name}"]`).textContent=message;}
    form.querySelector('#p2-address-error').textContent=outcome.error||'';if(outcome.error){form.querySelector('[aria-invalid="true"]')?.focus();return;}session.savePhase2(outcome.state);setView('prizes');notify('收货信息已保存');
  });
  root.addEventListener('keydown',event=>{
    const current=event.target.closest('[role="tab"]');if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...current.parentElement.querySelectorAll('[role="tab"]')],index=tabs.indexOf(current),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();if(tabs[next].id)document.getElementById(tabs[next].id)?.focus();else root.querySelector(`[data-p2="${tabs[next].dataset.p2}"]`)?.focus();
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{
    if(dialog.open)return; // A newer modal may already be open before this queued close event.
    transaction.cancel();inviteForwarded=false;dialogKind='';
    const replacement=opener?.dataset.p2?root.querySelector(`[data-p2="${opener.dataset.p2}"]`):null;
    const target=opener?.isConnected&&!opener.disabled?opener:replacement&&!replacement.disabled?replacement:root.querySelector('.p2-view-tabs [aria-selected="true"]');
    target?.focus({preventScroll:true});
  });
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();});
  window.addEventListener('phase2-change',()=>{render();if(dialog.open&&['settings','pool','history','draw-history'].includes(dialogKind))showInfo(dialogKind);});
  window.addEventListener('jianx-shell',event=>{
    const detail=event.detail;if(detail.type==='visibility'&&!detail.active){close();return;}
    if(detail.type==='activate'){close();view=detail.route==='card-eb05-prizes'?'prizes':'tickets';render();window.scrollTo(0,0);if(detail.intent==='demo')showInfo('settings');if(detail.intent==='draw-welcome')openDraw('welcome',5);if(detail.intent==='draw-ordinary')openDraw('ordinary',1);}
  });
  window.addEventListener('pagehide',close);
  window.jianxReady();
}
