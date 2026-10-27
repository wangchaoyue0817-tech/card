// A small consolation interaction only. Never draws, spends tickets or grants rewards.
const mounted = new WeakMap();

export function comfortMarkup(count = 1) {
  const total = count === 5 ? 5 : 1;
  return `<div class="gc-comfort" data-comfort data-empty-count="${total}">
    <p class="gc-caption" data-comfort-caption role="status" aria-live="polite">奖品没跟上，抱抱先到。</p>
    <button class="gc-character" type="button" data-comfort-hug aria-label="点点小扭蛋，收个抱抱">
      <span class="gc-scene" aria-hidden="true">
        <i class="gc-halo"></i><i class="gc-shadow"></i>
        <span class="gc-capsule"><i class="gc-lid"></i><i class="gc-rim"></i><i class="gc-bowl"></i>
          <span class="gc-face"><i class="gc-eye gc-eye-left"></i><i class="gc-eye gc-eye-right"></i><i class="gc-cheek gc-cheek-left"></i><i class="gc-cheek gc-cheek-right"></i><i class="gc-mouth"></i></span>
          <i class="gc-arm gc-arm-left"></i><i class="gc-arm gc-arm-right"></i><i class="gc-heart gc-heart-main"></i>
        </span>
        <i class="gc-heart gc-heart-float gc-heart-one"></i><i class="gc-heart gc-heart-float gc-heart-two"></i><i class="gc-heart gc-heart-float gc-heart-three"></i>
        <i class="gc-spark gc-spark-one"></i><i class="gc-spark gc-spark-two"></i>
      </span>
      <span class="gc-touch-hint" data-comfort-hint>戳一下，收个抱抱 <span aria-hidden="true">♡</span></span>
    </button>
    ${total === 5 ? '<p class="gc-batch-note">本次 5 枚扭蛋均为再接再厉</p>' : ''}
  </div>`;
}

export function mountComfort(host) {
  const root = host?.querySelector('[data-comfort]');
  if (!root) return () => {};
  mounted.get(root)?.();
  const button = root.querySelector('[data-comfort-hug]');
  const win = root.ownerDocument?.defaultView ?? globalThis;
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let stopped = false;
  function hug() {
    if (stopped || root.classList.contains('is-hugging')) return;
    root.classList.add('is-hugged');
    root.querySelector('[data-comfort-caption]').textContent = '抱抱已送达，别灰心～';
    root.querySelector('[data-comfort-hint]').textContent = '再抱一下 ♡';
    button.setAttribute('aria-label', '再抱一下小扭蛋');
    if (!media?.matches) root.classList.add('is-hugging');
  }
  function end(event) {
    if (event.animationName === 'gc-hug') root.classList.remove('is-hugging');
  }
  function reduce(event) {
    if (event.matches) root.classList.remove('is-hugging');
  }
  button.addEventListener('click', hug);
  root.addEventListener('animationend', end);
  media?.addEventListener?.('change', reduce);
  function cleanup() {
    if (stopped) return;
    stopped = true;
    button.removeEventListener('click', hug);
    root.removeEventListener('animationend', end);
    media?.removeEventListener?.('change', reduce);
    root.classList.remove('is-hugging');
    if (mounted.get(root) === cleanup) mounted.delete(root);
  }
  mounted.set(root, cleanup);
  return cleanup;
}
