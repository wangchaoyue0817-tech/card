import {START,fresh,welcome} from './lottery-model.js';
export const CAMPAIGN_KEY='jianx-card-preview-v1';
export function loadCampaign(storage=localStorage){let saved;try{saved=JSON.parse(storage.getItem(CAMPAIGN_KEY));}catch{}return saved?.state?.version===1?saved:{state:fresh(),mode:'demo',clockBase:START+12*3600000,clockReal:Date.now()};}
export const campaignNow=session=>session.mode==='real'?Date.now():session.clockBase+Date.now()-session.clockReal;
export function claimCampaignWelcome(storage=localStorage){const session=loadCampaign(storage);const result=welcome(session.state,campaignNow(session));session.state=result.state;storage.setItem(CAMPAIGN_KEY,JSON.stringify(session));return {...result,session};}
