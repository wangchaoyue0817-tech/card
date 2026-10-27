// Decoration only: reward persistence and ticket accounting must happen before this runs.
const running = new WeakMap();
const LILAC = ['#f8edff', '#d9c6ff', '#bca2ff', '#e6baff'];
const GOLD = ['#fff4ce', '#f5d68b', '#eac389', '#d8beff'];
const PRESETS = {
  ordinary: {duration: 1900, colors: LILAC, bursts: 2, sparks: 28, ribbons: 18},
  advanced: {duration: 2900, colors: GOLD, bursts: 3, sparks: 40, ribbons: 30},
  voucher: {duration: 2100, colors: LILAC, bursts: 2, sparks: 22, ribbons: 22},
  physical: {duration: 3300, colors: GOLD, bursts: 4, sparks: 46, ribbons: 42},
  none: {duration: 1500, colors: LILAC, bursts: 0, sparks: 0, ribbons: 0}
};

/** The strongest actual outcome controls the atmosphere of a mixed five-draw batch. */
export function outcomeTier(batch) {
  const rewards = Array.isArray(batch?.rewards) ? batch.rewards : [];
  if (rewards.some(reward => reward?.type === 'physical')) return 'physical';
  if (rewards.some(reward => reward?.type === 'voucher')) return 'voucher';
  return 'none';
}

const noise = index => {
  const n = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function particlesFor(preset, width, height) {
  const particles = [];
  const sources = [[.22, .25], [.78, .19], [.5, .13], [.72, .36]];
  for (let burst = 0; burst < preset.bursts; burst++) {
    const [x, y] = sources[burst];
    for (let i = 0; i < preset.sparks; i++) {
      const seed = burst * 71 + i;
      const angle = i * 2.399963 + burst * .5;
      const speed = 46 + noise(seed) * (preset.bursts > 2 ? 110 : 64);
      particles.push({
        kind: 'spark', x: width * x, y: height * y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        born: burst * 260 + noise(seed + 2) * 36,
        life: 1000 + noise(seed + 5) * 700,
        size: .9 + noise(seed + 9) * 1.2,
        color: preset.colors[i % preset.colors.length]
      });
    }
  }
  for (let i = 0; i < preset.ribbons; i++) {
    const left = i % 2 === 0;
    particles.push({
      kind: 'ribbon', x: width * (left ? .05 : .95), y: height * .38,
      vx: (left ? 1 : -1) * (45 + noise(i + 50) * width * .34),
      vy: -(90 + noise(i + 73) * 130),
      born: 70 + noise(i + 81) * 420,
      life: preset.duration - 350,
      size: 3 + noise(i + 91) * 3.4,
      phase: noise(i + 60) * Math.PI * 2,
      color: preset.colors[i % preset.colors.length]
    });
  }
  return particles;
}

function paint(ctx, particles, elapsed, width, height) {
  ctx.clearRect(0, 0, width, height);
  for (const p of particles) {
    const age = elapsed - p.born;
    if (age < 0 || age > p.life) continue;
    const seconds = age / 1000;
    const remaining = 1 - age / p.life;
    // No flashing: one soft arrival followed by a continuous fade.
    ctx.globalAlpha = Math.min(1, age / 100) * Math.pow(remaining, .75);
    ctx.fillStyle = p.color;
    if (p.kind === 'spark') {
      const travel = (1 - Math.exp(-seconds * 1.9)) / 1.9;
      const previous = (1 - Math.exp(-Math.max(0, seconds - .06) * 1.9)) / 1.9;
      const x = p.x + p.vx * travel, y = p.y + p.vy * travel + 22 * seconds ** 2;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * .65;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x + p.vx * previous, p.y + p.vy * previous + 22 * Math.max(0, seconds - .06) ** 2);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, p.size * (.35 + remaining * .65), 0, Math.PI * 2);
      ctx.fill();
    } else {
      const x = p.x + p.vx * seconds * .65 + Math.sin(seconds * 4 + p.phase) * 9;
      const y = p.y + p.vy * seconds + 104 * seconds ** 2;
      const flip = .28 + Math.abs(Math.cos(seconds * 6 + p.phase)) * .72;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.phase + seconds * 2.5);
      ctx.scale(flip, 1);
      // A curved satin strip catches a slim highlight as it turns.
      ctx.beginPath();
      ctx.moveTo(-p.size * .55, -p.size);
      ctx.bezierCurveTo(p.size, -p.size * .3, -p.size, p.size * .3, p.size * .5, p.size);
      ctx.lineTo(p.size * 1.05, p.size);
      ctx.bezierCurveTo(-p.size * .45, p.size * .3, p.size * 1.55, -p.size * .3, 0, -p.size);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha *= .45;
      ctx.strokeStyle = '#fff6ff';
      ctx.lineWidth = .55;
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Attach to the visible dialog (or another positioned host). Returns an idempotent
 * cleanup function. Re-entering the same host automatically stops the old effect.
 */
export function celebrateGacha(root, requestedTier = 'voucher') {
  if (!root?.append) return () => {};
  running.get(root)?.();
  const doc = root.ownerDocument ?? globalThis.document;
  const win = doc?.defaultView ?? globalThis;
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!doc || media?.matches) return () => {};
  const tier = Object.hasOwn(PRESETS, requestedTier) ? requestedTier : 'voucher';
  const preset = PRESETS[tier];
  const layer = doc.createElement('div');
  layer.className = 'gacha-celebration';
  layer.dataset.tier = tier;
  layer.setAttribute('aria-hidden', 'true');
  layer.style.setProperty('--gacha-effect-duration', `${preset.duration}ms`);
  const hadHostClass = root.classList.contains('gacha-celebration-host');
  root.classList.add('gacha-celebration-host');
  const glow = doc.createElement('i');
  glow.className = 'gacha-celebration-glow';
  layer.append(glow);
  for (let i = 0; i < (tier === 'none' ? 5 : 7); i++) {
    const gleam = doc.createElement('i');
    gleam.className = 'gacha-celebration-gleam';
    gleam.style.setProperty('--gleam-x', `${12 + noise(i + 35) * 76}%`);
    gleam.style.setProperty('--gleam-y', `${15 + noise(i + 38) * 37}%`);
    gleam.style.setProperty('--gleam-delay', `${90 + i * 115}ms`);
    gleam.style.setProperty('--gleam-size', `${tier === 'none' ? 5 : 7 + i % 3 * 2}px`);
    layer.append(gleam);
  }
  root.append(layer);

  let frameId = 0, timerId = 0, stopped = false;
  const start = win.performance?.now?.() ?? 0;
  function cleanup() {
    if (stopped) return;
    stopped = true;
    if (frameId) win.cancelAnimationFrame?.(frameId);
    if (timerId) win.clearTimeout(timerId);
    media?.removeEventListener?.('change', onMotionChange);
    layer.remove();
    if (!hadHostClass) root.classList.remove('gacha-celebration-host');
    if (running.get(root) === cleanup) running.delete(root);
  }
  function onMotionChange(event) {
    if (event.matches) cleanup();
  }
  running.set(root, cleanup);
  media?.addEventListener?.('change', onMotionChange);
  timerId = win.setTimeout(cleanup, preset.duration);

  if (preset.bursts && win.requestAnimationFrame) {
    const canvas = doc.createElement('canvas');
    canvas.className = 'gacha-celebration-particles';
    layer.append(canvas);
    let ctx;
    // Context allocation can fail on constrained devices; the CSS gleams and
    // normal result controls remain usable without a canvas.
    try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
    if (ctx) {
      const box = root.getBoundingClientRect();
      const width = Math.max(1, box.width), height = Math.max(1, Math.min(root.clientHeight || box.height, 820));
      const dpr = Math.min(win.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      const particles = particlesFor(preset, width, height);
      function frame(now) {
        if (stopped) return;
        if (root.isConnected === false || now - start >= preset.duration) {
          cleanup();
          return;
        }
        paint(ctx, particles, now - start, width, height);
        frameId = win.requestAnimationFrame(frame);
      }
      frameId = win.requestAnimationFrame(frame);
    } else canvas.remove();
  }
  return cleanup;
}
