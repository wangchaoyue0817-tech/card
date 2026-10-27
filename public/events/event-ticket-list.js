import {ticketInventory} from './expert-event-model.js';
import {rewardArt} from './expert-event-ui.js';

const states=[['unused','未使用'],['used','已使用'],['expired','已过期']];
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const dateTime=value=>new Date(value+8*3600000).toISOString().slice(5,16).replace('T',' ');
const poolName=pool=>pool==='advanced'?'高级抽奖券':'普通抽奖券';

export function eventTicketRowsMarkup(inventory,status='unused') {
  const selected=states.some(([value])=>value===status)?status:'unused';
  const lots=inventory[selected]||[];
  if(!lots.length) {
    return `<div class="et-empty">${rewardArt('ordinary')}<p>${selected==='unused'?'暂无未使用抽奖券':selected==='used'?'暂无抽奖券使用记录':'暂无已过期抽奖券'}</p></div>`;
  }
  return `<div class="et-ticket-list">${lots.map(lot=>{
    const amount=selected==='used'?lot.used:lot.remaining;
    const expires=`${dateTime(lot.expiresAt-1)} 到期`;
    return `<article class="et-ticket-row is-${selected}" data-ticket-id="${escape(lot.id)}">
      <span class="et-ticket-art" aria-hidden="true">${rewardArt(lot.pool)}</span>
      <div class="et-ticket-copy"><h4>${poolName(lot.pool)}</h4><p>${escape(lot.source)} · 获得于 ${dateTime(lot.at)}</p><small>${lot.sourceKey==='daily'?`每日赠券 · ${expires}`:expires}</small></div>
      <span class="et-ticket-amount"><b>${amount}</b> 张</span>
    </article>`;
  }).join('')}</div>`;
}

export function eventTicketPanelMarkup(state,now,status='unused') {
  const selected=states.some(([value])=>value===status)?status:'unused';
  const inventory=ticketInventory(state,now);
  return `<section class="et-tickets" aria-labelledby="et-title">
    <header class="et-ticket-heading"><h3 id="et-title">我的抽奖券</h3><button data-action="earning-history">获得记录</button></header>
    <div class="et-ticket-states" role="group" aria-label="抽奖券状态">
      ${states.map(([key,label])=>`<button data-action="tickets-${key}" aria-pressed="${selected===key}" aria-controls="et-ticket-records"><span>${label}</span><b>${inventory.counts[key]}</b></button>`).join('')}
    </div>
    <div id="et-ticket-records" class="et-ticket-records" aria-live="polite" aria-atomic="false">${eventTicketRowsMarkup(inventory,selected)}</div>
  </section>`;
}
