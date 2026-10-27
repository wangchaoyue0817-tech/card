// A read-only activity preview. Existing activities keep their own demo state.
export const PHASE2 = Object.freeze({
  id: 'onepiece-eb05-2026',
  name: '海贼王 · 海贼EB05上新 免费抽活动',
  startsAt: '2026-10-30T00:00:00+08:00',
  endsAt: '2026-11-05T23:59:59.999+08:00',
  ordinary: Object.freeze({physicalPercent: 8, voucherPercent: 92}),
  dailyIdentificationCap: 10,
  expertVoucherDays: 7,
  shippingWorkingDays: 7,
  drawEnabled: false,
  prizes: Object.freeze([
    Object.freeze({id:'chopper', name:'乔巴杂志', spec:'1 本带 P 卡', quantity:3, weight:20, category:'COLLECTION', mark:'P', note:'杂志 × 收藏卡'}),
    Object.freeze({id:'selection', name:'海贼精选套装', spec:'1 套', quantity:1, weight:15, category:'SPECIAL SET', mark:'SET', note:'精选收藏套装'}),
    Object.freeze({id:'eb05-pack', name:'海贼 EB05', spec:'1 包', quantity:40, weight:50, category:'BOOSTER PACK', mark:'EB05', note:'卡包 · 活动全程开放'}),
    Object.freeze({id:'eb05-box', name:'海贼 EB05', spec:'1 盒', quantity:2, weight:15, category:'BOOSTER BOX', mark:'BOX', note:'整盒收藏好礼'}),
  ]),
  earning: Object.freeze([
    Object.freeze({id:'welcome', name:'新人礼包', amount:5, kind:'新人专属券', inDailyCap:false, detail:'活动期间，新用户首次进入卡牌鉴定二级页面可获得。新人券需一次性五连抽，不与普通券混用。'}),
    Object.freeze({id:'ai', name:'AI 卡牌鉴定', amount:1, kind:'普通抽奖券', inDailyCap:true, detail:'上传卡牌并成功获得 AI 鉴定结果，即可获得 1 张；鉴定结果不影响获券。'}),
    Object.freeze({id:'expert', name:'专家卡牌鉴定', amount:1, kind:'普通抽奖券', inDailyCap:true, detail:'完成卡牌类专家鉴定订单支付或用券支付，即可获得 1 张。'}),
    Object.freeze({id:'share', name:'满额分享', amount:5, kind:'普通抽奖券', inDailyCap:false, detail:'当日鉴定累计获券达 10 张时，在对应弹窗点击“转发小程序”可再获得 5 张。'}),
    Object.freeze({id:'invite', name:'邀请新人注册', amount:5, kind:'普通抽奖券', inDailyCap:false, detail:'邀请新用户完成注册，可获得 5 张抽奖券。'}),
  ]),
});

const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const back = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 5-7 7 7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ticket = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 8h22v5a3 3 0 0 0 0 6v5H5v-5a3 3 0 0 0 0-6V8Z" stroke="currentColor" stroke-width="1.3"/><path d="M21 9v3m0 3v2m0 3v3M10 12l6 8m-6-2 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const sparkle = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 3 3.3 9.7L29 16l-9.7 3.3L16 29l-3.3-9.7L3 16l9.7-3.3L16 3Z" stroke="currentColor" stroke-width="1.3"/><path d="m16 10 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="currentColor"/></svg>';

export function activityState(now=Date.now()) {
  return now < Date.parse(PHASE2.startsAt) ? 'upcoming' : now > Date.parse(PHASE2.endsAt) ? 'ended' : 'active';
}

export function emptyMarkup(state='unused') {
  const copy={unused:['暂无未使用抽奖券','活动开放后，获得的抽奖券会展示在这里。'],used:['暂无使用记录','每次抽奖消耗的券数与结果，会一起记录在这里。'],expired:['暂无已过期抽奖券','已过期的抽奖券会保留记录，方便随时查看。']};
  const [title,desc]=copy[state]||copy.unused;
  return `<div class="p2-empty"><span class="p2-empty-art">${ticket}</span><h3>${title}</h3><p>${desc}</p></div>`;
}

export function pageMarkup(now=Date.now()) {
  const status={upcoming:'即将开始',active:'活动时间内',ended:'活动已结束'}[activityState(now)];
  return `<header class="p2-header"><button class="p2-icon-button" data-p2="back" aria-label="返回活动列表">${back}</button><div><span>REWARDS CENTER</span><h1>抽奖中心</h1></div><button class="p2-header-link" data-p2="prizes">我的奖品</button></header>
  <div class="p2-content">
    <section class="p2-hero" aria-label="${PHASE2.name}"><div class="p2-hero-art" aria-hidden="true"><i></i><img src="assets/lottery-card-back.png" alt=""><img src="assets/lottery-card-back.png" alt=""></div><div class="p2-hero-copy"><span class="p2-eyebrow">ONE PIECE · COLLECTION 02</span><p class="p2-kicker">海贼王 · 收藏新篇</p><h2>海贼 EB05 上新<span>免费抽，开启新惊喜</span></h2><p class="p2-period">10.30 00:00 — 11.05 23:59</p><span class="p2-status">${status}</span></div></section>
    <div class="p2-preview-note"><span>活动预览</span><p>抽奖交互待规则确认后开放</p></div>
    <section class="p2-wallet" aria-label="第二期普通抽奖券"><div class="p2-wallet-top"><span>${ticket}普通抽奖券</span><button data-p2="rules">使用规则 <b>ⓘ</b></button></div><div class="p2-balance"><div><strong>0</strong><span>张可用</span></div><p>鉴卡有礼<br><span>每一次探索，收获更多期待</span></p></div><div class="p2-draw-actions"><button disabled>抽一次<small>使用 1 张普通券</small></button><button disabled>五连抽<small>使用 5 张普通券</small></button></div></section>
    <nav class="p2-utilities" aria-label="活动信息"><button data-p2="earning"><span class="p2-utility-icon">${ticket}</span><span><strong>获券方式</strong><small>5 种方式，积攒好运</small></span>${arrow}</button><button data-p2="pool"><span class="p2-utility-icon">${sparkle}</span><span><strong>查看奖池</strong><small>4 款实物 · 专家鉴定券</small></span>${arrow}</button></nav>
    <section class="p2-inventory"><div class="p2-section-heading"><h2>我的抽奖券</h2><button data-p2="history">获得记录 ${arrow}</button></div><div class="p2-tabs" role="tablist" aria-label="抽奖券状态">${[['unused','未使用'],['used','已使用'],['expired','已过期']].map(([key,label])=>`<button id="p2-tab-${key}" data-state="${key}" role="tab" aria-selected="${key==='unused'}" aria-controls="p2-ticket-panel" tabindex="${key==='unused'?0:-1}">${label}<b>0</b></button>`).join('')}</div><div id="p2-ticket-panel" role="tabpanel" aria-labelledby="p2-tab-unused" tabindex="0">${emptyMarkup()}</div></section>
    <button class="p2-appraisal-link" data-p2="card"><span>去鉴卡牌<span>继续探索你的收藏</span></span>${arrow}</button>
    <p class="p2-footer">图灵鉴 X · 让每一份收藏被认真对待</p>
  </div>`;
}

export function earningMarkup() {
  return `<p class="p2-modal-intro">从每一次鉴定开始，让收藏多一份惊喜。</p><div class="p2-earning-list">${PHASE2.earning.map((item,index)=>`<article><span class="p2-number">0${index+1}</span><div><h3>${item.name}</h3><p>${item.detail}</p><small>${item.inDailyCap?'计入每日鉴定获券额度':'不占每日鉴定获券额度'}</small></div><b>+${item.amount}<small>张</small></b></article>`).join('')}</div><div class="p2-info-note">每日通过 AI 与专家鉴定合计最多获得 <strong>10 张</strong>。次日凌晨重置额度；达到上限后仍可继续鉴定。</div><button class="p2-primary" data-p2="card">去鉴卡牌 ${arrow}</button>`;
}

export function poolMarkup() {
  return `<div class="p2-probabilities"><div><strong>8<small>%</small></strong><span>实物奖品</span></div><i></i><div><strong>92<small>%</small></strong><span>专家鉴定券</span></div><p>普通单抽 / 五连抽 · 每次获得一份好礼</p></div><div class="p2-prize-grid">${PHASE2.prizes.map((prize,index)=>`<article class="p2-prize p2-prize-${index}"><div class="p2-prize-art" aria-hidden="true"><span>${prize.category}</span><b>${prize.mark}</b><i>✦</i></div><div class="p2-prize-copy"><span class="p2-prize-quantity">${prize.quantity} 份</span><h3>${prize.name}</h3><p>${prize.spec}</p><small>${prize.note}</small><div class="p2-prize-weight">单品获奖率 <b>${prize.weight}%</b></div></div></article>`).join('')}</div><div class="p2-expert-pass"><span class="p2-pass-icon">${sparkle}</span><div><span>EXPERT PASS</span><h3>专家线上鉴定券</h3><p>每张有效期 7 天</p></div><b>×1</b></div><p class="p2-modal-footnote">实物按投放规则分批开放，海贼 EB05（1 包）全程开放。具体开放门槛与投放细则确认后更新。</p>`;
}

export function rulesMarkup() {
  return `<div class="p2-rules"><p class="p2-modal-intro">海贼王 · 海贼 EB05 上新 免费抽活动</p><h3>01 · 活动时间</h3><p>2026 年 10 月 30 日 00:00 至 11 月 5 日 23:59，所有用户均可参与。</p><h3>02 · 抽奖券与参与方式</h3><p>新人礼包为 5 张新人专属券，活动期内只能领取一次，需一次性五连抽，不可拆分或与普通券混用。普通券可以合并积攒，支持单抽与五连抽，余额不足 5 张时不可五连抽。</p><p>AI 卡牌鉴定成功获得结果、卡牌类专家鉴定完成支付或用券支付，各送 1 张普通券；每日合计最多 10 张。新人礼包、满额分享与邀请注册奖励不占此额度。</p><h3>03 · 奖品与领取</h3><p>普通抽奖的实物概率为 8%，专家鉴定券概率为 92%。专家鉴定券有效期 7 天。实物奖品在活动结束后 7 个工作日内寄出，请在活动结束前填写收货地址，逾期未填写视为放弃领取。</p><h3>04 · 预览说明</h3><p>新人抽奖概率、抽奖券有效期及实物分批开放细则确认后更新。当前可查看活动内容，抽奖暂未开放。</p></div>`;
}

export function dialogContent(kind) {
  if(kind==='earning') return {title:'把好运攒起来',content:earningMarkup()};
  if(kind==='pool') return {title:'本期收藏好礼',content:poolMarkup()};
  if(kind==='history') return {title:'获得记录',content:'<div class="p2-empty"><span class="p2-empty-art">'+ticket+'</span><h3>还没有获得抽奖券</h3><p>每一笔获券记录，都会在这里保留。</p></div>'};
  return {title:'活动规则',content:rulesMarkup()};
}

if(typeof document!=='undefined') {
  const root=document.getElementById('phase2-page'),dialog=document.getElementById('phase2-dialog');
  root.innerHTML=pageMarkup();
  document.body.classList.toggle('p2-embedded',new URLSearchParams(location.search).get('embedded')==='1');
  const selectTab=button=>{
    for(const tab of root.querySelectorAll('[role="tab"]')){const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
    const panel=root.querySelector('#p2-ticket-panel');panel.innerHTML=emptyMarkup(button.dataset.state);panel.setAttribute('aria-labelledby',button.id);
  };
  document.addEventListener('click',event=>{
    const tab=event.target.closest('[data-state]');if(tab){selectTab(tab);return;}
    const action=event.target.closest('[data-p2]')?.dataset.p2;if(!action)return;
    if(action==='close'){dialog.close();return;}
    const route={back:'lottery',card:'card',prizes:'prizes'}[action];
    if(route){if(dialog.open)dialog.close();window.jianxNavigate(route);return;}
    if(!['rules','earning','pool','history'].includes(action))return;
    const {title,content}=dialogContent(action);dialog.innerHTML=`<header class="p2-modal-header"><h2 id="p2-dialog-title">${title}</h2><button class="p2-icon-button" data-p2="close" aria-label="关闭">×</button></header>${content}`;dialog.showModal();dialog.scrollTop=0;
  });
  root.addEventListener('keydown',event=>{
    const current=event.target.closest('[role="tab"]');if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const tabs=[...root.querySelectorAll('[role="tab"]')],index=tabs.indexOf(current),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next]);tabs[next].focus();
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}});
  window.addEventListener('jianx-shell',event=>{
    if(event.detail.type==='visibility'&&!event.detail.active&&dialog.open)dialog.close();
    if(event.detail.type==='activate'){if(dialog.open)dialog.close();window.scrollTo(0,0);}
  });
  window.jianxReady();
}
