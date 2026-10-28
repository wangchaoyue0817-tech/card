import {START,END,DAY,PRIZES,active,dayKey,fresh,welcome,identify,share,invite,draw,payExpert,available,dailyCount,validateAddress} from './lottery-model.js';
import {esc,glyph,notify,setupDrawer} from './ui-common.js';
import {ticketPanel,prizePanel,prizePool,ticketHistory} from './center-pages.js';
import {sidebarIcons} from './sidebar-icons.js';
import {selectionMarkup,mountDraw,celebrate,rarityCopy} from './draw-experience.js';
import {grantMarkup,voucherMarkup,rulesMarkup,ticketEmblem} from './reward-ui.js';
import '../phase2-service-bridge.js';
const $=id=>document.getElementById(id),KEY='jianx-card-preview-v1';
let saved;try{saved=JSON.parse(localStorage.getItem(KEY));}catch{}
let data=saved?.state?.version===1?saved.state:fresh();
let mode=saved?.mode||'demo',clockBase=saved?.clockBase||START+12*3600000,clockReal=saved?.clockReal||Date.now();
let route='card',fileURL='',sample=false,report=null,busy=false,modalType='',focusReturn=null,scenarioVersion=0;
let stopDraw=null,stopCelebration=null,recordType='unused';
let cardBrand='',cardStyle='',chatDraft='',chatMessage='',ownsPhoto=false,pendingGrant=null;
function clearCardPhoto(){if(fileURL&&ownsPhoto)URL.revokeObjectURL(fileURL);fileURL='';ownsPhoto=false;}
// First card campaign is archived; future issuance needs its own configured period.
const now=()=>Math.max(END+1,mode==='real'?Date.now():clockBase+Date.now()-clockReal);
const fmt=t=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(t);
const CARD_CAMPAIGN_ENABLED=false;
const save=()=>{if(!CARD_CAMPAIGN_ENABLED)return;try{localStorage.setItem(KEY,JSON.stringify({state:data,mode,clockBase,clockReal}));}catch{notify('浏览器无法保存，关闭页面后演示记录可能丢失');}};
const btn=(text,action,cls='cl-primary',extra='')=>`<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const ticketIcon=()=>ticketEmblem();
const status=()=>now()<START?'活动未开始':now()>=END?'活动已结束':'活动进行中';
const remaining=()=>{if(!data.welcome)return '';const ms=data.welcome.expiresAt-now();return ms<=0?'已过期':ms<3600000?`${Math.ceil(ms/60000)} 分钟后到期`:`${Math.ceil(ms/3600000)} 小时内使用`;};
const physicals=()=>data.draws.flatMap(d=>d.rewards).filter(r=>r.type==='physical');
function photo(p,small=false){const [x,y,w,h]=p.crop,scale=(small?72:104)/h;return `<div class="cl-prize-art ${small?'small':''}"><span role="img" aria-label="${esc(p.name)}" style="width:${w*scale}px;height:${h*scale}px;background-image:url('assets/prize-source.jpg');background-size:${1532*scale}px ${1256*scale}px;background-position:${-x*scale}px ${-y*scale}px"></span></div>`;}
function closeModal(){
  reloadCampaign();
  stopDraw?.();stopDraw=null;stopCelebration?.();stopCelebration=null;
  if(modalType==='share'){data=share(data,now(),'dismiss').state;save();}
  $('card-dialog').close();$('card-dialog').classList.remove('is-draw','is-reward');modalType='';focusReturn?.focus?.();
}
function modal(title,body,type='general'){
  if($('card-dialog').open)closeModal();focusReturn=document.activeElement;modalType=type;
  $('card-dialog').innerHTML=`<header class="cl-modal-head"><h2 id="dialog-title">${title}</h2><button class="cl-icon-button" data-action="close" aria-label="关闭弹窗">${glyph('x')}</button></header>${body}`;
  $('card-dialog').showModal();
}
$('card-dialog').addEventListener('cancel',e=>{e.preventDefault();closeModal();});
$('card-dialog').addEventListener('click',e=>{if(e.target===$('card-dialog'))closeModal();});
$('nav-menu').innerHTML=sidebarIcons.List;
const centerTabs=document.createElement('div');centerTabs.id='center-tabs';centerTabs.className='center-tab-switcher';centerTabs.setAttribute('role','tablist');centerTabs.setAttribute('aria-label','抽奖中心');centerTabs.hidden=true;
document.querySelector('.cl-nav').after(centerTabs);
centerTabs.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const target=event.key==='Home'?'lottery':event.key==='End'?'prizes':route==='prizes'?'lottery':'prizes';
  navigate(target);render();centerTabs.querySelector('[aria-selected="true"]').focus();
});
setupDrawer($('nav-menu'));
$('nav-back').onclick=()=>{if(route==='card')window.jianxNavigate('home');else navigate('card');};
$('demo-settings').onclick=()=>showDemo();
function navigate(to){if(['lottery','prizes'].includes(to)){window.jianxNavigate(to);return;}location.hash=to;window.jianxRoute(to);}
function render(){
  const restoreTabFocus=!!document.activeElement?.closest('#center-tabs');
  const hash=location.hash.slice(1);route=hash==='prizes'?'prizes':['lottery','records'].includes(hash)?'lottery':'card';
  const isCenter=route!=='card';
  document.querySelector('.cl-device').classList.toggle('is-center',isCenter);
  $('nav-back').innerHTML=isCenter?glyph('caret-left'):'⌂';
  $('card-composer').hidden=isCenter;
  $('nav-title').textContent=isCenter?'抽奖中心':'AI 卡牌鉴定';
  $('nav-eyebrow').textContent=isCenter?'REWARDS CENTER':'TURING CARD LAB';
  $('nav-eyebrow').hidden=!isCenter;
  $('demo-settings').textContent=mode==='demo'?`演示 · ${fmt(now()).slice(0,5)}`:'真实日期 · 模拟流程';
  $('nav-back').setAttribute('aria-label',isCenter?'返回卡牌页面':'返回首页');
  centerTabs.hidden=!isCenter;
  centerTabs.innerHTML=isCenter?[['lottery','抽奖券'],['prizes','我的奖品']].map(([id,label])=>`<button id="tab-${id}" role="tab" aria-selected="${route===id}" aria-controls="card-content" tabindex="${route===id?0:-1}" data-action="nav-${id}">${label}</button>`).join(''):'';
  if(restoreTabFocus&&isCenter)centerTabs.querySelector('[aria-selected="true"]').focus();
  $('card-content').setAttribute('role',isCenter?'tabpanel':'region');
  if(isCenter)$('card-content').setAttribute('aria-labelledby',`tab-${route}`);else $('card-content').removeAttribute('aria-labelledby');
  $('card-content').innerHTML=route==='card'?cardPage():route==='lottery'?ticketPanel(data,now(),recordType):prizePanel(data,now(),photo);
  // The center is a two-tab management page, not a three-destination bottom-nav app.
  $('card-bottom').hidden=true;$('card-bottom').replaceChildren();
  $('card-send').disabled=busy||(!fileURL&&!sample&&!chatDraft.trim());
}
function cardPage(){
  return `<section class="card-intro spectrum-template-card"><div class="card-hero-main"><div class="card-hero-copy"><h2>AI 初鉴<br><em>专家复核</em></h2></div><div class="card-spectrum-art" aria-hidden="true"><div class="card-spectrum-scan"></div><div class="card-spectrum-ring ring-one"></div><div class="card-spectrum-ring ring-two"></div><div class="card-spectrum-orbit orbit-one"><i></i><i></i></div><div class="card-spectrum-orbit orbit-two"><i></i><i></i></div><div class="card-spectrum-orbit orbit-three"><i></i></div><div class="card-spectrum-core"><span class="card-spectrum-glyph"></span><b>CARD</b></div><div class="card-spectrum-reticle"><i></i><i></i><i></i><i></i></div><span class="card-spectrum-token token-one"></span><span class="card-spectrum-token token-two"></span></div></div></section>
  <button class="card-luck-entry" data-action="nav-lottery"><img class="card-luck-banner-art" src="assets/card-luck-banner-v2.png" alt=""><span class="card-luck-copy"><strong>卡牌抽奖活动</strong><em>第一期已结束 · 历史奖品</em></span><b class="card-luck-arrow" aria-hidden="true">${glyph('arrow-right')}</b></button>
  <details class="card-demo-options"><summary>演示选项</summary><div>${btn('使用演示样例','sample','cl-text-button')}${btn('切换演示场景','demo','cl-text-button')}</div></details>
  ${fileURL||sample?`<section class="card-recognition"><div class="card-upload-message"><img src="${fileURL?esc(fileURL):'assets/card-hero.png'}" alt="待鉴定卡牌">${cardBrand?`<span>${esc(cardBrand)} · ${esc(cardStyle)}</span>`:''}</div>${btn(busy?'正在鉴定…':cardBrand?'开始 AI 鉴定':'选择品牌与款式',cardBrand?'identify':'choose-style','cl-primary cl-full',busy?'disabled':'')}${cardBrand?btn('更换品牌与款式','choose-style','cl-text-button'):''}</section>`:''}
  ${chatMessage?`<section class="card-chat-message"><p>${esc(chatMessage)}</p>${btn('上传卡牌照片','upload','cl-secondary')}</section>`:''}
  ${report?`<section class="cl-report"><div class="cl-section-heading"><h2>${glyph('crystal-reward')}AI 初鉴已完成</h2><span class="cl-tag">模拟结果</span></div><h3>收藏卡 · 正面信息可辨识</h3><p>可观察卡面图案、印刷边缘与表面状态。仅凭当前图片无法确认真伪，以下为流程演示。</p><div class="cl-report-metrics"><span>卡面完整度<strong>良好</strong></span><span>图片清晰度<strong>清晰</strong></span><span>建议复核<strong>印刷细节</strong></span></div>${report.expert?`<div class="cl-expert-done">${glyph('shield-check')}专家模拟结果已生成<small>演示结论：建议结合实物复核；不构成真实鉴定凭证。</small></div>`:btn(`转专家线上鉴定 <span>限时免费 ${glyph('arrow-right')}</span>`,'expert','cl-expert-button')}<small class="cl-footnote">报告编号 ${esc(report.id.slice(-8))} · ${fmt(report.at)}</small></section>`:''}
  `;
}
function chooseStyle(){
  if(!sample&&!fileURL){$('card-upload').click();return;}
  modal('选择品牌与款式',`<form id="card-style-form"><label class="cl-field">卡牌品牌<select name="brand" required><option value="">请选择品牌</option><option>宝可梦</option><option>球星卡</option><option>小卡</option></select></label><label class="cl-field">卡牌款式<select name="style" required disabled><option value="">请先选择品牌</option></select></label><button class="cl-primary cl-full" type="submit">开始 AI 鉴定 ${glyph('arrow-right')}</button></form>`);
  const form=$('card-style-form'),options={'宝可梦':['30 周年纪念卡','角色收藏卡','训练家收藏卡'],'球星卡':['球员基础卡','签名收藏卡','赛事纪念卡'],'小卡':['人物收藏卡','限定纪念卡']};
  form.elements.brand.onchange=()=>{const list=options[form.elements.brand.value]||[];form.elements.style.disabled=!list.length;form.elements.style.innerHTML='<option value="">请选择款式</option>'+list.map(s=>`<option>${s}</option>`).join('');};
  if(cardBrand){form.elements.brand.value=cardBrand;form.elements.brand.onchange();form.elements.style.value=cardStyle;}
  form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;cardBrand=form.elements.brand.value;cardStyle=form.elements.style.value;closeModal();action('identify');};
}
function showGrant(options){
  modal(options.amount===0?'鉴定完成':'收到一份好运',grantMarkup({expiresAt:END-1,...options}),options.sharePrompt?'share':'grant');
  $('card-dialog').classList.add('is-reward');
  stopCelebration=celebrate($('card-dialog'),'voucher');
}
function presentPendingGrant(){
  if(!pendingGrant||$('card-dialog').open)return;
  const options=pendingGrant;pendingGrant=null;
  if(options.sharePrompt)options.sharePrompt=options.day===dayKey(now())&&data.days[dayKey(now())]?.share==='pending';
  showGrant(options);
}
function showWelcome(){
  showGrant({amount:5,source:'卡牌类别专属新人礼',pool:'welcome',expiresAt:data.welcome.expiresAt});
}
function offerShare(){
  showGrant({amount:1,source:'本次鉴定完成',today:10,sharePrompt:true});
}
function showResult(batch,animate=false){
  const vouchers=batch.rewards.filter(r=>r.type==='voucher').length;
  const physical=batch.rewards.find(r=>r.type==='physical'),prize=PRIZES.find(p=>p.id===physical?.prizeId);
  modal('抽奖结果',`<div class="reward-headline ${physical?'is-rare':''}"><span>${physical?'RARE COLLECTIBLE':'A GIFT FOR YOUR COLLECTION'}</span><h3>${physical?'稀有好运，真的属于你':batch.rewards.length===5?'五份好礼，满载而归':'恭喜，收获一份好礼'}</h3><p>${physical?'你的收藏，即将迎来一位新伙伴':'让每一份热爱，都多一份专业守护'}</p>${physical?`<span class="reward-rarity">${rarityCopy(batch.pool)}</span>`:''}</div>${physical?`<article class="reward-feature">${photo(prize,true)}<div><h3>${esc(prize.name)}</h3><p>${prize.spec} × 1</p><small>活动结束后 7 个工作日内寄出</small></div></article>`:''}${vouchers?voucherMarkup(vouchers,batch.rewards.find(r=>r.type==='voucher').expiresAt):''}${batch.pool==='welcome'?'<div class="cl-next-reward"><strong>下一份好运，从一次鉴定开始</strong><p>完成一次卡牌 AI 鉴定或专家鉴定，即可再获 1 张抽奖券。</p><small>AI 出结果或专家支付／用券兑换成功即算；每日合计最多 10 张。</small></div>':''}<p class="cl-result-summary">${batch.rewards.length} 份奖品已记入「我的奖品」</p><div class="reward-action-row">${btn('查看我的奖品','grant-prizes','cl-secondary')}${physical?btn('填写收货信息',`address-${physical.id}`,'cl-gold'):btn('收下好运','close','cl-primary')}</div>`,'result');
  $('card-dialog').classList.add('is-reward');
  if(animate)stopCelebration=celebrate($('card-dialog'),physical?'rare':'voucher');
}
function runDraw(pool,count){
  if(busy)return;
  const balance=available(data,now());if((pool==='welcome'?balance.welcome:balance.ordinary)<count){notify('可用抽奖券不足或已过期');return;}
  modal(count===5?'开启五连抽':'开启一次好运',selectionMarkup(count,pool),'drawing');$('card-dialog').classList.add('is-draw');
  stopDraw=mountDraw({dialog:$('card-dialog'),count,pool,photo,commit:()=>{
    reloadCampaign();
    const r=draw(data,pool,count,now(),()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);
    if(!r.error){data=r.state;save();render();}return r;
  },onComplete:batch=>showResult(batch,true),onError:message=>{closeModal();render();notify(message);}});
}
function showRules(){modal('抽奖规则',rulesMarkup()+btn('我知道了','close','cl-primary cl-full'));}
function showInvite(){
  modal('分享热爱，邀请有礼',`<div class="cl-modal-centered"><span class="cl-big-reward">+5<small> 张 / 人</small></span><h3>好朋友，好运一起收</h3><p>转发小程序给好友，<br>每邀请一位新用户完成注册，即可获得 5 张抽奖券。</p></div><div class="cl-invite-facts"><span>无需鉴定满 10 张</span><span>不占每日鉴定额度</span></div>${btn('转发小程序，邀请好友','invite-share','cl-primary cl-full',!active(now())?'disabled':'')}<p id="invite-share-status" class="cl-footnote" role="status"></p><p class="cl-rule-note">普通转发不直接发奖。新用户注册前，最后打开的小程序分享卡片所属邀请人获得奖励。</p><details class="cl-demo-detail"><summary>演示：验证邀请注册奖励</summary><p>此操作仅模拟一位新用户注册，不创建真实账户。</p><label>注册前最后打开的小程序分享卡片来自<select id="invite-owner"><option value="self">当前体验用户</option><option value="other">其他邀请人</option></select></label>${btn('模拟新用户完成注册','register-invite','cl-secondary cl-full',!active(now())?'disabled':'')}</details>`,'invite');
}
function showExpert(){if(busy){notify('请等待本次 AI 鉴定完成');return;}if(!report)return;window.jianxNavigate('expert',{intent:'card-expert'});}
function showAddress(id){
  const r=physicals().find(p=>p.id===id);if(!r)return;const a=data.addresses[id]||{};
  modal('收下这份收藏好礼',`<p class="cl-muted">完善收货信息，保存后可随时修改。</p><form id="address-form" data-prize="${esc(id)}" novalidate>${[['name','收货人','例如：体验用户'],['phone','手机号码','请输入 11 位手机号'],['region','所在地区','省 / 市 / 区'],['detail','详细地址','街道、小区及门牌号']].map(([key,label,placeholder])=>`<label class="cl-field">${label}<input name="${key}" value="${esc(a[key]||'')}" placeholder="${placeholder}" ${key==='phone'?'inputmode="tel" maxlength="11"':'maxlength="100"'} required aria-describedby="error-${key}"><span class="cl-field-error" id="error-${key}"></span></label>`).join('')}<button type="button" class="cl-text-button" data-action="sample-address">填入演示地址</button><p class="cl-rule-note">活动结束后 7 个工作日内寄出。</p><p class="cl-page-note">演示页面，请勿填写真实个人信息。地址仅保存在此浏览器，不会用于配送。</p><button type="submit" class="cl-gold cl-full">保存收货信息</button></form>`,'address');
  $('address-form').onsubmit=e=>{e.preventDefault();const address=Object.fromEntries(new FormData(e.target));const errors=validateAddress(address);for(const [k,msg]of Object.entries(errors)){ $(`error-${k}`).textContent=msg;e.target.elements[k].setAttribute('aria-invalid',!!msg); }if(Object.values(errors).some(Boolean)){e.target.querySelector('[aria-invalid="true"]').focus();return;}reloadCampaign();data.addresses[id]=address;save();closeModal();navigate('prizes');render();notify('收货信息已保存，可随时修改');};
}
function showDemo(){
  if(!CARD_CAMPAIGN_ENABLED){modal('卡牌活动待开启',`<div class="cl-rules"><h3>第一期活动已结束</h3><p>历史抽奖券、奖品及领奖信息已保留，可在抽奖中心切换到卡牌第一期查看。</p><h3>下一期敬请期待</h3><p>当前可体验 AI 卡牌鉴定及免费专鉴，暂不发放卡牌抽奖券。卡牌专鉴不参与本次六品类扭蛋活动。</p></div>${btn('查看抽奖中心','nav-lottery','cl-primary cl-full')}`);return;}
  modal('演示场景',`<p class="cl-muted">仅切换本预览的模拟账户和时间，不影响任何真实账户。切换将替换当前演示记录。</p><div class="cl-scenarios">${[['new','新人首次进入','活动中 · 5 张新人礼包'],['ordinary','老用户已有抽奖券','5 张普通券 · 可单抽／五连抽'],['ten','满 10 张分享奖励','直接查看当次限时分享弹窗'],['won','实物中奖展示','查看实物领奖与收货信息'],['expired','新人礼包已过期','24 小时后 · 普通券仍可使用'],['ended','活动已结束','抽奖券失效 · 查看记录和地址'],['before','活动未开始','未发放新人礼包'],['real','按真实日期预览','恢复实际日历 · 仍为模拟业务']].map(([id,t,s])=>btn(`<strong>${t}</strong><small>${s}</small>${glyph('caret-right')}`,`scenario-${id}`,'cl-scenario')).join('')}</div><p class="cl-page-note">正式日期：2026.09.25—10.07；正常抽取遵循规则概率。<br>“实物中奖展示”为指定的演示记录，不代表实际中奖。</p>`,'demo');
}
function scenario(name){
  if(!CARD_CAMPAIGN_ENABLED){notify('第一期已归档，历史记录保持不变');return;}
  closeModal();scenarioVersion++;busy=false;mode=name==='real'?'real':'demo';clockReal=Date.now();clockBase=START+12*3600000;
  if(name==='before')clockBase=START-DAY;if(name==='ended')clockBase=END+12*3600000;if(name==='expired')clockBase=START+3*DAY;
  data=fresh(`preview-${Date.now()}`,name==='new'?clockBase-60000:START-DAY);report=null;sample=false;clearCardPhoto();cardBrand='';cardStyle='';
  if(name==='real')data.registeredAt=Date.now();
  if(['ordinary','won','ended','expired'].includes(name)){const t=START+12*3600000;data=invite(data,{id:'demo-friend',registeredAt:t,clicks:[{uid:data.uid,at:t-1000}]},t).state;}
  if(name==='expired'){data.registeredAt=START+1000;data=welcome(data,START+2000).state;}
  if(name==='won'||name==='ended'){data=draw(data,'ordinary',1,START+13*3600000,()=>0).state;}
  if(name==='ten')for(let i=0;i<10;i++)data=identify(data,{id:`scenario-${i}`,kind:'ai'},now()).state;
  save();navigate(name==='new'||name==='before'||name==='real'?'card':name==='won'?'prizes':'lottery');render();
  if(name==='new'||name==='real')claimWelcome();if(name==='ten')offerShare();
}
function claimWelcome(){reloadCampaign();const r=welcome(data,now());data=r.state;save();render();if(r.awarded)showWelcome();}
async function action(a){
  reloadCampaign();
  if(a==='share-claim'&&(!active(now())||data.days[dayKey(now())]?.share!=='pending')){closeModal();render();notify('本次分享领奖机会已失效');return;}
  if(a.startsWith('nav-')){navigate(a.slice(4));return;}
  if(a.startsWith('scenario-')){scenario(a.slice(9));return;}
  if(a.startsWith('result-')){const b=data.draws.find(b=>b.id===a.slice(7));if(b)showResult(b,true);return;}
  if(a.startsWith('address-')){showAddress(a.slice(8));return;}
  switch(a){
    case 'close':closeModal();break;
    case 'welcome-go':closeModal();navigate('lottery');break;
    case 'grant-center':closeModal();navigate('lottery');render();break;
    case 'grant-prizes':closeModal();navigate('prizes');render();break;
    case 'voucher-use':notify('使用入口待接入');break;
    case 'tickets-unused':case 'tickets-used':case 'tickets-expired':{const scroll=$('card-content').scrollTop;recordType=a.slice(8);render();$('card-content').scrollTop=scroll;document.querySelector(`[data-action="${a}"]`).focus({preventScroll:true});break;}
    case 'ticket-history':modal('抽奖券获得记录',ticketHistory(data,now())+btn('知道了','close','cl-primary cl-full'));break;
    case 'upload':$('card-upload').click();break;
    case 'demo':showDemo();break;
    case 'choose-style':chooseStyle();break;
    case 'sample':sample=true;clearCardPhoto();report=null;cardBrand='';cardStyle='';render();document.querySelector('.card-recognition')?.scrollIntoView({behavior:'smooth',block:'center'});break;
    case 'identify':{
      if(busy||(!sample&&!fileURL))return;if(!cardBrand){chooseStyle();return;}busy=true;const version=scenarioVersion;render();
      setTimeout(()=>{if(version!==scenarioVersion)return;reloadCampaign();const id=crypto.randomUUID();report={id,at:now(),expert:false};const r=identify(data,{id,kind:'ai'},now());data=r.state;save();busy=false;render();const resultEvent=typeof CustomEvent==='function'?new CustomEvent('jianx-card-ai-result',{detail:{id,category:'卡牌',success:true,result:'reference'},cancelable:true}):null;if(resultEvent)window.dispatchEvent(resultEvent);if(r.awarded||r.capped){const options={amount:r.awarded?1:0,source:'AI 鉴定完成',today:dailyCount(data,now()),sharePrompt:r.sharePrompt,day:dayKey(now())};if(window.jianxActive)showGrant(options);else pendingGrant=options;}else if(!resultEvent?.defaultPrevented)notify('模拟鉴定已完成，当前不在活动期间');},800);break;
    }
    case 'expert':showExpert();break;
    case 'pay-expert':showExpert();break;
    case 'draw-welcome':runDraw('welcome',5);break;
    case 'draw-one':runDraw('ordinary',1);break;
    case 'draw-five':runDraw('ordinary',5);break;
    case 'rules':showRules();break;
    case 'prize-pool':modal('可抽取的奖品',prizePool(photo)+btn('查看抽奖规则','rules','cl-text-button cl-full'));break;
    case 'earning-info':modal('抽奖券获取方式',`<div class="center-earning-progress"><span>今日通过鉴定获得</span><strong>${dailyCount(data,now())} / 10 张</strong></div><div class="cl-rules"><h3>完成鉴定 · 每次 +1 张</h3><p>卡牌 AI 出结果，或专家支付／用券兑换成功后发放。AI 与专家分别计次，每人每天合计最多 10 张。</p><h3>满额分享 · 每天 +5 张</h3><p>达到第 10 张时，仅当次弹窗内点击转发小程序有效。关闭后当天不能补领，不计入鉴定额度。</p><h3>邀请新用户 · 每人 +5 张</h3><p>转发小程序，好友完成新用户注册后即可获得。无需先达到 10 张，不占每日鉴定额度。</p></div>${btn('转发小程序，邀请好友','invite','cl-primary cl-full',!active(now())?'disabled':'')}`);break;
    case 'invite':showInvite();break;
    case 'share-claim':{const r=share(data,now());data=r.state;save();render();if(r.awarded)showGrant({amount:5,source:'每日满额分享奖励',retry:true});break;}
    case 'share-retry':notify('已模拟重试，今日 5 张奖励不重复发放');break;
    case 'invite-share':if(active(now()))$('invite-share-status').textContent='已模拟转发小程序；好友完成新用户注册后，你将获得奖励。';break;
    case 'register-invite':{
      const own=$('invite-owner').value==='self',t=now();const r=invite(data,{id:crypto.randomUUID(),registeredAt:t,clicks:[{uid:data.uid,at:t-2000},{uid:own?data.uid:'other-preview',at:t-1000}]},t);data=r.state;save();render();if(r.awarded)showGrant({amount:5,source:'成功邀请一位新用户注册'});else notify('模拟注册完成：归属其他邀请人，当前账户未获奖');break;
    }
    case 'sample-address':{const form=$('address-form');const a={name:'体验用户',phone:'13800000000',region:'北京市 朝阳区',detail:'演示街道 100 号（不用于配送）'};Object.entries(a).forEach(([k,v])=>form.elements[k].value=v);break;}
    case 'show-draws':navigate('prizes');break;
  }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)action(b.dataset.action);});
$('card-upload').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>12*1024*1024){notify('请选择不超过 12 MB 的图片');e.target.value='';return;}clearCardPhoto();fileURL=URL.createObjectURL(file);ownsPhoto=true;sample=false;report=null;cardBrand='';cardStyle='';e.target.value='';render();document.querySelector('.card-recognition')?.scrollIntoView({behavior:'smooth',block:'center'});});
window.addEventListener('hashchange',()=>{render();$('card-content').scrollTop=0;if(route==='card')claimWelcome();});
// A pending one-off share prompt does not reappear after the page has been closed.
if(data.days[dayKey(now())]?.share==='pending'){data=share(data,now(),'dismiss').state;save();}
function reloadCampaign(){try{const value=JSON.parse(localStorage.getItem(KEY));if(value?.state?.version===1){data=value.state;mode=value.mode;clockBase=value.clockBase;clockReal=value.clockReal;}}catch{}}
window.addEventListener('jianx-shell',event=>{const m=event.detail;if(m.type==='reset-chat'){if($('card-dialog').open)closeModal();scenarioVersion++;busy=false;clearCardPhoto();sample=false;report=null;cardBrand='';cardStyle='';chatDraft='';chatMessage='';$('card-message').value='';render();return;}if(m.type==='visibility'&&!m.active){if($('card-dialog').open)closeModal();return;}if(m.type!=='activate')return;reloadCampaign();if(m.photo?.url){clearCardPhoto();fileURL=m.photo.url;sample=false;report=null;cardBrand='';cardStyle='';}history.replaceState(null,'','#'+(['lottery','prizes'].includes(m.route)?m.route:'card'));render();if(route==='card')claimWelcome();presentPendingGrant();if(m.intent==='draw-welcome')runDraw('welcome',5);if(m.intent==='choose-card'&&!$('card-dialog').open)chooseStyle();});
window.addEventListener('storage',event=>{if(event.key===KEY){reloadCampaign();if(!$('card-dialog').open&&!busy)render();}});
$('card-message').addEventListener('input',event=>{chatDraft=event.target.value;$('card-send').disabled=busy||(!chatDraft.trim()&&!sample&&!fileURL);});
$('card-send').onclick=()=>{if(fileURL||sample){cardBrand?action('identify'):chooseStyle();return;}if(chatDraft.trim()){chatMessage=chatDraft.trim();chatDraft='';$('card-message').value='';render();document.querySelector('.card-chat-message')?.scrollIntoView({behavior:'smooth'});}};
render();if(parent===window&&route==='card')claimWelcome();window.jianxReady();
setInterval(()=>{if(window.jianxActive&&!$('card-dialog').open&&!busy&&route!=='card')render();},60000);
window.addEventListener('pagehide',clearCardPhoto);
