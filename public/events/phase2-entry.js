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

if (typeof document !== 'undefined') {
  mountSecondPhaseEntry();
  const content = document.getElementById('ac-content');
  if (content) new MutationObserver(() => mountSecondPhaseEntry()).observe(content, {childList:true});
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-phase2-entry]')) return;
    window.jianxNavigate('card-eb05');
  });
}
