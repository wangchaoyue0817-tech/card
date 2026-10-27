import {END,PRIZES,active,available} from './lottery-model.js';
import {esc,glyph} from './ui-common.js';
import {voucherMarkup,ticketEmblem} from './reward-ui.js';
import {ticketInventory} from './ticket-inventory.js';

const time = value => new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(value);
const expiry = value => new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(value);
const day = value => new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric'}).format(value);
const button = (text,action,style='cl-primary',disabled=false) => `<button class="${style}" data-action="${action}" ${disabled?'disabled':''}>${text}</button>`;
const earned = data => data.ledger.filter(row=>row.amount>0);
const totalEarned = data => earned(data).filter(row=>row.type==='ordinary').reduce((total,row)=>total+row.amount,0);
const totalUsed = data => -data.ledger.filter(row=>row.amount<0&&row.type==='ordinary').reduce((total,row)=>total+row.amount,0);

export function ticketPanel(data,now,recordType='unused',options={}) {
  const balance=available(data,now), newcomer=data.welcome;
  const inventory=ticketInventory(data,now);
  return `<section class="center-wallet" aria-label="可用抽奖券">
    <div class="center-wallet-heading"><span>${ticketEmblem()}普通抽奖券</span><button class="cl-text-button" data-action="rules">使用规则 ${glyph('info')}</button></div>
    <div class="center-wallet-balance"><strong>${balance.ordinary}</strong><span>张可用</span><div><span>累计获得 <b>${totalEarned(data)}</b></span><span>累计使用 <b>${totalUsed(data)}</b></span></div></div>
    <p class="center-validity">适用于卡牌抽奖 · ${expiry(END-1)} 到期</p>
    <div class="cl-draw-buttons">${button('抽一次 <small>使用 1 张普通券</small>','draw-one','cl-secondary',balance.ordinary<1)}${button('五连抽 <small>使用 5 张普通券</small>','draw-five','cl-primary',balance.ordinary<5)}</div>
    ${!active(now)?`<p class="center-wallet-note">${now>=END?`活动已结束${data.ordinary?`，${data.ordinary} 张未使用普通券已失效`:''}；获券与中奖记录仍可查看。`:'活动尚未开始，开始后可使用抽奖券。'}</p>`:''}
  </section>
  ${balance.welcome?`<section class="center-newcomer"><div class="center-newcomer-icon">${ticketEmblem()}</div><div><strong>新人专属抽奖券 <b>5 张</b></strong><p>${expiry(newcomer.expiresAt)} 到期</p><small>仅限一次性五连抽 · 中奖率 100%</small></div>${button('五连抽','draw-welcome','cl-gold')}</section>`:''}
  <div class="center-utilities"><button class="center-utility" data-action="earning-info"><span class="cl-small-icon">${glyph('cards')}</span><span><strong>获券方式</strong><small>发现更多抽奖机会</small></span>${glyph('caret-right')}</button><button class="center-utility" data-action="prize-pool"><span class="cl-small-icon gold">${glyph('handbag')}</span><span><strong>查看奖池</strong><small>好礼值得期待</small></span>${glyph('caret-right')}</button></div>
  <section class="center-records" aria-label="抽奖券明细"><header class="center-section-heading"><h2>我的抽奖券</h2><button class="cl-text-button" data-action="ticket-history">获得记录 ${glyph('caret-right')}</button></header><div class="center-ticket-states" role="group" aria-label="抽奖券状态">${[['unused','未使用'],['used','已使用'],['expired','已过期']].map(([key,label])=>`<button aria-pressed="${recordType===key}" data-action="tickets-${key}">${label}<b>${inventory.counts[key]}</b></button>`).join('')}</div>
  ${recordType==='used'?usageRecords(data,options):ticketCards(inventory[recordType==='expired'?'expired':'unused'],recordType==='expired')}
  </section><p class="center-ledger-note">${recordType==='used'?(options.ticketOnly?'中奖记录统一保存在「我的奖品」。':'每笔记录对应一次抽奖，点击可查看本次完整结果。'):'同批券部分使用后，仅剩余未用张数留在未使用列表。'}</p>`;
}

function ticketCards(lots,expired){
  if(!lots.length)return `<div class="cl-empty">${glyph('cards')}<h3>${expired?'暂无已过期抽奖券':'暂无未使用抽奖券'}</h3><p>${expired?'过期且未使用的抽奖券会保留在这里。':'鉴定、分享奖励或邀请注册获得的券，都会记录在这里。'}</p></div>`;
  return lots.map(lot=>`<article class="inventory-ticket ${expired?'is-expired':''}"><div class="inventory-ticket-strip">LUCKY TICKET</div><div class="inventory-ticket-copy"><div class="inventory-ticket-title"><strong>${lot.type==='welcome'?'新人专属抽奖券':'卡牌专属抽奖券'}</strong><span>${expired?'已过期':'未使用'}</span></div><p>${esc(lot.source)} · ${time(lot.at)} 获得</p><small>有效至 ${expiry(lot.expiresAt===END?END-1:lot.expiresAt)}</small><div class="inventory-ticket-footer"><b>${lot.remaining}<small> 张${lot.used?'剩余':''}</small></b>${button(expired?'已过期':lot.type==='welcome'?'立即五连抽':'去抽奖',lot.type==='welcome'?'draw-welcome':'draw-one','cl-primary',expired)}</div></div></article>`).join('');
}

export function ticketHistory(data,now){
  const inventory=ticketInventory(data,now);
  if(!inventory.lots.length)return '<div class="cl-empty"><h3>还没有获得抽奖券</h3><p>每次到账记录会保存在这里。</p></div>';
  return `<div class="center-ledger">${inventory.lots.map(lot=>`<article class="center-ledger-row"><span class="cl-small-icon">${glyph('cards')}</span><div><strong>${esc(lot.source)}</strong><p>${time(lot.at)} · ${lot.type==='welcome'?'新人专属券':'普通抽奖券'}</p><small>已使用 ${lot.used} 张 · ${now>=lot.expiresAt?'已过期':'未使用'} ${lot.remaining} 张</small></div><b>+${lot.total}<small>张</small></b></article>`).join('')}</div><p class="center-ledger-note">同到期日的普通抽奖券，按到账顺序优先使用。</p>`;
}

function usageRecords(data,{ticketOnly=false}={}){
  if(ticketOnly){
    const uses=data.ledger.filter(row=>row.amount<0);
    return uses.length?`<div class="center-ledger">${uses.map(row=>`<article class="center-ledger-row"><span class="cl-small-icon">${glyph('cards')}</span><div><strong>${esc(row.source)}</strong><p>${time(row.at)} · ${row.type==='welcome'?'新人专属券':'普通抽奖券'}</p></div><b>−${Math.abs(row.amount)}<small>张</small></b></article>`).join('')}</div>`:'<div class="cl-empty"><h3>还没有使用记录</h3></div>';
  }
  if(!data.draws.length)return `<div class="cl-empty">${glyph('cards')}<h3>还没有使用记录</h3><p>每次抽奖的券数与中奖结果<br>会一起记录在这里。</p></div>`;
  const groups=new Map();data.draws.forEach(batch=>{const key=day(batch.at);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(batch);});
  return [...groups].map(([label,batches])=>`<section class="center-date-group"><h3>${label}</h3><div class="center-ledger">${batches.map(batch=>{
    const physical=batch.rewards.find(r=>r.type==='physical'),coupons=batch.rewards.filter(r=>r.type==='voucher').length;
    const summary=[physical?PRIZES.find(p=>p.id===physical.prizeId).name:'',coupons?`专家鉴定券 ×${coupons}`:''].filter(Boolean).join(' · ');
    return `<button class="center-usage-row" data-action="result-${batch.id}"><div class="center-usage-heading"><strong>${batch.pool==='welcome'?'新人五连抽':batch.rewards.length===5?'普通五连抽':'普通单抽'}</strong><b>−${batch.rewards.length}<small>张</small></b></div><p>${time(batch.at)} · ${batch.pool==='welcome'?'新人专属券':'普通抽奖券'}</p><div class="center-usage-result"><span>${esc(summary)}</span>${glyph('caret-right')}</div></button>`;
  }).join('')}</div></section>`).join('');
}

export function prizePanel(data,now,photo) {
  const physical=data.draws.flatMap(batch=>batch.rewards).filter(reward=>reward.type==='physical');
  const rewards=data.draws.reduce((sum,batch)=>sum+batch.rewards.length,0);
  return `<section class="center-prize-overview" aria-label="中奖汇总"><div><strong>${rewards}</strong><span>累计获得奖品</span></div><div><strong>${physical.length}</strong><span>实物奖品</span></div><div><strong>${data.vouchers.length}</strong><span>专家鉴定券</span></div></section>
  <div class="center-prize-hint">${glyph('shield-check')}<p>鉴定券中奖后自动到账，有效期一周；实物奖品请填写收货信息。</p></div>
  <section aria-label="抽奖获得的奖品"><header class="center-section-heading"><h2>中奖记录</h2><span>${data.draws.length} 次抽奖</span></header>
  ${data.draws.length?data.draws.map(batch=>{
    const coupons=batch.rewards.filter(reward=>reward.type==='voucher');
    return `<article class="center-reward-batch"><header><span>${time(batch.at)}</span><b>${batch.pool==='welcome'?'新人五连抽':batch.rewards.length===5?'普通五连抽':'普通单抽'}</b></header>
      ${batch.rewards.filter(reward=>reward.type==='physical').map(reward=>{
        const prize=PRIZES.find(item=>item.id===reward.prizeId),address=data.addresses[reward.id];
        return `<div class="center-physical-reward"><div class="cl-owned-product">${photo(prize,true)}<div><small>实物奖品</small><h3>${esc(prize.fullName||prize.name)}</h3><p>${prize.spec} × 1</p></div></div>${address?`<div class="cl-saved-address"><strong>${esc(address.name)} · ${esc(address.phone.slice(0,3)+'****'+address.phone.slice(-4))}</strong><p>${esc(address.region)} ${esc(address.detail)}</p></div>`:''}${button(address?'修改收货信息':'填写收货信息',`address-${reward.id}`,'cl-gold cl-full')}<p class="cl-footnote">活动结束后 7 个工作日内寄出</p></div>`;
      }).join('')}
      ${coupons.length?voucherMarkup(coupons.length,coupons[0].expiresAt):''}
      <button class="center-result-link" data-action="result-${batch.id}">查看本次抽奖结果 ${glyph('caret-right')}</button>
    </article>`;
  }).join(''):`<div class="cl-empty">${glyph('handbag')}<h3>还没有中奖记录</h3><p>使用抽奖券后，抽中的实物和鉴定券<br>都会保存在这里。</p>${button('查看我的抽奖券','nav-lottery','cl-secondary')}</div>`}
  </section>`;
}

export function prizePool(photo) {
  return `<p class="cl-muted">当前卡牌抽奖可获得以下奖品，具体规则以活动说明为准。</p><div class="cl-prize-grid center-pool">${PRIZES.map(prize=>`<article class="cl-prize-card">${photo(prize)}<span class="cl-prize-qty">${prize.quantity} 份</span><h3>${esc(prize.name)}</h3><p>${prize.spec}</p></article>`).join('')}</div>${voucherMarkup(1,null)}`;
}
