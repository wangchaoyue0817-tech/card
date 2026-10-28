import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDocument} from './events/dom-fixture.mjs';
import {sidebarIcons} from '../public/sidebar-icons.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const drawerSource = read('public/ui-common.js');
const drawerCss = read('public/drawer.css');

function drawerFixture(actions = {}) {
  const document = createDocument('<body><main id="app"><button id="menu" type="button">菜单</button><div id="page-content">首页</div></main></body>');
  document.removeEventListener = (type, listener) => {
    document.events.set(type, (document.events.get(type) || []).filter(item => item !== listener));
  };
  const navigation = [], timers = new Map();
  let nextTimer = 0;
  const context = vm.createContext({
    document, sidebarIcons, actions,
    window: {jianxNavigate: route => navigation.push(route), jianxNewChat: () => navigation.push('home')},
    setTimeout(callback) {timers.set(++nextTimer, callback); return nextTimer;},
    clearTimeout(id) {timers.delete(id);}
  });
  const executable = drawerSource.replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(`${executable}\nthis.drawer = setupDrawer(document.getElementById('menu'), actions);`, context);
  const openButton = document.getElementById('menu');
  openButton.focus();
  openButton.click();
  return {document, navigation, timers, drawer: context.drawer, openButton};
}

const iconPaths = markup => [...markup.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1]);

test('homepage shortcuts are expert, yellow lottery and purple human support from left to right', () => {
  const {document} = drawerFixture();
  const row = document.querySelector('.drawer-shortcuts.has-lottery');
  assert.deepEqual(row.children.map(button => button.querySelector('b').textContent), ['专鉴服务', '抽奖中心', '人工客服']);
  assert.equal(row.children[1].classList.contains('drawer-lottery-entry'), true);
  assert.equal(row.children[2].classList.contains('drawer-support-entry'), true);
  assert.equal(row.children[2].hasAttribute('data-support'), true);
  for (const button of row.children.slice(1)) {
    assert.equal(button.tagName, 'BUTTON');
    assert.equal(button.getAttribute('type'), 'button');
  }
  assert.equal(row.children[2].getAttribute('aria-label'), '人工客服');
  assert.equal(row.querySelector('[data-orders]'), null);
  assert.doesNotMatch(row.textContent, /商品订单/);
  assert.doesNotMatch(drawerSource, /\bdata-orders\b|\bonOrders\b/);
  assert.ok(sidebarIcons.Headset, 'support must use a dedicated headset icon from the existing icon family');
  assert.deepEqual(row.children[2].querySelectorAll('path').map(path => path.getAttribute('d')), iconPaths(sidebarIcons.Headset));
  assert.deepEqual(row.children[1].querySelectorAll('path').map(path => path.getAttribute('d')), iconPaths(sidebarIcons.Gift));
  for (const button of row.children.slice(1)) {
    assert.equal(button.querySelector('svg').getAttribute('aria-hidden'), 'true');
  }
});

test('lottery shortcut keeps its real route and restores the page when the drawer closes', () => {
  const {document, drawer, navigation, openButton} = drawerFixture();
  assert.equal(drawer.element.getAttribute('aria-hidden'), 'false');
  assert.equal(document.getElementById('page-content').inert, true);
  document.querySelector('.drawer-lottery-entry').click();
  assert.deepEqual(navigation, ['lottery']);
  assert.equal(drawer.element.getAttribute('aria-hidden'), 'true');
  assert.equal(drawer.element.inert, true);
  assert.equal(document.getElementById('page-content').inert, false);
  assert.equal(document.activeElement, openButton);
});

test('human support gives honest demo feedback instead of opening product orders', () => {
  const {document, drawer, navigation} = drawerFixture();
  document.querySelector('[data-support]').click();
  assert.deepEqual(navigation, []);
  assert.equal(drawer.element.getAttribute('aria-hidden'), 'true');
  const status = document.getElementById('cl-toast');
  assert.ok(status);
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, '人工客服尚未接入，当前为演示入口');
});

test('human support can call an explicit integration handler without fake fallback feedback', () => {
  let supportCalls = 0;
  const {document, drawer, navigation} = drawerFixture({onSupport: () => supportCalls++});
  document.querySelector('[data-support]').click();
  assert.equal(supportCalls, 1);
  assert.deepEqual(navigation, []);
  assert.equal(document.getElementById('cl-toast'), null);
  assert.equal(drawer.element.inert, true);
});

test('shortcut color roles override position-based styles while retaining the existing three-column layout', () => {
  assert.match(drawerCss, /\.has-lottery\s*\{[^}]*grid-template-columns\s*:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  for (const [name, color] of [['lottery', '#eccb73'], ['support', '#b5a9ff']]) {
    const selector = `.app-drawer .drawer-shortcuts.two-columns .drawer-shortcut.drawer-${name}-entry`;
    const rules = [...drawerCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(match => match[1].includes(selector)).map(match => match[2]).join('\n');
    assert.ok(rules, `${name} needs an explicit theme class, not only nth-child coloring`);
    assert.ok(rules.toLowerCase().includes(color), `${name} should use ${color}`);
  }
  assert.match(drawerCss, /focus-visible/);
});

test('replacing the homepage order shortcut does not remove the existing product-order route', () => {
  assert.match(read('public/site-shell.js'), /\borders\s*:\s*['"]skin['"]/);
  assert.match(read('public/site-shell.js'), /\borders\s*:\s*['"]商品订单['"]/);
  assert.match(read('public/home-card-entry.js'), /setupDrawer\(button\)/);
  assert.match(read('public/home-card-entry.js'), /['"]drawer\.css['"]/);
});

test('exported sidebar icons are standalone transparent outlines with design-system accent colors', () => {
  for (const [file, label, icon, color] of [
    ['lottery-center.svg', '抽奖中心', 'Gift', '#F4D475'],
    ['customer-support.svg', '人工客服', 'Headset', '#C8BAFF']
  ]) {
    const svg = read(`public/assets/sidebar/${file}`);
    assert.match(svg, /<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /\bviewBox="0 0 256 256"/);
    assert.match(svg, /\bwidth="64" height="64"/);
    assert.match(svg, /\brole="img"/);
    const titleId = svg.match(/aria-labelledby="([^"]+)"/)?.[1];
    assert.ok(titleId && svg.includes(`<title id="${titleId}">${label}</title>`), 'retain the accessible name without a visible text label');
    const descId = svg.match(/aria-describedby="([^"]+)"/)?.[1];
    assert.ok(descId && svg.includes(`<desc id="${descId}">`));
    assert.ok(svg.includes(`fill="${color}"`), `${file} should use its design-system foreground token`);
    assert.deepEqual(iconPaths(svg), [iconPaths(sidebarIcons[icon]).at(-1)], 'retain the actual icon outline; omit the duotone fill, card and pedestal');
    const markup = svg.replace(/<!--[\s\S]*?-->/g, '');
    const tags = [...markup.matchAll(/<([a-zA-Z][\w:-]*)\b/g)].map(match => match[1]);
    assert.deepEqual(tags, ['svg', 'title', 'desc', 'path'], 'only the glyph may paint; no background, filter or visible label');
    assert.doesNotMatch(markup, /\b(?:style|opacity|filter|transform)\s*=/i, 'do not hide or rescale the outline');
    assert.match(svg, /Copyright \(c\) 2020 Phosphor Icons/, 'standalone source retains attribution');
    assert.doesNotMatch(svg, /<(?:image|foreignObject|script)\b|@import|data:image|(?:href|src)\s*=\s*["'](?:https?:|\/)/i);
    for (const match of svg.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/g)) {
      assert.ok(match[1].startsWith('#'), 'SVG assets must not depend on external images or other files');
    }
  }
});
