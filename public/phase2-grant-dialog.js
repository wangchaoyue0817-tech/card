import {END,dayKey,dailyCount,share} from './phase2-model.js';
import {loadPhase2,savePhase2,phase2Now} from './phase2-session.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let current=null;
export function closePhase2Grant() { current?.dispose(); }
export function showPhase2Grant(result,{source='卡牌鉴定完成',pool='ordinary'}={}) {
  if(typeof document==='undefined'||(!result.awarded&&!result.capped))return;
  closePhase2Grant();
  const now=phase2Now(),state=loadPhase2(),openedDay=dayKey(now),sharePrompt=Boolean(result.sharePrompt),focus=document.activeElement;
  const welcome=pool==='welcome',amount=result.amount||0,dialog=document.createElement('dialog');
  const expiresAt=welcome?state.welcome?.expiresAt:END;
  const expiry=Number.isFinite(expiresAt)?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(expiresAt-(welcome?0:1)):'';
  dialog.className='p2-service-dialog';dialog.setAttribute('aria-labelledby','p2-service-title');
  dialog.innerHTML=`<button class="p2-sg-close" aria-label="关闭赠券弹窗">×</button>
  ${amount?`<div class="p2-sg-keepsake"><svg viewBox="0 0 72 72" aria-hidden="true"><path d="M36 8 60 24 54 52 36 65 18 52 12 24Z M12 24H60 M36 8 25 24 36 65 47 24Z M18 52 36 43 54 52"/></svg><span>+${amount}</span><small>${welcome?'新人专属抽奖券':'普通抽奖券'}</small></div>`:''}
  <h2 id="p2-service-title">${amount?(welcome?'新人券已到账':'抽奖券已到账'):'鉴定已完成'}</h2>
  <small class="p2-sg-source">${escape(source)}${amount?` · ${expiry} 到期`:''}</small>
  ${sharePrompt?`<section class="p2-sg-share"><div><strong>今日满额，再领 5 张</strong></div><button data-p2-share>模拟转发小程序 · 领取 5 张</button><small>每天一次，仅本弹窗有效；关闭后当天不可补领，不占鉴定额度。</small></section>`:''}
  <p class="p2-sg-limit">${welcome?'24 小时有效 · 仅限整组五连抽':`今日鉴定获券 ${dailyCount(state,now)} / 10 张${amount?'':' · 已达上限'}`}</p>
  <button class="p2-sg-primary" data-p2-go>${welcome?'开启新人五连抽':'去抽奖中心'} <span>↗</span></button><button class="p2-sg-later">稍后再看</button>`;
  document.body.append(dialog);
  let disposed=false;
  // Commit the one-off share dismissal synchronously, including pagehide. Native
  // dialog close events are queued and may never run after the document exits.
  const leave=()=>{if(disposed)return;disposed=true;if(current?.dialog===dialog)current=null;if(sharePrompt)savePhase2(share(loadPhase2(),now,'dismiss').state);if(dialog.open)dialog.close();dialog.remove();if(focus?.isConnected)focus.focus?.({preventScroll:true});};
  current={dialog,dispose:leave};
  dialog.addEventListener('close',leave,{once:true});
  dialog.addEventListener('cancel',event=>{event.preventDefault();leave();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)leave();});
  dialog.querySelector('.p2-sg-close').onclick=leave;
  dialog.querySelector('.p2-sg-later').onclick=leave;
  dialog.querySelector('[data-p2-go]').onclick=()=>{leave();if(window.parent===window)location.href=new URL('index.html#card-eb05',import.meta.url).href;else window.jianxNavigate?.('card-eb05',{intent:welcome?'draw-welcome':undefined});};
  dialog.querySelector('[data-p2-share]')?.addEventListener('click',event=>{
    const time=phase2Now();if(dayKey(time)!==openedDay){event.currentTarget.textContent='本次机会已过期';event.currentTarget.disabled=true;return;}
    const next=share(loadPhase2(),time,'claim');savePhase2(next.state);
    event.currentTarget.textContent=next.awarded?'已模拟转发 · 5 张已到账':'本次机会已失效';event.currentTarget.disabled=true;
  });
  dialog.showModal();dialog.querySelector('.p2-sg-close').focus({preventScroll:true});
}
if(typeof window!=='undefined') {
  window.addEventListener('pagehide',closePhase2Grant);
  window.addEventListener('jianx-shell',event=>{if(event.detail.type==='reset-chat'||event.detail.type==='visibility'&&!event.detail.active)closePhase2Grant();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)closePhase2Grant();});
}
