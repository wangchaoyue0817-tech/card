import {PHASE2,START,END,DAY,fresh,claimWelcome,recordResult,invite,draw,dismissPendingShares} from './phase2-model.js';

export const PHASE2_KEY='jianx-card-eb05-2026-v1';
export const SESSION_KEY=PHASE2_KEY;
export const DEFAULT_TIME=START+12*3_600_000;
const caches=new WeakMap(),blockedWrites=new WeakSet();
let memory=null;
const copy=value=>structuredClone(value);
function defaultStorage(){try{return globalThis.localStorage||null;}catch{return null;}}
function pageLoadMarker(){
  try{return typeof window!=='undefined'&&Number.isFinite(window.top?.performance?.timeOrigin)?`page-${window.top.performance.timeOrigin}`:null;}catch{return null;}
}
function initial(now=DEFAULT_TIME){return {version:1,state:fresh({registeredAt:now-60_000}),clock:{mode:'demo',base:now,real:Date.now()},navigationMarker:pageLoadMarker()};}
const valid=session=>session?.version===1&&session.state?.version===1&&session.state.activityId===PHASE2.id
  &&['tickets','ledger','results','payments','invitations','draws','vouchers'].every(key=>Array.isArray(session.state[key]))
  &&session.state.days&&session.state.stocks&&session.state.addresses
  &&['demo','real'].includes(session.clock?.mode)&&Number.isFinite(session.clock.base)&&Number.isFinite(session.clock.real);
function write(session,storage){
  memory=copy(session);
  if(storage)caches.set(storage,copy(session));
  try{storage?.setItem(PHASE2_KEY,JSON.stringify(session));if(storage)blockedWrites.delete(storage);}catch{if(storage)blockedWrites.add(storage);}
}
function read(storage,navigationMarker=pageLoadMarker()){
  let session;
  if(storage&&blockedWrites.has(storage))session=caches.get(storage);
  else try{session=JSON.parse(storage?.getItem(PHASE2_KEY));}catch{}
  if(!valid(session))session=storage?caches.get(storage):memory;
  if(!valid(session)){session=initial();write(session,storage);}
  if(navigationMarker&&session.navigationMarker!==navigationMarker){
    // All same-origin frames share the top page marker. Creating a new frame
    // must not dismiss another frame's live one-off share dialog.
    session={...session,state:session.navigationMarker?dismissPendingShares(session.state):session.state,navigationMarker};
    write(session,storage);
  }
  memory=copy(session);
  if(storage)caches.set(storage,copy(session));
  return copy(session);
}
function notify(){if(typeof window!=='undefined'&&typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent('phase2-change'));}
export function loadPhase2(storage=defaultStorage(),{navigationMarker=pageLoadMarker()}={}){return read(storage,navigationMarker).state;}
export function savePhase2(state,storage=defaultStorage()){
  if(state?.activityId!==PHASE2.id)throw new TypeError('只可保存海贼 EB05 活动数据');
  const session=read(storage);session.state=copy(state);write(session,storage);notify();return copy(state);
}
export function phase2Now(storage=defaultStorage()){
  const {clock}=read(storage);return clock.mode==='real'?Date.now():clock.base+Date.now()-clock.real;
}
export function phase2Clock(storage=defaultStorage()){return copy(read(storage).clock);}
export function setPhase2Clock(timestamp=null,storage=defaultStorage()){
  if(timestamp!==null&&!Number.isFinite(timestamp))throw new TypeError('请输入有效的演示时间');
  const session=read(storage);session.clock={mode:timestamp===null?'real':'demo',base:timestamp??Date.now(),real:Date.now()};
  write(session,storage);notify();return phase2Now(storage);
}
export function resetPhase2(storage=defaultStorage()){
  const session=initial();write(session,storage);
  notify();return copy(session.state);
}
const withOrdinary=(state,now)=>invite(state,{id:'scenario-friend',registeredAt:now-1_000,lastInviter:state.uid},now).state;
function seedResults(state,count,now){for(let index=0;index<count;index++)state.results.push({id:`scenario-result-${index}`,kind:index%2?'expert':'ai',category:'card',at:now,demo:true});return state;}
export function applyPhase2Scenario(name,storage=defaultStorage()){
  const names=['new','ordinary','69','70','99','100','threshold69','threshold70','threshold99','threshold100','soldout','next-day','expired','ten','won','ended','before','real'];
  if(!names.includes(name))throw new TypeError('未知演示场景');
  let now=DEFAULT_TIME,state=fresh({registeredAt:now-60_000});
  if(name==='ordinary'||/^(?:threshold)?\d+$/.test(name)||['soldout','next-day','won','ended'].includes(name)){
    state.registeredAt=START-DAY;state=withOrdinary(state,now);
  }
  if(/^(?:threshold)?\d+$/.test(name))seedResults(state,Number(name.replace('threshold','')),now);
  if(name==='soldout'){seedResults(state,100,now);state.stocks.chopper=0;}
  if(name==='next-day'){seedResults(state,100,now);now+=DAY;}
  if(name==='expired'){state=claimWelcome(state,now).state;state=withOrdinary(state,now);now+=DAY+1;}
  if(name==='ten')for(let index=0;index<10;index++)state=recordResult(state,{id:`scenario-ai-${index}`,kind:'ai',category:'card'},now).state;
  if(name==='won'||name==='ended'){seedResults(state,100,now);state=draw(state,'ordinary',1,now,()=>0).state;if(name==='ended')now=END+3_600_000;}
  if(name==='before'){now=START-3_600_000;state=fresh({registeredAt:now-60_000});}
  const session={version:1,state,clock:{mode:name==='real'?'real':'demo',base:now,real:Date.now()},navigationMarker:pageLoadMarker()};
  write(session,storage);
  notify();return copy(state);
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===PHASE2_KEY)notify();});
