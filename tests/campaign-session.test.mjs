import test from 'node:test';
import assert from 'node:assert/strict';
import {claimCampaignWelcome,loadCampaign,CAMPAIGN_KEY} from '../public/campaign-session.js';
import {rulesMarkup,grantMarkup} from '../public/reward-ui.js';
import {readFileSync} from 'node:fs';
test('home image and card page share one newcomer entitlement',()=>{const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};const home=claimCampaignWelcome(storage);const card=claimCampaignWelcome(storage);assert.equal(home.awarded,true);assert.equal(card.awarded,false);assert.equal(loadCampaign(storage).state.ledger.length,1);assert.equal(loadCampaign(storage).state.ledger[0].amount,5);assert.ok(values.has(CAMPAIGN_KEY));});
test('all invitation UI uses mini-program sharing without copy links',()=>{const ui=readFileSync(new URL('../public/card-app.js',import.meta.url),'utf8');assert.doesNotMatch(ui,/copy-invite|邀请链接|复制邀请|navigator\.clipboard/);assert.match(ui,/转发小程序，邀请好友/);assert.match(rulesMarkup(),/最后打开的小程序分享卡片/);});
test('daily quota is a compact note, not a progress dashboard',()=>{const html=grantMarkup({amount:1,expiresAt:Date.now(),today:4});assert.match(html,/grant-daily-note/);assert.doesNotMatch(html,/<progress|grant-progress/);});
test('shell routes have no old deployment addresses',()=>{for(const file of ['ui-common.js','app.js','site-shell.js','site-bridge.js']){const code=readFileSync(new URL('../public/'+file,import.meta.url),'utf8');assert.doesNotMatch(code,/turing-ai-skin-spectrum|jianx-card-lottery-preview/);}const code=readFileSync(new URL('../public/site-shell.js',import.meta.url),'utf8');assert.match(code,/orders:'skin'/);assert.match(code,/card:'card'/);assert.match(code,/message.type==='new-chat'/);});
