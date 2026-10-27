import test from 'node:test';
import assert from 'node:assert/strict';
import {eventTicketPanelMarkup,eventTicketRowsMarkup} from '../../public/events/event-ticket-list.js';
import {START,END,DAY,fresh,claimDaily,submitOrder,draw,ticketInventory} from '../../public/events/expert-event-model.js';

const now=START+10*3600000;
const tab=(html,status)=>html.match(new RegExp(`<button[^>]+data-action="tickets-${status}"[^>]*>[\\s\\S]*?<\\/button>`))?.[0];
function orders(count) {
  let state=fresh('ticket-wallet');
  for(let i=1;i<=count;i++)state=submitOrder(state,{id:`order-${i}`,category:'美妆'},now+i).state;
  return state;
}

test('the inline wallet combines ordinary and advanced tickets and exposes three real status counts',()=>{
  const state=claimDaily(orders(10),now+100).state;
  const snapshot=structuredClone(state),html=eventTicketPanelMarkup(state,now+200);
  assert.match(html,/我的抽奖券/);
  assert.match(tab(html,'unused'),/aria-pressed="true"[\s\S]*未使用[\s\S]*<b>6<\/b>/);
  for(const status of ['used','expired'])assert.match(tab(html,status),/aria-pressed="false"[\s\S]*<b>0<\/b>/);
  assert.equal((html.match(/class="et-ticket-row/g)||[]).length,6);
  assert.match(html,/高级抽奖券/);
  assert.match(html,/普通抽奖券/);
  assert.match(html,/10-27 23:59 到期/);
  assert.match(html,/11-10 23:59 到期/);
  assert.doesNotMatch(html,/firstGuide|首次.*未中奖|guideTicketId/);
  assert.deepEqual(state,snapshot,'rendering a wallet must not claim or spend tickets');
});

test('a consumed daily ticket stays in used records after midnight while unspent daily tickets expire',()=>{
  let state=claimDaily(orders(2),now+20).state;
  state=draw(state,{pool:'ordinary',count:1,requestId:'daily'},now+30,()=>.9).state;
  const nextDay=now+DAY;
  state=claimDaily(state,nextDay).state;
  const later=nextDay+DAY,inventory=ticketInventory(state,later);
  assert.deepEqual(inventory.counts,{unused:1,used:1,expired:1});
  const unused=eventTicketPanelMarkup(state,later);
  const used=eventTicketPanelMarkup(state,later,'used');
  const expired=eventTicketPanelMarkup(state,later,'expired');
  assert.match(unused,/data-ticket-id="milestone-order-2"/);
  assert.doesNotMatch(unused,/data-ticket-id="daily-/);
  assert.match(used,/data-ticket-id="daily-2026-10-27"/);
  assert.doesNotMatch(used,/data-ticket-id="daily-2026-10-28"/);
  assert.match(expired,/data-ticket-id="daily-2026-10-28"/);
  assert.doesNotMatch(expired,/data-ticket-id="daily-2026-10-27"/);
  assert.match(tab(used,'used'),/aria-pressed="true"/);
  assert.match(tab(expired,'expired'),/aria-pressed="true"/);
  assert.doesNotMatch(used,/专家线上鉴别券|再接再厉|中奖记录/,'ticket debits must not become prize history');
});

test('remaining and used quantities of a partially consumed lot are shown separately at expiry',()=>{
  const state=fresh();
  state.tickets.push({id:'multi',pool:'advanced',source:'活动赠券',sourceKey:'milestone',amount:5,remaining:3,at:now,expiresAt:END});
  let inventory=ticketInventory(state,now+100);
  assert.deepEqual(inventory.counts,{unused:3,used:2,expired:0});
  assert.match(eventTicketRowsMarkup(inventory),/et-ticket-amount"><b>3<\/b>/);
  assert.match(eventTicketRowsMarkup(inventory,'used'),/et-ticket-amount"><b>2<\/b>/);
  inventory=ticketInventory(state,END);
  assert.deepEqual(inventory.counts,{unused:0,used:2,expired:3});
  assert.match(eventTicketRowsMarkup(inventory,'expired'),/et-ticket-amount"><b>3<\/b>/);
  assert.match(eventTicketRowsMarkup(inventory,'used'),/et-ticket-amount"><b>2<\/b>/);
});

test('an ended activity retains all used and expired ticket records without offering them for use',()=>{
  let state=orders(10);
  state=draw(state,{pool:'advanced',count:1,requestId:'advanced'},now+100,()=>.5).state;
  const used=eventTicketPanelMarkup(state,END,'used');
  const expired=eventTicketPanelMarkup(state,END,'expired');
  assert.match(tab(used,'unused'),/<b>0<\/b>/);
  assert.match(tab(used,'used'),/<b>1<\/b>/);
  assert.match(tab(used,'expired'),/<b>4<\/b>/);
  assert.match(used,/data-ticket-id="milestone-order-10"/);
  assert.equal((expired.match(/class="et-ticket-row/g)||[]).length,4);
  assert.doesNotMatch(used+expired,/data-action="draw:|data-action="voucher:/);
});

test('empty tabs are concise, unknown state falls back safely and persisted text is escaped',()=>{
  for(const status of ['unused','used','expired']) {
    const html=eventTicketPanelMarkup(fresh(),now,status);
    assert.match(html,/class="et-empty"/);
    assert.match(tab(html,status),/aria-pressed="true"/);
  }
  assert.match(tab(eventTicketPanelMarkup(fresh(),now,'invalid'),'unused'),/aria-pressed="true"/);
  const inventory={unused:[{id:'x"><script>',pool:'ordinary',source:'<script>bad()</script>',remaining:1,at:now,expiresAt:END}],used:[],expired:[]};
  const html=eventTicketRowsMarkup(inventory);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);
});
