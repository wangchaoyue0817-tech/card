import {processAppraisal,enterCardPage} from './phase2-appraisal.js';
import {loadPhase2,savePhase2,phase2Now} from './phase2-session.js';
import {showPhase2Grant} from './phase2-grant-dialog.js';
import {share} from './phase2-model.js';

if(typeof window!=='undefined') {
  const sources={'jianx-card-ai-result':'AI 卡牌鉴定完成','jianx-card-expert-paid':'专家卡牌鉴定结算成功','jianx-card-expert-result':'人工卡牌报告已出结果'};
  for(const name of Object.keys(sources))window.addEventListener(name,event=>{
    const time=phase2Now(),result=processAppraisal(loadPhase2(),name,event.detail,time);
    const visible=window.jianxActive!==false&&!document.hidden;
    if(result.sharePrompt&&!visible)result.state=share(result.state,time,'dismiss').state;
    savePhase2(result.state);
    if(event.detail?.success&&['card','卡牌'].includes(event.detail.category))event.preventDefault();
    if(visible)showPhase2Grant(result,{source:sources[name]});
  });
  const enter=detail=>{
    if(!document.getElementById('card-content')||window.jianxActive===false||document.hidden)return;
    const result=enterCardPage(loadPhase2(),detail,phase2Now());
    if(result.awarded){savePhase2(result.state);showPhase2Grant(result,{source:'第二期 · 新人专属礼',pool:'welcome'});}
  };
  window.addEventListener('jianx-shell',event=>{if(event.detail.type==='activate')queueMicrotask(()=>enter(event.detail));});
  if(window.parent===window)queueMicrotask(()=>enter({route:location.hash.slice(1)||'card'}));
}
