import {fresh,START} from './expert-event-model.js';

export const EVENT_KEY='jianx-expert-event-2026-v1';
export const DEFAULT_TIME=START+10*3600000;
let fallback=null;
const blockedStorage=new WeakMap();

const defaultStorage=() => {
  try{return globalThis.localStorage||null;}catch{return null;}
};
const initial=() => ({version:1,state:fresh(),clock:{mode:'demo',base:DEFAULT_TIME,real:Date.now()}});
const valid=session => session?.version===1&&session.state?.version===1
  &&['orders','tickets','draws','vouchers','dailyClaims'].every(key => Array.isArray(session.state[key]))
  &&session.state.stocks&&session.state.addresses
  &&['demo','real'].includes(session.clock?.mode)
  &&Number.isFinite(session.clock.base)&&Number.isFinite(session.clock.real);

function write(session,storage) {
  fallback=structuredClone(session);
  try {
    storage?.setItem(EVENT_KEY,JSON.stringify(session));
    if(storage)blockedStorage.delete(storage);
  } catch {
    if(storage)blockedStorage.set(storage,structuredClone(session));
  }
}

function read(storage) {
  if(storage) {
    if(blockedStorage.has(storage))return structuredClone(blockedStorage.get(storage));
    try {
      const saved=JSON.parse(storage.getItem(EVENT_KEY));
      if(valid(saved)){fallback=saved;return saved;}
    } catch{}
    const session=initial();
    write(session,storage);
    return session;
  }
  if(!valid(fallback))fallback=initial();
  return structuredClone(fallback);
}

function notify() {
  if(typeof window!=='undefined'&&typeof CustomEvent!=='undefined') {
    window.dispatchEvent(new CustomEvent('expert-event-change'));
  }
}

export function loadEvent(storage=defaultStorage()) {
  return structuredClone(read(storage).state);
}

export function saveEvent(state,storage=defaultStorage()) {
  const session=read(storage);
  session.state=structuredClone(state);
  write(session,storage);
  notify();
  return structuredClone(session.state);
}

export function eventNow(storage=defaultStorage()) {
  const {clock}=read(storage);
  return clock.mode==='real'?Date.now():clock.base+Date.now()-clock.real;
}

export function setEventClock(timestamp=null,storage=defaultStorage()) {
  if(timestamp!==null&&!Number.isFinite(timestamp))throw new TypeError('请输入有效的演示时间');
  const session=read(storage);
  session.clock={mode:timestamp===null?'real':'demo',base:timestamp??Date.now(),real:Date.now()};
  write(session,storage);
  notify();
  return eventNow(storage);
}

export function resetEvent(storage=defaultStorage()) {
  const session=initial();
  write(session,storage);
  notify();
  return structuredClone(session.state);
}

if(typeof window!=='undefined') {
  window.addEventListener('storage',event => {
    if(event.key===EVENT_KEY)notify();
  });
}
