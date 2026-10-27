import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {earnedPrizes,eligibleOrderCount,recordMarkup,legacyFixture,readLegacy,legacyInventory,ticketRows,prizeMarkup,escapeHTML,resolveActivityNavigation,eventRules} from '../../public/events/activity-center.js';
import {START,END,VOUCHER_END,fresh,claimDaily,submitOrder,draw,ticketInventory} from '../../public/events/expert-event-model.js';
import {fresh as oldFresh,START as OLD_START,END as OLD_END,welcome as oldWelcome,draw as oldDraw} from '../../public/events/lottery-model.js';

const now = START + 10 * 3600000;

test('reward total excludes no-win results while the complete draw record retains them',() => {
  const state = fresh();
  state.draws = [{id:'batch',pool:'advanced',at:now,rewards:[
    {id:'none',type:'none'},
    {id:'voucher',type:'voucher',expiresAt:VOUCHER_END},
    {id:'physical',type:'physical',prizeId:'ysl-cushion'},
  ]}];
  assert.equal(earnedPrizes(state).length,2);
  assert.deepEqual(earnedPrizes(state).map(item => item.pool),['advanced','advanced']);
  const html = recordMarkup(state.draws[0]);
  assert.match(html,/再接再厉/);
  assert.match(html,/YSL气垫/);
  assert.match(html,/高级抽奖券/);
  assert.match(html,/reward-coupon/);
});

test('center progress includes only own eligible submissions during the activity',() => {
  const state = fresh('me');
  state.orders = [
    {uid:'me',category:'美妆',at:now,eligible:true},
    {uid:'me',category:'卡牌',at:now,eligible:false},
    {uid:'other',category:'美妆',at:now,eligible:true},
    {uid:'me',category:'美妆',at:END,eligible:true},
    {uid:'me',category:'手表',at:now,eligible:true},
    {uid:'me',category:'包袋',at:now,eligible:false},
  ];
  assert.equal(eligibleOrderCount(state),2);
});

test('center progress and visible rules use all seven shared activity categories',() => {
  const categories=['美妆','包袋','鞋靴','服饰','手表','数码家电','3C无损'];
  const state=fresh('me');
  state.orders=[...categories,'美妆无损','卡牌','珠宝玉石'].map(category=>({uid:'me',category,at:now,eligible:true}));
  assert.equal(eligibleOrderCount(state),7);
  const rules=eventRules(state);
  assert.ok(rules.includes(`${categories.join('、')} 专家鉴定提交成功后计入活动`));
  assert.doesNotMatch(rules,/数码3C|美妆无损/);
});

test('legacy session is displayed without writing, resetting, or upgrading original storage',() => {
  let state = oldWelcome(oldFresh('legacy',OLD_START),OLD_START+100).state;
  state = oldDraw(state,'welcome',5,OLD_START+200,() => .9).state;
  const original = JSON.stringify({state,mode:'demo',clockBase:OLD_START,clockReal:Date.now()});
  let writes = 0;
  const storage = {getItem:key => {assert.equal(key,'jianx-card-preview-v1');return original;},setItem:() => {writes++;}};
  const loaded = readLegacy(storage);
  assert.equal(loaded.isDemo,false);
  assert.deepEqual(loaded.state,state);
  const inventory = legacyInventory(loaded.state);
  assert.equal(inventory.counts.used,5);
  assert.equal(inventory.counts.expired,0);
  assert.equal(writes,0);
  assert.equal(JSON.stringify({state:loaded.state,mode:'demo',clockBase:OLD_START,clockReal:JSON.parse(original).clockReal}),original);
});

test('missing legacy storage produces a labelled fixture without persisting fabricated history',() => {
  const storage = {getItem:() => null,setItem:() => {throw new Error('must not write');}};
  const loaded = readLegacy(storage);
  assert.equal(loaded.isDemo,true);
  const inventory = legacyInventory(loaded.state);
  assert.equal(inventory.counts.unused,0);
  assert.equal(inventory.counts.expired,2);
  assert.equal(inventory.counts.used,6);
  assert.equal(earnedPrizes(loaded.state).length,6);
  assert.ok(loaded.state.vouchers.some(item => item.used));
  assert.ok(loaded.state.vouchers.some(item => !item.used && item.expiresAt < OLD_END+1));
});

test('daily ticket is presented as same-day only and keeps used/expired portions separate',() => {
  let state = claimDaily(fresh(),now).state;
  let inventory = ticketInventory(state,now);
  assert.match(ticketRows(inventory),/每日赠券 · 当天有效/);
  state = draw(state,{pool:'ordinary',count:1,requestId:'first'},now+1,() => .9).state;
  inventory = ticketInventory(state,now+86400000);
  assert.equal(inventory.counts.used,1);
  assert.equal(inventory.counts.expired,0);
  assert.match(ticketRows(inventory,'used'),/已使用 1/);
  assert.doesNotMatch(ticketRows(inventory,'expired'),/已过期 1/);
});

test('new prizes retain their source pool, fixed voucher expiry, and address editing controls',() => {
  const state = fresh();
  const physical = {id:'p',type:'physical',prizeId:'coach-wallet',pool:'advanced',at:now};
  let html = prizeMarkup(physical,state,now);
  assert.match(html,/高级抽奖券/);
  assert.match(html,/填写收货信息/);
  state.addresses.p = {name:'体验用户',phone:'13800000000',region:'北京市 朝阳区',detail:'演示街道 100 号'};
  html = prizeMarkup(physical,state,now);
  assert.match(html,/138\*\*\*\*0000/);
  assert.match(html,/修改收货信息/);
  const voucher = {id:'v',type:'voucher',pool:'ordinary',at:now,expiresAt:VOUCHER_END};
  assert.match(prizeMarkup(voucher,state,now),/2026\/12\/12 23:59/);
  assert.match(prizeMarkup(voucher,state,now),/去使用/);
  assert.match(prizeMarkup(voucher,state,VOUCHER_END),/已过期/);
  assert.doesNotMatch(prizeMarkup(voucher,state,VOUCHER_END),/去使用/);
});

test('legacy prizes retain original expiry and do not offer mutation of the retired campaign',() => {
  const state = legacyFixture();
  for(const reward of earnedPrizes(state)){
    const html = prizeMarkup(reward,state,END,true);
    assert.doesNotMatch(html,/data-action="address:/);
    assert.doesNotMatch(html,/data-action="go-expert"/);
    assert.match(html,/卡牌第一期/);
  }
  const voucher = earnedPrizes(state).find(item => item.type === 'voucher');
  assert.doesNotMatch(prizeMarkup(voucher,state,END,true),/2026\/12\/12/);
});

test('user content is escaped in historical prize and address views',() => {
  const state = fresh();
  state.addresses.p = {name:'<img onerror=alert(1)>',phone:'13800000000',region:'<script>',detail:'a & b'};
  const html = prizeMarkup({id:'p',type:'physical',prizeId:'ysl-cushion',pool:'ordinary',at:now},state,now);
  assert.match(html,/&lt;img/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<img onerror/);
  assert.equal(escapeHTML('"<>&\''),'&quot;&lt;&gt;&amp;&#39;');
});

test('center restores the accessible original top tabs and uses an inline shared machine',async () => {
  const source = await readFile(new URL('../../public/events/activity-center.js',import.meta.url),'utf8');
  const html = await readFile(new URL('../../public/events/activity.html',import.meta.url),'utf8');
  assert.match(source,/mountMachine\(\$\('ac-content'\)\.querySelector\('\.gm-machine'\)\)/);
  assert.doesNotMatch(source,/ui\.openDraw\(/);
  assert.match(source,/currentEvent === 'expert' && !drawing/);
  assert.match(html,/REWARDS CENTER/);
  assert.match(html,/class="center-tab-switcher" role="tablist"/);
  assert.match(html,/id="tab-lottery" role="tab"[^>]*aria-controls="ac-content"[^>]*>抽奖券/);
  assert.match(html,/id="tab-prizes" role="tab"[^>]*aria-controls="ac-content"[^>]*>我的奖品/);
  assert.match(html,/id="ac-content"[^>]*role="tabpanel"/);
  assert.doesNotMatch(html,/ac-bottom-nav/);
  assert.match(html,/site-bridge\.js/);
  assert.match(html,/capsule-machine\.css/);
  assert.ok(html.indexOf('lottery-center.css')<html.indexOf('card-spectrum.css'));
  assert.ok(html.indexOf('center-tabs')<html.indexOf('<main id="ac-content"'));
});

test('card activity activation restores the original unused tab and resets stale detail views',()=>{
  const original={currentEvent:'expert',selectedPool:'advanced',ticketStatus:'unused',detailTab:'records',prizeFilter:'physical'};
  const next=resolveActivityNavigation(original,{event:'card-past'});
  assert.deepEqual(next,{
    currentEvent:'card-past',selectedPool:'advanced',ticketStatus:'unused',detailTab:'tickets',prizeFilter:'all'
  });
  assert.equal(original.detailTab,'records');
  assert.equal(original.currentEvent,'expert');
});

test('explicit scene ticket filters override campaign defaults, including ended expert tickets',()=>{
  const current={currentEvent:'card-past',selectedPool:'ordinary',ticketStatus:'expired',detailTab:'rules',prizeFilter:'voucher'};
  for(const ticketStatus of ['unused','used','expired']) {
    const next=resolveActivityNavigation(current,{event:'expert',pool:'advanced',ticketStatus});
    assert.equal(next.currentEvent,'expert');
    assert.equal(next.selectedPool,'advanced');
    assert.equal(next.ticketStatus,ticketStatus);
    assert.equal(next.detailTab,'tickets');
    assert.equal(next.prizeFilter,'all');
  }
  assert.equal(resolveActivityNavigation(current,{event:'card-next'}).ticketStatus,'unused');
  assert.equal(resolveActivityNavigation(current,{event:'card-next'}).currentEvent,'card-past');
});

test('invalid selectors and prize navigation preserve state, while generic lottery entry returns to activity selection',()=>{
  const current={currentEvent:'expert',selectedPool:'ordinary',ticketStatus:'used',detailTab:'records',prizeFilter:'voucher'};
  assert.deepEqual(resolveActivityNavigation(current,{event:'retired',pool:'welcome',ticketStatus:'all'}),current);
  assert.deepEqual(resolveActivityNavigation(current,{route:'prizes'}),current);
  assert.equal(resolveActivityNavigation(current,{pool:'advanced'}).selectedPool,'advanced');
  assert.equal(resolveActivityNavigation(current,{ticketStatus:'expired'}).ticketStatus,'expired');
  const generic=resolveActivityNavigation(current,{route:'lottery'});
  assert.equal(generic.currentEvent,null);
  assert.equal(current.currentEvent,'expert');
  assert.equal(resolveActivityNavigation(generic,{route:'lottery',event:'expert',pool:'advanced'}).currentEvent,'expert');
});
