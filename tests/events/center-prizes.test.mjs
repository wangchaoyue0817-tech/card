import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,START,VOUCHER_END} from '../../public/events/expert-event-model.js';
import {fresh as cardFresh,START as CARD_START,DAY} from '../../public/events/lottery-model.js';
import {unifiedPrizesMarkup,batchResultMarkup,prizeMarkup} from '../../public/events/center-prizes.js';
import {voucherMarkup} from '../../public/events/reward-ui.js';

const now=START+3600000;
const voucher=(id,expiresAt=VOUCHER_END)=>({id,type:'voucher',expiresAt,used:false});
const batch=(id,at,rewards,pool='ordinary')=>({id,at,rewards,pool});

test('both activities share the original prize summary and chronological result cards',()=>{
  const expert=fresh(),card=cardFresh();
  expert.draws=[batch('new',now,[voucher('new-v'),{id:'empty',type:'none'}],'advanced')];
  card.draws=[batch('old',CARD_START,[voucher('old-v',CARD_START+7*DAY),{id:'p',type:'physical',prizeId:'coin'}])];
  const before=JSON.stringify({expert,card});
  const html=unifiedPrizesMarkup(expert,card,now);
  assert.match(html,/center-prize-overview/);
  assert.match(html,/<strong>3<\/strong><span>累计获得奖品/);
  assert.match(html,/<strong>1<\/strong><span>实物奖品/);
  assert.match(html,/<strong>2<\/strong><span>专家鉴别券/);
  assert.match(html,/2 次抽奖/);
  assert.ok(html.indexOf('result:expert:new')<html.indexOf('result:card:old'));
  assert.match(html,/再接再厉/);
  assert.match(html,/assets\/prize-source\.jpg/);
  assert.match(html,/EXPERT PASS/);
  assert.equal((html.match(/专家线上鉴别券/g)||[]).length,2);
  assert.equal(JSON.stringify({expert,card}),before,'rendering must not mutate either campaign');
});

test('reward and batch deduplication is scoped to each activity',()=>{
  const expert=fresh(),card=cardFresh(),record=batch('shared',now,[voucher('same')]);
  expert.draws=[record,record,batch('duplicate-reward',now,[voucher('same')])];
  card.draws=[record];
  const html=unifiedPrizesMarkup(expert,card,now);
  assert.match(html,/<strong>2<\/strong><span>累计获得奖品/);
  assert.match(html,/2 次抽奖/);
  assert.equal((html.match(/data-action="result:expert:shared"/g)||[]).length,1);
  assert.equal((html.match(/data-action="result:card:shared"/g)||[]).length,1);
});

test('no-prize draws remain in history without increasing prize totals',()=>{
  const expert=fresh();
  expert.draws=[batch('none',now,[{id:'none',type:'none'}])];
  const html=unifiedPrizesMarkup(expert,cardFresh(),now);
  assert.match(html,/<strong>0<\/strong><span>累计获得奖品/);
  assert.match(html,/1 次抽奖/);
  assert.match(html,/再接再厉/);
  assert.match(html,/result:expert:none/);
  assert.doesNotMatch(html,/还没有中奖记录/);
});

test('voucher availability comes from current state and original expiry remains exact',()=>{
  const expert=fresh(),card=cardFresh();
  const old=voucher('old',CARD_START+7*DAY);
  assert.match(prizeMarkup(old,card,CARD_START,true),/2026\/10\/02 00:00/);
  assert.match(prizeMarkup(old,card,CARD_START,true),/voucher:card:old/);
  assert.doesNotMatch(prizeMarkup(old,card,now,true),/去使用/);
  assert.match(prizeMarkup(old,card,now,true),/已过期/);
  const current=voucher('v');
  assert.match(prizeMarkup(current,expert,now),/2026\/12\/12 23:59/);
  assert.match(prizeMarkup(current,expert,now),/voucher:expert:v/);
  expert.vouchers=[{...current,used:true}];
  assert.match(prizeMarkup(current,expert,now),/已使用/);
  assert.doesNotMatch(prizeMarkup(current,expert,now),/去使用/);
});

test('batch vouchers group only when expiry and current use status match',()=>{
  const state=fresh(),rewards=[voucher('a'),voucher('b'),voucher('c')];
  state.vouchers=[{...rewards[0],used:true},...rewards.slice(1)];
  const html=batchResultMarkup(batch('group',now,rewards),{state,now});
  assert.equal((html.match(/EXPERT PASS/g)||[]).length,2);
  assert.match(html,/×1/);
  assert.match(html,/×2/);
  assert.match(html,/已使用/);
  assert.match(html,/voucher:expert:b/);
});

test('new physical prizes allow address editing while historical addresses are read-only',()=>{
  const state=fresh(),physical={id:'p',type:'physical',prizeId:'coach-wallet',pool:'advanced'};
  assert.match(prizeMarkup(physical,state,now),/data-action="address:p"/);
  state.addresses.p={name:'<img onerror=alert(1)>',phone:'13800000000',region:'<script>',detail:'A & B'};
  const html=prizeMarkup(physical,state,now);
  assert.match(html,/修改收货信息/);
  assert.match(html,/138\*\*\*\*0000/);
  assert.match(html,/&lt;img/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<img onerror/);
  const legacy=prizeMarkup({...physical,prizeId:'coin'},state,now,true);
  assert.match(legacy,/保留原活动领取状态/);
  assert.match(legacy,/138\*\*\*\*0000/);
  assert.doesNotMatch(legacy,/data-action="address:/);
});

test('shared coupon keeps its original API and escapes optional content and actions',()=>{
  assert.match(voucherMarkup(2,now),/data-action="voucher-use"/);
  assert.match(voucherMarkup(2,now),/EXPERT PASS/);
  const html=voucherMarkup(1,now,{title:'<script>',category:'x & y',action:'"><img>',used:true});
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/x &amp; y/);
  assert.match(html,/disabled>已使用/);
  assert.doesNotMatch(html,/去使用|data-action/);
  assert.match(voucherMarkup(1,now,{action:'"><img>'}),/data-action="&quot;&gt;&lt;img&gt;"/);
});

test('empty history and legacy demo labeling remain explicit',()=>{
  const html=unifiedPrizesMarkup(fresh(),cardFresh(),now,{isDemo:true});
  assert.match(html,/还没有中奖记录/);
  assert.match(html,/data-action="nav-lottery"/);
  assert.match(html,/卡牌第一期为历史演示记录/);
  assert.doesNotMatch(html,/下一期/);
});
