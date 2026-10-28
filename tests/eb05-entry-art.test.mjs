import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {secondPhaseEntry, mountSecondPhaseEntry} from '../public/events/phase2-entry.js';
import {createDocument} from './events/dom-fixture.mjs';

const entrySource = readFileSync(new URL('../public/events/phase2-entry.js', import.meta.url), 'utf8');
const entryCSS = readFileSync(new URL('../public/events/phase2-entry.css', import.meta.url), 'utf8');
const originalChoices = '<section class="ac-choices"><button data-action="event:expert"><strong>双11扭蛋活动</strong></button><button data-action="event:card-past"><strong>卡牌抽奖活动</strong></button></section>';

// Extend only the test fixture with the two DOM operations used by this entry.
function entryDocument(markup = originalChoices) {
  const document = createDocument(markup);
  function equip(node) {
    Object.defineProperty(node, 'firstChild', {configurable: true, get() {
      if (typeof node.nodes[0] !== 'string') return node.nodes[0] || null;
      return {get textContent() {return node.nodes[0];}, set textContent(value) {node.nodes[0] = String(value);}};
    }});
    node.insertAdjacentHTML = (position, html) => {
      const fragment = document.createElement('div');
      fragment.innerHTML = html;
      const inserted = [...fragment.nodes];
      if (position === 'beforebegin') {
        const parent = node.parentElement, index = parent.nodes.indexOf(node);
        parent.nodes.splice(index, 0, ...inserted);
        for (const child of inserted) if (typeof child !== 'string') child.parentElement = parent;
      } else if (position === 'beforeend' || position === 'afterbegin') {
        node.nodes.splice(position === 'afterbegin' ? 0 : node.nodes.length, 0, ...inserted);
        for (const child of inserted) if (typeof child !== 'string') child.parentElement = node;
      } else assert.fail(`Unsupported insertion: ${position}`);
      for (const child of inserted) if (typeof child !== 'string') equip(child);
    };
    for (const child of node.children) equip(child);
  }
  equip(document.root);
  return document;
}

test('EB05 activity artwork is one decorative illustrated asset, with no old card-back stack or image label', () => {
  const document = entryDocument(secondPhaseEntry());
  const art = document.querySelector('.eb05-entry-art');
  assert.equal(art.getAttribute('aria-hidden'), 'true');
  assert.equal(art.querySelectorAll('img').length, 1);
  const image = art.querySelector('img');
  assert.equal(image.className, 'eb05-entry-illustration');
  assert.equal(image.getAttribute('src'), 'assets/eb05-entry-cards.webp');
  assert.equal(image.getAttribute('alt'), '');
  assert.equal(image.getAttribute('width'), '640');
  assert.equal(image.getAttribute('height'), '640');
  assert.equal(image.getAttribute('decoding'), 'async');
  assert.equal(art.querySelector('i'), null);
  assert.equal(art.querySelector('em'), null);
  assert.doesNotMatch(secondPhaseEntry(), /lottery-card-back\.png/);
});

test('the illustration reference resolves to an actual WebP in the activity page asset directory', () => {
  const document = entryDocument(secondPhaseEntry());
  const source = document.querySelector('.eb05-entry-illustration').getAttribute('src');
  const asset = readFileSync(new URL(`../public/events/${source}`, import.meta.url));
  assert.equal(asset.subarray(0, 4).toString(), 'RIFF');
  assert.equal(asset.subarray(8, 12).toString(), 'WEBP');
  assert.ok(asset.length > 1000, 'the production asset must contain real image data');
});

test('the production artwork retains its transparent channel instead of baking in a rectangular backdrop', () => {
  const document = entryDocument(secondPhaseEntry());
  const source = document.querySelector('.eb05-entry-illustration').getAttribute('src');
  const asset = readFileSync(new URL(`../public/events/${source}`, import.meta.url));
  let hasAlpha = false;
  // Check the container metadata without adding an image-decoding dependency.
  // Both lossy alpha and lossless alpha WebP encodings are supported.
  for (let offset = 12; offset + 8 <= asset.length;) {
    const kind = asset.subarray(offset, offset + 4).toString();
    const size = asset.readUInt32LE(offset + 4), data = offset + 8;
    assert.ok(data + size <= asset.length, 'WebP chunks must not be truncated');
    if (kind === 'VP8X' && size >= 1) hasAlpha ||= Boolean(asset[data] & 0x10);
    if (kind === 'ALPH' && size >= 1) hasAlpha = true;
    if (kind === 'VP8L' && size >= 5) hasAlpha ||= Boolean((asset.readUInt32LE(data + 1) >>> 28) & 1);
    offset = data + size + (size % 2);
  }
  assert.equal(hasAlpha, true, 'art must blend into the activity card through its alpha channel');
});

test('the artwork uses contain and does not fade on narrow screens or keep old stack selectors', () => {
  assert.match(entryCSS, /\.eb05-entry-illustration\s*\{[^}]*object-fit\s*:\s*contain\s*[;}]/);
  assert.doesNotMatch(entryCSS, /\.eb05-entry-art\s*\{[^}]*opacity\s*:/);
  assert.doesNotMatch(entryCSS, /\.eb05-entry-art\s+(?:i|em)\s*\{|\.eb05-entry-art\s+img\s*\+\s*img/);
});

test('the decorative art does not capture clicks or introduce nested keyboard stops', () => {
  const art = entryDocument(secondPhaseEntry()).querySelector('.eb05-entry-art');
  assert.match(entryCSS, /\.eb05-entry-art\s*\{[^}]*pointer-events\s*:\s*none\s*[;}]/);
  assert.equal(art.querySelector('button, a, input, select, textarea, [tabindex], [contenteditable]'), null);
  assert.doesNotMatch(entryCSS, /\.eb05-entry-(?:art|illustration)[^{]*\{[^}]*pointer-events\s*:\s*(?:auto|all)\b/);
});

test('entry visual rules are scoped to EB05 and never restyle the two existing activity cards', () => {
  const selectors = [...entryCSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)]
    .map(match => match[1].trim())
    .filter(selector => !selector.startsWith('@'))
    .flatMap(selector => selector.split(',').map(part => part.trim()));
  // This stylesheet also owns the existing EB05 prize summary. All visual
  // selectors must stay in one of those local namespaces, including media rules.
  const scopedSelector = /^\.(?:ac-choice-eb05|eb05-entry-art|eb05-entry-illustration|p2-hub-prizes|p2-other-prizes)(?=[\s.:#>+~\[]|$)/;
  assert.ok(selectors.length > 0);
  for (const selector of selectors) assert.match(selector, scopedSelector, `unscoped selector: ${selector}`);
});

test('the new artwork preserves the accessible activity name and all existing left-side content', () => {
  const document = entryDocument(secondPhaseEntry());
  const button = document.querySelector('[data-phase2-entry]');
  assert.equal(button.tagName, 'BUTTON');
  assert.equal(button.getAttribute('aria-label'), '查看海贼 EB05 第二期活动');
  const copy = button.querySelector('.ac-choice-copy');
  assert.equal(copy.querySelector('small').textContent, '第二期 · 10.30 — 11.05');
  assert.equal(copy.querySelector('strong').textContent, '海贼 EB05 上新');
  assert.equal(copy.querySelector('span').textContent, '免费抽好礼 · 每一份收藏都有回应');
  assert.equal(copy.querySelector('b').textContent.trim(), '查看活动');
});

test('mounting inserts EB05 between the two existing activity nodes without recreating them, and is idempotent', () => {
  const document = entryDocument();
  const choices = document.querySelector('.ac-choices');
  const [expert, past] = choices.children;
  const originalExpert = expert.textContent, originalPast = past.textContent;
  const expertAttributes = [...expert.attributes], pastAttributes = [...past.attributes];
  const expertChildren = [...expert.children], pastChildren = [...past.children];
  mountSecondPhaseEntry(document);
  mountSecondPhaseEntry(document);
  assert.equal(choices.children.length, 3);
  assert.equal(choices.children[0], expert);
  assert.equal(choices.children[2], past);
  assert.equal(choices.children[1].hasAttribute('data-phase2-entry'), true);
  assert.equal(expert.textContent, originalExpert);
  assert.equal(past.textContent, originalPast);
  assert.deepEqual([...expert.attributes], expertAttributes);
  assert.deepEqual([...past.attributes], pastAttributes);
  assert.deepEqual(expert.children, expertChildren);
  assert.deepEqual(past.children, pastChildren);
  assert.equal(choices.querySelectorAll('[data-phase2-entry]').length, 1);
});

test('mounting is safe without the activity list and appends once when the archived card is absent', () => {
  assert.doesNotThrow(() => mountSecondPhaseEntry(entryDocument('<main></main>')));
  const document = entryDocument('<section class="ac-choices"><button data-action="event:expert">双11扭蛋活动</button></section>');
  const choices = document.querySelector('.ac-choices'), expert = choices.children[0];
  mountSecondPhaseEntry(document);
  mountSecondPhaseEntry(document);
  assert.equal(choices.children.length, 2);
  assert.equal(choices.children[0], expert);
  assert.equal(choices.children[1].hasAttribute('data-phase2-entry'), true);
});

function runEntry(balance) {
  const document = entryDocument(`<main id="ac-content" aria-labelledby="tab-lottery">${originalChoices}</main>`);
  const routes = [], windowListeners = new Map();
  const context = vm.createContext({
    document,
    window: {jianxNavigate: route => routes.push(route), addEventListener: (name, callback) => windowListeners.set(name, callback)},
    loadPhase2: () => ({draws: []}), phase2Now: () => 0, available: () => balance,
    MutationObserver: class {observe() {}}, queueMicrotask: callback => callback(),
  });
  vm.runInContext(entrySource.replace(/^import .*;\s*$/gm, '').replace(/\bexport\s+(?=function)/g, ''), context);
  return {document, routes, windowListeners};
}

test('clicking the new illustration still enters EB05, without intercepting either original activity', () => {
  const {document, routes} = runEntry({ordinary: 0, welcome: 0});
  const click = target => document.events.get('click').forEach(handler => handler({target}));
  click(document.querySelector('.eb05-entry-illustration'));
  click(document.querySelector('[data-action="event:expert"]'));
  click(document.querySelector('[data-action="event:card-past"]'));
  assert.deepEqual(routes, ['card-eb05']);
});

test('the entry retains live total-ticket labels and restores the generic action when its balance is zero', () => {
  const balance = {ordinary: 3, welcome: 5};
  const {document, windowListeners} = runEntry(balance);
  assert.equal(document.querySelector('[data-phase2-entry] b').textContent.trim(), '可用 8 张券');
  balance.ordinary = 0;
  balance.welcome = 0;
  windowListeners.get('jianx-shell')({detail: {type: 'activate'}});
  assert.equal(document.querySelector('[data-phase2-entry] b').textContent.trim(), '查看活动');
  assert.equal(document.querySelectorAll('[data-phase2-entry]').length, 1);
});
