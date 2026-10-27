import * as EventModel from './expert-event-model.js';
import {loadEvent, saveEvent, eventNow} from './expert-event-session.js';
import {PRIZES as CARD_PRIZES, END as CARD_END, START as CARD_START, validateAddress} from './lottery-model.js';
import {ticketInventory as cardTicketInventory} from './ticket-inventory.js';
import {prizeArt,mountMachine} from './capsule-machine.js';
import {activityChoiceMarkup,expertLotteryMarkup,cardLotteryMarkup} from './center-lottery.js';
import {unifiedPrizesMarkup,batchResultMarkup} from './center-prizes.js';
import {ticketHistory,prizePool} from './center-pages.js';
import {rulesMarkup} from './reward-ui.js';
import * as EventUI from './expert-event-ui.js';
export {prizeMarkup} from './center-prizes.js';

const {START, END, VOUCHER_END, PRIZES, ACTIVITY_CATEGORIES, active, balances, claimDaily, ticketInventory} = EventModel;
const CARD_KEY = 'jianx-card-preview-v1';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const time = value => Number.isFinite(value) ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value) : '时间待确认';
const date = value => Number.isFinite(value) ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value) : '以原活动记录为准';
const poolName = pool => pool === 'advanced' ? '高级抽奖券' : pool === 'welcome' ? '新人五连抽券' : '普通抽奖券';
const glyphs = {
  ticket:'<path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z"/><path d="M15 5v3m0 3v2m0 3v3"/>',
  crown:'<path d="m3 6 4 4 5-6 5 6 4-4-2 13H5L3 6Zm3 9h12"/>',
  arrow:'<path d="m9 5 7 7-7 7"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  gift:'<path d="M3 8h18v4H3zm2 4v9h14v-9M12 8v13"/><path d="M12 8C9 8 5 7 5 4.5A2.5 2.5 0 0 1 9.5 3C11 5 12 8 12 8Zm0 0c3 0 7-1 7-3.5A2.5 2.5 0 0 0 14.5 3C13 5 12 8 12 8Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  shield:'<path d="m12 3 8 4v6c0 4-4 7-8 9-4-2-8-5-8-9V7l8-4Z"/><path d="m8 12 3 3 5-5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  none:'<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M8 15c2 1.3 6 1.3 8 0"/>',
  cards:'<rect x="6" y="3" width="13" height="18" rx="2"/><path d="M3 6v12m7-11h5m-5 4h5m-5 4h3"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${glyphs[name] || glyphs.ticket}</svg>`;
const empty = (title, copy, action = '') => `<div class="ac-empty">${icon('ticket')}<h3>${escapeHTML(title)}</h3><p>${escapeHTML(copy)}</p>${action}</div>`;
const button = (label, action, style='ac-primary', disabled=false) => `<button class="${style}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;

export function earnedPrizes(state) {
  return (state.draws || []).flatMap(batch => (batch.rewards || []).filter(reward => ['physical','voucher'].includes(reward.type)).map(reward => ({...reward, pool:batch.pool, at:reward.at ?? batch.at, batchId:batch.id})));
}

export function eligibleOrderCount(state) {
  return (state.orders || []).filter(order => order.uid === state.uid && order.eligible !== false && active(order.at) && EventModel.isEligibleCategory(order.category)).length;
}

export function resolveActivityNavigation(current, message = {}) {
  const next = {...current};
  if(['expert','card-past','card-next'].includes(message.event)){
    next.currentEvent = message.event === 'card-next' ? 'card-past' : message.event;
    next.ticketStatus = 'unused';
    next.detailTab = 'tickets';
    next.prizeFilter = 'all';
  } else if(message.route === 'lottery' && !message.event) next.currentEvent = null;
  if(['ordinary','advanced'].includes(message.pool))next.selectedPool = message.pool;
  if(['unused','used','expired'].includes(message.ticketStatus))next.ticketStatus = message.ticketStatus;
  return next;
}

export function recordMarkup(batch, prizes = PRIZES) {
  return batchResultMarkup(batch,{legacy:prizes===CARD_PRIZES});
}

export function legacyFixture() {
  const at = CARD_START + 2 * 86400000 + 10 * 3600000;
  const vouchers = [
    {id:'sample-card-voucher-used',type:'voucher',at,expiresAt:at + 7 * 86400000,used:true},
    {id:'sample-card-voucher-expired',type:'voucher',at,expiresAt:at + 7 * 86400000,used:false},
  ];
  return {
    version:1,uid:'sample-card-user',registeredAt:CARD_START,welcome:{at,expiresAt:at + 86400000,used:true},ordinary:2,
    days:{},events:[],invites:[],physicalWon:true,addresses:{},
    ledger:[
      {id:'sample-use-ordinary',source:'普通单抽',amount:-1,at:at + 3600000,type:'ordinary'},
      {id:'sample-use-welcome',source:'新人五连抽',amount:-5,at:at + 1000,type:'welcome'},
      {id:'sample-grant-ordinary',source:'专家鉴定',amount:3,at,type:'ordinary'},
      {id:'sample-grant-welcome',source:'新人礼包',amount:5,at,type:'welcome'},
    ],
    draws:[
      {id:'sample-batch-ordinary',pool:'ordinary',at:at + 3600000,rewards:[{...vouchers[1]}]},
      {id:'sample-batch-welcome',pool:'welcome',at:at + 1000,rewards:[
        {id:'sample-card-physical',type:'physical',prizeId:'coin',at},
        {...vouchers[0]},
        ...Array.from({length:3},(_,i) => ({id:`sample-card-voucher-${i}`,type:'voucher',at,expiresAt:at + 7 * 86400000,used:false})),
      ]},
    ],
    vouchers:[...vouchers,...Array.from({length:3},(_,i) => ({id:`sample-card-voucher-${i}`,type:'voucher',at,expiresAt:at + 7 * 86400000,used:false}))],
  };
}

// Read the old session as it was stored. Neither rendering nor switching events
// changes its key, dates, clock mode, balances, addresses, or historical records.
export function readLegacy(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(CARD_KEY));
    const state = saved?.state;
    if(state?.version === 1 && Array.isArray(state.draws) && Array.isArray(state.ledger)) {
      return {state:{...state,vouchers:state.vouchers || [],addresses:state.addresses || {}},isDemo:false};
    }
  } catch {}
  return {state:legacyFixture(),isDemo:true};
}

export function legacyInventory(state) {
  const inventory = cardTicketInventory(state, Math.max(CARD_END, Date.now()));
  return {...inventory, used:inventory.lots.filter(lot => lot.used > 0)};
}

export function ticketRows(inventory, status='unused') {
  const lots = inventory[status] || [];
  if(!lots.length)return empty(status === 'used' ? '还没有使用记录' : status === 'expired' ? '暂无已过期抽奖券' : '暂无未使用抽奖券', status === 'unused' ? '完成活动品类的专家鉴定，积累下一次好运。' : '每一张抽奖券的去向，都保留在这里。');
  return `<div class="ac-list">${lots.map(lot => {
    const pool = lot.pool || lot.type;
    const amount = status === 'used' ? lot.used : lot.remaining;
    return `<article class="ac-list-row is-${status}"><span class="ac-list-icon ${pool === 'advanced' ? 'is-gold' : ''}">${icon(pool === 'advanced' ? 'crown' : 'ticket')}</span><div class="ac-list-copy"><strong>${poolName(pool)}</strong><p>${escapeHTML(lot.source)} · ${time(lot.at)}<br>${lot.sourceKey === 'daily' ? '每日赠券 · 当天有效' : `有效至 ${date(lot.expiresAt - 1)}`}</p></div><div class="ac-list-value">${status === 'used' ? `已使用 ${amount}` : status === 'expired' ? `已过期 ${amount}` : amount}<small>张</small></div></article>`;
  }).join('')}</div>`;
}

let currentEvent = null, route = 'lottery', selectedPool = 'ordinary', detailTab = 'tickets', ticketStatus = 'unused', prizeFilter = 'all';
let ui = EventUI, toastTimer = null, lastFocus = null, renderQueued = false, drawing = false, machineController = null;
const $ = id => document.getElementById(id);
const legacyData = () => readLegacy(globalThis.localStorage);
const legacyNow = () => Math.max(CARD_END,Date.now());

export function eventRules(state) {
  return `<div class="ac-rules"><h3>参与规则</h3><ol>
    <li>活动时间为 2026 年 10 月 27 日 00:00 至 11 月 11 日 00:00（北京时间）。11 月 11 日当天已结束。</li>
    <li>${ACTIVITY_CATEGORIES.map(category => escapeHTML(category.name)).join('、')} 专家鉴定提交成功后计入活动。累计每 2 单送 1 张普通抽奖券，每 10 单送 1 张高级抽奖券，该节点不同时赠送普通券。跨天累计，无上限。</li>
    <li>每天首次进入自动赠送 1 张普通抽奖券，仅当天有效，未使用不延续到次日。鉴定获得的抽奖券在活动结束时失效，使用时优先消耗即将到期的券。</li>
    <li>先选择券种，再单次或五次抽取。五连扭蛋消耗 5 张同类券，普通券与高级券不能混用。</li>
    <li>本活动普通池与高级池合计，每位用户最多获得 1 次实物奖品，与卡牌活动独立。各池内有库存的实物等概率抽取。实物全部抽完或用户已中过实物时，实物概率转为鉴定券：鉴定券 80%，再接再厉 20%。</li>
    <li>抽中的专家鉴定券每张可兑换 1 次免费专鉴，统一有效至 2026 年 12 月 12 日 23:59:59。</li>
    <li>鉴真王者、避雷王者分别按活动期间出具的专家鉴真、鉴假结果计数。并列时先达到该单数者在前。鉴真榜前三名每人获 200 元现金红包与称号，避雷榜前三名每人获称号及不限品类、次数的终身免费专鉴权益。同一用户可同时获得两榜奖励。</li>
  </ol><p>奖品图片为展示效果，具体规格以后续活动说明为准。当前为交互体验版，鉴定、抽奖及榜单均为演示数据。</p></div>`;
}

function poolRules(state) {
  return ['advanced','ordinary'].map(pool => `<section><header class="ac-pool-head ${pool === 'advanced' ? 'is-advanced' : ''}">${icon(pool === 'advanced' ? 'crown' : 'ticket')}<h3>${pool === 'advanced' ? '高级' : '普通'}奖池</h3><small>使用${poolName(pool)}</small></header><div class="ac-product-grid">${PRIZES.filter(prize => prize.pool === pool).map(prize => `<article class="ac-product" data-pool="${pool}"><div class="ac-product-art">${prizeArt(prize.id)}</div><strong>${escapeHTML(prize.name)}</strong>${state.stocks?.[prize.id] === 0 ? '<small>已抽完</small>' : prize.quantity == null ? '<small>精选小样 · 规格待公布</small>' : ''}</article>`).join('')}</div><div class="ac-probabilities ${pool === 'advanced' ? 'is-advanced' : ''}"><span><strong>${pool === 'advanced' ? '5' : '8'}%</strong>实物好礼</span><span><strong>${pool === 'advanced' ? '75' : '72'}%</strong>专家鉴定券</span><span><strong>20%</strong>再接再厉</span></div></section>`).join('') + eventRules(state);
}

function render() {
  if(!$('ac-content') || drawing)return;
  const state = loadEvent(), now = eventNow(), old = legacyData();
  document.title = `${route === 'prizes' ? '我的奖品' : '抽奖中心'} · 图灵鉴X`;
  document.querySelectorAll('#center-tabs button').forEach(node => {
    const selected = node.dataset.action === `route-${route}`;
    node.setAttribute('aria-selected',String(selected));node.tabIndex=selected?0:-1;
  });
  $('ac-content').setAttribute('aria-labelledby',`tab-${route}`);
  $('ac-content').innerHTML = route === 'prizes' ? unifiedPrizesMarkup(state,old.state,now,{legacyNow:legacyNow(),isDemo:old.isDemo}) : currentEvent === 'expert' ? expertLotteryMarkup(state,now,{pool:selectedPool,ticketStatus}) : currentEvent === 'card-past' ? cardLotteryMarkup(old.state,legacyNow(),ticketStatus,{isDemo:old.isDemo}) : activityChoiceMarkup(state,now);
  ui.focusProgress($('ac-content'));
}

function scheduleRender() {
  if(renderQueued)return;
  renderQueued = true;
  requestAnimationFrame(() => {renderQueued=false;render();});
}

function navigate(next, notify=true) {
  stopInlineDraw();
  route = next === 'prizes' ? 'prizes' : 'lottery';
  history.replaceState(null,'',`#${route}`);
  if(notify)window.jianxRoute?.(route);
  render();
  $('ac-content').scrollTo?.({top:0,behavior:'auto'});
}

function toast(message) {
  $('ac-toast').textContent = message;
  $('ac-toast').classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('ac-toast').classList.remove('is-visible'),2800);
}

function modal(title, content) {
  lastFocus = document.activeElement;
  $('ac-dialog').innerHTML = `<header class="ac-dialog-head"><h2 id="ac-dialog-title">${title}</h2><button class="ac-icon-button" data-action="close" aria-label="关闭弹窗">${icon('close')}</button></header><div class="ac-dialog-body">${content}</div>`;
  if(!$('ac-dialog').open)$('ac-dialog').showModal();
}

function closeModal() {
  $('ac-dialog').close();
  lastFocus?.focus?.();
}

function showEarnings() {
  const inventory = currentEvent === 'card-past' ? legacyInventory(legacyData().state) : ticketInventory(loadEvent(),eventNow());
  modal('抽奖券获得记录', inventory.lots.length ? `<div class="ac-list">${inventory.lots.map(lot => `<article class="ac-list-row"><span class="ac-list-icon ${(lot.pool || lot.type) === 'advanced' ? 'is-gold' : ''}">${icon('ticket')}</span><div class="ac-list-copy"><strong>${escapeHTML(lot.source)}</strong><p>${poolName(lot.pool || lot.type)} · ${time(lot.at)}<br>已使用 ${lot.used || 0} 张 · ${lot.expiresAt <= (currentEvent === 'card-past' ? Date.now() : eventNow()) ? '已过期' : '剩余'} ${lot.remaining} 张</p></div><div class="ac-list-value">+${lot.total ?? lot.amount}<small>张</small></div></article>`).join('')}</div>` : empty('暂无获券记录','每日赠券与鉴定奖励都会记录在这里。'));
}

function showAddress(id) {
  const state = loadEvent(), reward = earnedPrizes(state).find(item => item.id === id && item.type === 'physical');
  if(!reward)return;
  const address = state.addresses[id] || {};
  modal('收下这份好礼', `<p>填写收货信息，保存后可随时修改。</p><form class="ac-address-form" id="ac-address-form" novalidate data-prize-id="${escapeHTML(id)}">${[['name','收货人','请输入收货人姓名'],['phone','手机号码','请输入 11 位手机号'],['region','所在地区','省 / 市 / 区'],['detail','详细地址','街道、小区与门牌号']].map(([key,label,placeholder]) => `<label class="ac-field">${label}<input name="${key}" value="${escapeHTML(address[key] || '')}" placeholder="${placeholder}" ${key === 'phone' ? 'inputmode="tel" maxlength="11"' : 'maxlength="100"'} autocomplete="off" required aria-describedby="ac-error-${key}"><span class="ac-field-error" id="ac-error-${key}"></span></label>`).join('')}<button type="button" class="ac-link" data-action="sample-address">填入演示地址</button><p class="ac-form-note">体验版请使用演示地址。信息仅保存在当前浏览器。</p><button type="submit" class="ac-primary">保存收货信息</button></form>`);
}

function claimForToday() {
  const result = claimDaily(loadEvent(),eventNow());
  if(result.awarded)saveEvent(result.state);
}

function cardPhoto(prize,small=false){
 const [x,y,w,h]=prize.crop,scale=(small?72:104)/h;
 return `<div class="cl-prize-art ${small?'small':''}"><span role="img" aria-label="${escapeHTML(prize.name)}" style="width:${w*scale}px;height:${h*scale}px;background-image:url('assets/prize-source.jpg');background-size:${1532*scale}px ${1256*scale}px;background-position:${-x*scale}px ${-y*scale}px"></span></div>`;
}

function stopInlineDraw(){machineController?.destroy();machineController=null;drawing=false;}
function showDrawResult(batch){
 const state=loadEvent(),firstGuide=ui.isFirstGuideBatch(batch,state);
 const dialog=ui.showEventDialog(firstGuide?'双11专鉴有礼':'扭蛋结果',ui.resultMarkup(batch,{firstGuide,currentCount:ui.eventCount(state)}),{className:`ev-center-result ev-result-dialog${firstGuide?' ev-onboarding-result':''}`,celebration:batch.rewards.some(r=>r.type==='physical')?'physical':batch.rewards.some(r=>r.type==='voucher')?'voucher':'none'});
 dialog.querySelector('[data-result-prizes]')?.addEventListener('click',()=>{dialog.close('navigate');navigate('prizes');});
 dialog.querySelector('[data-result-expert]').onclick=()=>{dialog.close('navigate');ui.goExpert();};
 dialog.querySelector('[data-result-again]')?.addEventListener('click',()=>{dialog.close('repeat');startInlineDraw(batch.rewards.length);});
 dialog.querySelector('[data-result-later]')?.addEventListener('click',()=>dialog.close('dismiss'));
}
function startInlineDraw(count){
 if(drawing || ![1,5].includes(count))return;
 const response=EventModel.draw(loadEvent(),{pool:selectedPool,count,requestId:crypto.randomUUID()},eventNow());
 if(response.error){toast(response.error);render();return;}
 // Lock before saving: storage notifications must not replace a running machine.
 drawing=true;saveEvent(response.state);
 $('ac-content').querySelectorAll('[data-action^="draw:"],[data-action^="pool:"]').forEach(button=>button.disabled=true);
 $('ac-content').querySelectorAll('[data-action^="draw:"] small').forEach(hint=>hint.textContent='正在开奖');
 $('ac-content').querySelector('[data-action="skip-draw"]').hidden=false;
 machineController=mountMachine($('ac-content').querySelector('.gm-machine'));
 machineController.play({count,pool:selectedPool,onReveal:()=>{
   stopInlineDraw();render();showDrawResult(response.batch);
 }});
}
function showBatch(activity,id){
 const legacy=activity==='card',state=legacy?legacyData().state:loadEvent();
 const batch=state.draws.find(item=>item.id===id);
 if(!batch){toast('未找到对应抽奖记录');return;}
 modal('本次抽奖结果',batchResultMarkup(batch,{legacy,state,now:legacy?legacyNow():eventNow()}));
}
async function handleAction(action) {
  if(action === 'back'){
    if(route==='lottery'&&currentEvent){currentEvent=null;navigate('lottery');}
    else window.jianxNavigate?.('expert');return;
  }
  if(action === 'choose-activity'){currentEvent=null;navigate('lottery');return;}
  if(action === 'nav-lottery')action='route-lottery';
  if(action.startsWith('route-')){if(action==='route-lottery')currentEvent=null;navigate(action.slice(6));return;}
  if(action.startsWith('event:')){currentEvent=action.slice(6)==='expert'?'expert':'card-past';ticketStatus='unused';navigate('lottery');return;}
  if(action.startsWith('pool:')){if(!drawing){selectedPool=action.slice(5);render();}return;}
  if(action === 'skip-draw'){machineController?.skip();return;}
  if(action.startsWith('tickets-')){ticketStatus=action.slice(8);render();return;}
  if(action === 'go-expert'){window.jianxNavigate?.('expert',{intent:'open-expert'});return;}
  if(action === 'go-card'){window.jianxNavigate?.('card');return;}
  if(action === 'close'){closeModal();return;}
  if(action === 'earning-history'){showEarnings();return;}
  if(action === 'ticket-history'){modal('抽奖券获得记录',ticketHistory(legacyData().state,legacyNow()));return;}
  if(action === 'rules'){modal('卡牌活动规则',rulesMarkup());return;}
  if(action === 'earning-info'){modal('获券方式','<p>卡牌第一期已结束，下一期尚未开启。原新人五连抽、鉴定赠券、分享与邀请奖励将在新一期活动开始后开放。</p>'+rulesMarkup());return;}
  if(action === 'prize-pool'){modal('卡牌奖池',prizePool(cardPhoto));return;}
  if(action === 'expert-rules'){modal('双11奖池与规则',poolRules(loadEvent()));return;}
  if(action.startsWith('result:')){const [,activity,...id]=action.split(':');showBatch(activity,id.join(':'));return;}
  if(action.startsWith('voucher:')){
    const [,activity,...parts]=action.split(':'),id=parts.join(':'),state=activity==='card'?legacyData().state:loadEvent();
    const voucher=state.vouchers.find(item=>item.id===id);
    if(!voucher||voucher.used||(activity==='card'?legacyNow():eventNow())>=voucher.expiresAt){toast('该鉴别券已使用或已过期');return;}
    if($('ac-dialog').open)closeModal();window.jianxNavigate?.(activity==='card'?'card':'expert',activity==='card'?{}:{intent:'open-expert'});return;
  }
  if(action.startsWith('address:')){showAddress(action.slice(8));return;}
  if(action === 'sample-address'){
    const form = $('ac-address-form');
    for(const [key,value] of Object.entries({name:'体验用户',phone:'13800000000',region:'北京市 朝阳区',detail:'演示街道 100 号（不用于配送）'}))form.elements[key].value = value;
    return;
  }
  if(action === 'ranking'){ui.openLeaderboard();return;}
  if(action.startsWith('draw:') && currentEvent === 'expert' && !drawing)startInlineDraw(Number(action.slice(5)));
}

async function boot() {
  route = location.hash.slice(1) === 'prizes' ? 'prizes' : 'lottery';
  document.addEventListener('click',event => {
    const target = event.target.closest('[data-action]');
    if(target && !target.disabled)handleAction(target.dataset.action).catch(() => toast('暂时无法打开，请稍后重试'));
  });
  document.addEventListener('submit',event => {
    if(event.target.id !== 'ac-address-form')return;
    event.preventDefault();
    const form = event.target, address = Object.fromEntries(new FormData(form));
    Object.keys(address).forEach(key => address[key] = address[key].trim());
    const errors = validateAddress(address);
    Object.entries(errors).forEach(([key,message]) => {$(`ac-error-${key}`).textContent=message;form.elements[key].setAttribute('aria-invalid',String(Boolean(message)));});
    if(Object.values(errors).some(Boolean)){form.querySelector('[aria-invalid="true"]')?.focus();return;}
    const state = loadEvent(), id = form.dataset.prizeId;
    if(!earnedPrizes(state).some(reward => reward.id === id && reward.type === 'physical')){toast('未找到对应奖品');closeModal();return;}
    state.addresses[id] = address;
    saveEvent(state);
    closeModal();
    toast('收货信息已保存，可随时修改');
  });
  $('center-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();handleAction(`route-${event.key==='Home'?'lottery':event.key==='End'?'prizes':route==='prizes'?'lottery':'prizes'}`);
    $('center-tabs').querySelector('[aria-selected="true"]').focus();
  });
  $('ac-dialog').addEventListener('cancel',event=>{event.preventDefault();closeModal();});
  $('ac-dialog').addEventListener('click',event => {if(event.target === $('ac-dialog'))closeModal();});
  window.addEventListener('expert-event-change',scheduleRender);
  window.addEventListener('storage',event => {if(event.key === CARD_KEY)scheduleRender();});
  window.addEventListener('hashchange',() => navigate(location.hash.slice(1),false));
  window.addEventListener('jianx-shell',event => {
    const message = event.detail;
    if(message.type === 'visibility' && !message.active){stopInlineDraw();ui.closeEventDialog();if($('ac-dialog').open)closeModal();return;}
    if(message.type === 'visibility' && message.active){claimForToday();scheduleRender();}
    if(message.type !== 'activate')return;
    ({currentEvent,selectedPool,ticketStatus,detailTab,prizeFilter} = resolveActivityNavigation(
      {currentEvent,selectedPool,ticketStatus,detailTab,prizeFilter},message
    ));
    claimForToday();
    navigate(message.route,false);
    if(message.route === 'ranking')handleAction('ranking');
  });
  document.addEventListener('visibilitychange',() => {if(!document.hidden && window.jianxActive !== false){claimForToday();scheduleRender();}});
  claimForToday();
  render();
  window.jianxReady?.();
  if(location.hash === '#ranking')ui.openLeaderboard();
}

if(typeof document !== 'undefined')boot();
