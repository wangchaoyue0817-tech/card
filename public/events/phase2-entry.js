import {loadPhase2,phase2Now} from '../phase2-session.js';
import {available} from '../phase2-model.js';
// Add the next campaign without changing either imported campaign's controller.
export function secondPhaseEntry() {
  return `<button class="ac-choice ac-choice-eb05" data-phase2-entry aria-label="查看海贼 EB05 第二期活动"><span class="ac-choice-copy"><small>第二期 · 10.30 — 11.05</small><strong>海贼 EB05 上新</strong><span>免费抽好礼 · 每一份收藏都有回应</span><b>查看活动 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></b></span><span class="eb05-entry-art" aria-hidden="true"><i></i><img src="assets/lottery-card-back.png" alt=""><img src="assets/lottery-card-back.png" alt=""><em>EB05</em></span></button>`;
}

export function mountSecondPhaseEntry(root = document) {
  const choices = root.querySelector('.ac-choices');
  if (!choices || choices.querySelector('[data-phase2-entry]')) return;
  // Preserve both original activity cards, their content and relative order.
  const past = choices.querySelector('[data-action="event:card-past"]');
  if (past) past.insertAdjacentHTML('beforebegin', secondPhaseEntry());
  else choices.insertAdjacentHTML('beforeend', secondPhaseEntry());
}

export function secondPhasePrizesEntry(state) {
  const rewards=(state?.draws||[]).flatMap(batch=>batch.rewards);
  const physical=rewards.filter(item=>item.type==='physical').length;
  const vouchers=rewards.filter(item=>item.type==='voucher').length;
  return `<section class="p2-hub-prizes" data-phase2-prizes><div><small>海贼 EB05 · 第二期</small><h2>本期收藏好礼</h2><p>实物 ${physical} 份 · 专家鉴定券 ${vouchers} 张</p></div><button data-phase2-prize-link>查看奖品 <span aria-hidden="true">↗</span></button></section><h2 class="p2-other-prizes">双11与卡牌第一期</h2>`;
}

function updatePhase2Hub() {
  mountSecondPhaseEntry();
  const state=loadPhase2(),now=phase2Now(),balance=available(state,now);
  const label=document.querySelector('[data-phase2-entry] b');
  if(label)label.firstChild.textContent=`${balance.welcome+balance.ordinary?`可用 ${balance.welcome+balance.ordinary} 张券`:'查看活动'} `;
  const content=document.getElementById('ac-content');
  if(content?.getAttribute('aria-labelledby')==='tab-prizes'&&!content.querySelector('[data-phase2-prizes]'))content.insertAdjacentHTML('afterbegin',secondPhasePrizesEntry(state));
}

if (typeof document !== 'undefined') {
  updatePhase2Hub();
  const content = document.getElementById('ac-content');
  if (content) new MutationObserver(updatePhase2Hub).observe(content, {childList:true});
  window.addEventListener('jianx-shell',event=>{if(event.detail.type==='activate')queueMicrotask(()=>{content?.querySelector('[data-phase2-prizes]')?.remove();content?.querySelector('.p2-other-prizes')?.remove();updatePhase2Hub();});});
  document.addEventListener('click', event => {
    if (event.target.closest('[data-phase2-prize-link]'))window.jianxNavigate('card-eb05-prizes');
    else if(event.target.closest('[data-phase2-entry]'))window.jianxNavigate('card-eb05');
  });
}
