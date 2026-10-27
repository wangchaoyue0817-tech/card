import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {claimCampaignWelcome,loadCampaign,CAMPAIGN_KEY} from '../../public/events/campaign-session.js';
import {rulesMarkup,grantMarkup} from '../../public/events/reward-ui.js';
import {START,fresh,welcome,draw} from '../../public/events/lottery-model.js';
import {readFileSync} from 'node:fs';
const memoryStorage=()=>{
  const values=new Map(),writes=[];
  return {values,writes,getItem:key=>values.get(key)||null,setItem:(key,value)=>{values.set(key,value);writes.push({key,value});}};
};
test('archived card campaign does not create a welcome gift or persist a new session',()=>{
  const storage=memoryStorage();
  const first=claimCampaignWelcome(storage),second=claimCampaignWelcome(storage);
  assert.equal(first.awarded,false);
  assert.equal(second.awarded,false);
  assert.equal(first.state.welcome,null);
  assert.equal(first.state.ledger.length,0);
  assert.equal(storage.values.size,0);
  assert.equal(storage.writes.length,0);
});
test('archived card campaign preserves existing rewards, address and ticket history exactly',()=>{
  const storage=memoryStorage(),now=START+12*3600000;
  let state=welcome(fresh('history-user',START+1),now).state;
  state=draw(state,'welcome',5,now,()=>0).state;
  const physical=state.draws[0].rewards.find(reward=>reward.type==='physical');
  state.addresses[physical.id]={name:'演示收货人',phone:'13800000000',region:'演示地区',detail:'演示地址'};
  const snapshot=JSON.stringify({state,mode:'demo',clockBase:now,clockReal:Date.now()});
  storage.setItem(CAMPAIGN_KEY,snapshot);
  const beforeWrites=storage.writes.length;
  const result=claimCampaignWelcome(storage);
  assert.equal(result.awarded,false);
  assert.deepEqual(result.state,state);
  assert.equal(storage.getItem(CAMPAIGN_KEY),snapshot);
  assert.equal(storage.writes.length,beforeWrites);
});
test('explicitly enabled legacy mode shares one newcomer entitlement across both entry points',()=>{
  const storage=memoryStorage(),now=START+12*3600000;
  storage.setItem(CAMPAIGN_KEY,JSON.stringify({state:fresh('new-legacy-user',START+1),mode:'demo',clockBase:now,clockReal:Date.now()}));
  const home=claimCampaignWelcome(storage,{enabled:true});
  const card=claimCampaignWelcome(storage,{enabled:true});
  assert.equal(home.awarded,true);
  assert.equal(card.awarded,false);
  assert.equal(loadCampaign(storage).state.ledger.length,1);
  assert.equal(loadCampaign(storage).state.ledger[0].amount,5);
  assert.ok(storage.values.has(CAMPAIGN_KEY));
});
test('all invitation UI uses mini-program sharing without copy links',()=>{const ui=readFileSync(new URL('../../public/events/card-app.js',import.meta.url),'utf8');assert.doesNotMatch(ui,/copy-invite|邀请链接|复制邀请|navigator\.clipboard/);assert.match(ui,/转发小程序，邀请好友/);assert.match(rulesMarkup(),/最后打开的小程序分享卡片/);});
test('daily quota is a compact note, not a progress dashboard',()=>{const html=grantMarkup({amount:1,expiresAt:Date.now(),today:4});assert.match(html,/grant-daily-note/);assert.doesNotMatch(html,/<progress|grant-progress/);});
test('shell routes have no old deployment addresses or excluded modules',()=>{for(const file of ['ui-common.js','app.js','site-shell.js','site-bridge.js']){const code=readFileSync(new URL('../../public/events/'+file,import.meta.url),'utf8');assert.doesNotMatch(code,/turing-ai-skin-spectrum|jianx-card-lottery-preview/);}const code=readFileSync(new URL('../../public/events/site-shell.js',import.meta.url),'utf8');assert.doesNotMatch(code,/\b(?:skin|skin-management|orders)\s*:/);assert.match(code,/card\s*:\s*['"]card['"]/);assert.match(code,/message.type\s*===\s*['"]new-chat['"]/);});

test('archived card controller cannot overwrite stored history or reset it from legacy scenarios',()=>{
  const code=readFileSync(new URL('../../public/events/card-app.js',import.meta.url),'utf8');
  const storage=memoryStorage();
  storage.setItem(CAMPAIGN_KEY,'original-history');
  const beforeWrites=storage.writes.length;
  const declaration=code.match(/const CARD_CAMPAIGN_ENABLED=false;[\s\S]*?const btn=/)[0].replace(/const btn=$/,'');
  const guardedScenario=code.match(/function scenario\(name\)\{[\s\S]*?  closeModal/)[0].replace(/  closeModal$/,'  throw new Error("Archive reset reached");}');
  vm.runInNewContext(`${declaration}\n${guardedScenario}\nsave();scenario('new');scenario('won');`,{localStorage:storage,KEY:CAMPAIGN_KEY,notify:()=>{}});
  assert.equal(storage.getItem(CAMPAIGN_KEY),'original-history');
  assert.equal(storage.writes.length,beforeWrites);
});
