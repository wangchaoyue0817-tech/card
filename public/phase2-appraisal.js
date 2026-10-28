import {claimWelcome,recordResult,recordExpertPayment} from './phase2-model.js';

const unchanged=state=>({state,awarded:false,amount:0,sharePrompt:false});
const isCard=category=>category==='card'||category==='卡牌';
// Only explicit successful business events count; rendering a report never does.
export function processAppraisal(state,eventName,detail={},now) {
  if(detail.success!==true||!isCard(detail.category)||!detail.id)return unchanged(state);
  if(eventName==='jianx-card-ai-result')return recordResult(state,{id:detail.id,kind:'ai',category:'card'},now);
  if(eventName==='jianx-card-expert-result')return recordResult(state,{id:detail.id,kind:'expert',category:'card'},now);
  if(eventName==='jianx-card-expert-paid'&&['cash','voucher'].includes(detail.payment))
    return recordExpertPayment(state,{id:detail.id,category:'card',voucherId:detail.voucherId},now);
  return unchanged(state);
}
export function enterCardPage(state,detail={},now) {
  if(detail.route!=='card'||detail.photo||detail.fromPhoto||detail.intent==='choose-card')return unchanged(state);
  return claimWelcome(state,now,{entry:'card',fromPhoto:false});
}
