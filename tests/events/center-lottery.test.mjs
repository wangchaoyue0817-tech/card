import test from 'node:test';
import assert from 'node:assert/strict';
import {activityChoiceMarkup,expertLotteryMarkup,cardLotteryMarkup} from '../../public/events/center-lottery.js';
import {START,END,fresh,claimDaily,submitOrder,draw} from '../../public/events/expert-event-model.js';
import {START as CARD_START,END as CARD_END,fresh as cardFresh,welcome as cardWelcome,draw as cardDraw} from '../../public/events/lottery-model.js';

const now=START+10*3600000;
const button=(html,action)=>{
  const tag=html.match(new RegExp(`<button\\b[^>]*data-action="${action}"[^>]*>`));
  assert.ok(tag,`Expected action ${action}`);
  return tag[0];
};
const disabled=(html,action)=>/\bdisabled(?:\s|>|=)/.test(button(html,action));
const drawHint=(html,count)=>html.match(new RegExp(`<button\\b[^>]*data-action="draw:${count}"[^>]*>[\\s\\S]*?<small>([^<]*)</small>`))?.[1];
function withOrders(count){
  let state=fresh('center-user');
  for(let i=1;i<=count;i++)state=submitOrder(state,{id:`order-${i}`,category:'美妆'},now+i).state;
  return state;
}

test('center starts with exactly two activity choices and keeps old and upcoming card periods together',()=>{
  const html=activityChoiceMarkup(claimDaily(fresh(),now).state,now);
  assert.deepEqual([...html.matchAll(/data-action="event:([^"]+)"/g)].map(match=>match[1]),['expert','card-past']);
  assert.match(html,/双11扭蛋活动/);
  assert.match(html,/卡牌抽奖活动/);
  assert.match(html,/第一期已结束 · 下期待开启/);
  assert.match(html,/可用 1 张券/);
  assert.doesNotMatch(html,/data-action="draw:|center-reward-batch|data-action="event:card-next"/);
});

test('activity chooser reflects not-started and ended state without hiding historical card access',()=>{
  for(const [at,label] of [[START-1,'即将开始'],[END,'已结束 · 查看抽奖券']]){
    const html=activityChoiceMarkup(fresh(),at);
    assert.ok(html.includes(label));
    assert.match(html,/data-action="event:card-past"/);
  }
});

test('Double 11 page puts both ticket types, inline machine and complete progress together',()=>{
  const state=withOrders(14),html=expertLotteryMarkup(state,now+100);
  for(const action of ['choose-activity','pool:ordinary','pool:advanced','draw:1','draw:5','ranking','go-expert']){
    assert.ok(button(html,action));
  }
  assert.match(html,/class="gm-machine\b/);
  assert.match(html,/普通抽奖券/);
  assert.match(html,/高级抽奖券/);
  assert.match(html,/class="ev-progress is-compact"[^>]*data-current="14"/);
  assert.match(html,/data-step="2"/);
  assert.match(html,/data-step="10"/);
  assert.match(html,/data-step="14"/);
  assert.match(html,/data-step="20"/);
  assert.ok(html.indexOf('data-action="pool:ordinary"')<html.indexOf('class="gm-machine'));
  assert.ok(html.indexOf('class="gm-machine')<html.indexOf('class="ev-progress'));
  assert.ok(html.indexOf('class="ev-progress')<html.indexOf('class="et-tickets"'));
  for(const action of ['tickets-unused','tickets-used','tickets-expired'])assert.ok(button(html,action));
  assert.doesNotMatch(html,/每一份认真|都有好运回应|选择一张好运入场券|下一颗惊喜|center-reward-batch|ac-record-group|中奖记录/);
});

test('Double 11 header promotes a crowned ranking entry and keeps coupon details solely in the inline inventory',()=>{
  const html=expertLotteryMarkup(withOrders(14),now+100);
  assert.match(button(html,'ranking'),/class="ac-ranking-entry"/);
  assert.match(button(html,'ranking'),/aria-label="查看专鉴王者榜"/);
  assert.match(html,/<span class="ac-ranking-emblem" aria-hidden="true"><svg/);
  assert.doesNotMatch(html,/data-action="ticket-details"|>明细</);
  assert.equal((html.match(/class="et-tickets"/g)||[]).length,1);
  assert.match(html,/我的抽奖券/);
  for(const action of ['tickets-unused','tickets-used','tickets-expired','earning-history'])assert.ok(button(html,action));
});

test('Double 11 preserves the selected inline ticket status independently from the selected pool',()=>{
  const state=withOrders(10);
  const html=expertLotteryMarkup(state,END,{pool:'advanced',ticketStatus:'expired'});
  assert.match(button(html,'pool:advanced'),/aria-selected="true"/);
  assert.match(button(html,'tickets-expired'),/aria-pressed="true"/);
  assert.match(html,/class="et-ticket-row is-expired"/);
  assert.match(html,/data-ticket-id="milestone-order-10"/);
  assert.match(html,/data-ticket-id="milestone-order-2"/);
});

test('draw controls use only the selected pool balance and never mix ordinary and advanced tickets',()=>{
  const state=withOrders(10),at=now+100;
  let html=expertLotteryMarkup(state,at,{pool:'ordinary'});
  assert.equal(disabled(html,'draw:1'),false);
  assert.equal(disabled(html,'draw:5'),true);
  assert.match(button(html,'pool:ordinary'),/aria-selected="true"/);
  html=expertLotteryMarkup(state,at,{pool:'advanced'});
  assert.equal(disabled(html,'draw:1'),false);
  assert.equal(disabled(html,'draw:5'),true);
  assert.match(button(html,'pool:advanced'),/aria-selected="true"/);
  const more=claimDaily(state,at).state;
  assert.equal(disabled(expertLotteryMarkup(more,at,{pool:'ordinary'}),'draw:5'),false);
  assert.equal(disabled(expertLotteryMarkup(more,at,{pool:'advanced'}),'draw:5'),true);
});

test('single and five draw states explain exact shortages for zero, one, four and five same-pool tickets',()=>{
  for(const pool of ['ordinary','advanced'])for(const amount of [0,1,4,5]){
    const state=fresh();
    const other=pool==='ordinary'?'advanced':'ordinary';
    state.tickets=[
      {id:'selected-pool',pool,source:'专鉴赠券',amount,remaining:amount,at:now,expiresAt:END},
      {id:'other-pool',pool:other,source:'专鉴赠券',amount:9,remaining:9,at:now,expiresAt:END}
    ];
    const html=expertLotteryMarkup(state,now,{pool}),name=pool==='advanced'?'高级':'普通';
    for(const count of [1,5]){
      const tag=button(html,`draw:${count}`);
      assert.match(tag,/\bclass="[^"]*\bdraw-state-button\b/);
      assert.match(tag,count===1?/\bcl-secondary\b/:/\bcl-primary\b/);
      assert.equal(disabled(html,`draw:${count}`),amount<count);
      assert.equal(drawHint(html,count),amount<count?`还差 ${count-amount} 张${name}券`:count===5?'使用 5 张同种券':`使用 1 张${name}券`);
    }
    if(pool==='advanced')assert.match(button(html,'draw:5'),/\bis-premium\b/);
  }
});

test('draw state copy prioritizes running and activity availability over ticket shortages',()=>{
  for(const pool of ['ordinary','advanced']){
    for(const [at,expected]of [[START-1,'活动尚未开始'],[END,'活动已结束']]){
      const html=expertLotteryMarkup(fresh(),at,{pool});
      for(const count of [1,5]){
        assert.equal(disabled(html,`draw:${count}`),true);
        assert.equal(drawHint(html,count),expected);
      }
    }
    for(const at of [START-1,now,END]){
      const html=expertLotteryMarkup(fresh(),at,{pool,drawing:true});
      for(const count of [1,5]){
        assert.equal(disabled(html,`draw:${count}`),true);
        assert.equal(drawHint(html,count),'正在开奖');
      }
    }
  }
});

test('empty, not-started and ended draws stay disabled even when stored tickets exist',()=>{
  assert.equal(disabled(expertLotteryMarkup(fresh(),now),'draw:1'),true);
  const state=withOrders(50);
  for(const at of [START-1,END]){
    for(const pool of ['ordinary','advanced']){
      const html=expertLotteryMarkup(state,at,{pool});
      assert.equal(disabled(html,'draw:1'),true);
      assert.equal(disabled(html,'draw:5'),true);
      assert.match(html,/gm-machine/);
      assert.match(html,/ev-progress/);
    }
  }
  assert.match(expertLotteryMarkup(state,END),/活动已结束，奖品与记录保留/);
});

test('an active draw locks pool switching and both draw controls, and exposes skip',()=>{
  const html=expertLotteryMarkup(withOrders(50),now+100,{pool:'advanced',drawing:true});
  for(const action of ['pool:ordinary','pool:advanced','draw:1','draw:5'])assert.equal(disabled(html,action),true);
  assert.doesNotMatch(button(html,'skip-draw'),/\bhidden\b/);
  assert.match(button(expertLotteryMarkup(fresh(),now),'skip-draw'),/\bhidden\b/);
});

test('daily ticket reminder gives its expiry without revealing the guide outcome rule',()=>{
  const state=claimDaily(fresh(),now).state,html=expertLotteryMarkup(state,now);
  assert.match(html,/每日赠券当天有效，优先使用/);
  assert.match(html,/免费扭一次/);
  assert.equal(disabled(html,'draw:1'),false);
  assert.equal(disabled(html,'draw:5'),true);
  assert.doesNotMatch(html,/首次.*(?:未中奖|必不中)|抽不中|固定未中奖/);
  const after=draw(state,{pool:'ordinary',count:1,requestId:'guide'},now+1,()=>.5).state;
  assert.equal(disabled(expertLotteryMarkup(after,now+2),'draw:1'),true);
});

test('card activity reuses the original wallet, utility cards and ticket filters without exposing retired draws',()=>{
  const state=cardFresh('legacy');
  const before=structuredClone(state),html=cardLotteryMarkup(state,CARD_END);
  for(const css of ['center-wallet','center-utilities','center-ticket-states'])assert.ok(html.includes(css));
  for(const action of ['draw-one','draw-five','earning-info','prize-pool','ticket-history','tickets-unused','tickets-used','tickets-expired','go-card'])assert.ok(button(html,action));
  assert.equal(disabled(html,'draw-one'),true);
  assert.equal(disabled(html,'draw-five'),true);
  assert.match(html,/活动已结束/);
  assert.match(html,/下期待开启/);
  assert.match(html,/暂无未使用抽奖券/);
  assert.match(html,/去鉴卡牌/);
  assert.deepEqual(state,before);
});

test('card used-ticket tab preserves debit records but keeps winning outcomes under My Prizes',()=>{
  let state=cardWelcome(cardFresh('legacy',CARD_START),CARD_START+100).state;
  state=cardDraw(state,'welcome',5,CARD_START+200,()=>.9).state;
  const snapshot=structuredClone(state),html=cardLotteryMarkup(state,CARD_END,'used');
  assert.match(html,/−5/);
  assert.match(html,/新人五连抽/);
  assert.doesNotMatch(html,/专家鉴定券 ×5|center-usage-result|data-action="result-|reward-coupon/);
  assert.deepEqual(state,snapshot);
});

test('only fixture card data carries an explicit historical-example label',()=>{
  const state=cardFresh();
  assert.match(cardLotteryMarkup(state,CARD_END,'unused',{isDemo:true}),/第一期历史示例，未写入你的卡牌记录/);
  assert.doesNotMatch(cardLotteryMarkup(state,CARD_END),/第一期历史示例/);
});
