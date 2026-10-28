import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDocument} from './events/dom-fixture.mjs';
import {esc, glyph} from '../public/events/ui-common.js';
import {ticketEmblem} from '../public/events/reward-ui.js';
import {available, fresh, END} from '../public/events/lottery-model.js';

const appSource = readFileSync(new URL('../public/events/card-app.js', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../public/events/card.html', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../public/events/phase2-card-entry.js', import.meta.url), 'utf8');
const pageSource = appSource.slice(appSource.indexOf('function cardPage(){'), appSource.indexOf('function chooseStyle(){'));
const pickerSource = appSource.slice(appSource.indexOf('function chooseStyle(){'), appSource.indexOf('function showGrant('));
const buttonSource = appSource.match(/^const btn=.*;$/m)?.[0];
const disclosure = '演示页面 · 图片仅本机预览，结果不作鉴定凭证';

function cardPage(overrides = {}) {
  const context = {
    esc, glyph, ticketEmblem, available,
    data: fresh(), now: () => END + 1, fmt: () => '10/30 12:00',
    fileURL: '', sample: false, report: null, busy: false,
    cardBrand: '', cardStyle: '', chatMessage: '', ...overrides
  };
  assert.ok(buttonSource && pageSource.startsWith('function cardPage(){'), 'exercise the real card page renderer');
  const document = createDocument(shellSource);
  document.getElementById('card-content').innerHTML = vm.runInNewContext(`${buttonSource}\n${pageSource}\ncardPage()`, context);
  return document;
}

test('card landing uses a direct service title without slogans, repeated capability chips or teaching paragraphs', () => {
  const document = cardPage();
  const intro = document.querySelector('.card-intro');
  assert.ok(intro);
  assert.match(document.getElementById('nav-title').textContent, /卡牌鉴定/);
  const heading = intro.querySelector('h2');
  assert.match(heading.textContent, /AI 初鉴/);
  assert.equal(heading.querySelector('em').textContent, '专家复核');
  assert.equal(heading.querySelectorAll('br').length, 1, 'service paths share a clear two-line heading');
  assert.doesNotMatch(heading.textContent, /卡牌鉴定|读懂|每一处|热爱|惊喜/);
  for (const selector of ['.card-hero-kicker', '.card-intro-description', '.card-category-pills']) {
    assert.equal(intro.querySelector(selector), null, `${selector} should be removed from the DOM, not hidden`);
  }
  assert.equal(intro.querySelector('.card-spectrum-core small'), null);
  assert.equal(intro.querySelector('.card-spectrum-art').getAttribute('aria-hidden'), 'true');
  assert.equal(document.querySelector('.card-upload-cta'), null, 'do not restore the rejected standalone upload CTA');
  assert.equal(document.querySelectorAll('[data-action="upload"]').length, 1, 'one clear upload entry remains in the composer');
});

test('demo tools remain available inside one initially collapsed native disclosure', () => {
  const document = cardPage();
  const options = document.querySelector('details.card-demo-options');
  assert.ok(options);
  assert.equal(options.hasAttribute('open'), false);
  assert.equal(options.querySelector('summary').textContent, '演示选项');
  for (const action of ['sample', 'demo']) {
    const button = options.querySelector(`button[data-action="${action}"]`);
    assert.ok(button, `${action} still has a real action button`);
    assert.ok(button.textContent.trim());
    assert.equal(document.querySelectorAll(`[data-action="${action}"]`).length, 1);
  }
});

test('EB05 entry survives rerenders without decorative English or an inaccessible image-only button', () => {
  const document = cardPage();
  const end = entrySource.indexOf('updateEntry();');
  assert.ok(end > 0);
  vm.runInNewContext(`${entrySource.slice(0, end)}\nupdateEntry();updateEntry();`, {document});
  const entry = document.querySelector('button.card-luck-entry');
  assert.ok(entry);
  assert.equal(entry.dataset.action, 'open-eb05-preview');
  assert.equal(entry.dataset.phase2, 'true');
  assert.match(entry.querySelector('strong').textContent, /海贼.*EB05/);
  assert.ok(entry.querySelector('em').textContent.trim(), 'retain activity metadata as live text');
  assert.equal(entry.querySelector('.card-luck-copy small'), null);
  assert.equal(entry.querySelector('.card-luck-banner-art').getAttribute('alt'), '');
});

test('an uploaded image has one clear style-selection action instead of three copies of instructions', () => {
  const document = cardPage({sample: true});
  const recognition = document.querySelector('.card-recognition');
  assert.ok(recognition);
  assert.equal(recognition.querySelector('img').getAttribute('alt'), '待鉴定卡牌');
  assert.equal(recognition.querySelector('[data-action="choose-style"]').textContent, '选择品牌与款式');
  assert.equal(recognition.querySelector('[data-action="identify"]'), null);
  assert.equal(recognition.querySelector('p'), null);
  assert.doesNotMatch(recognition.textContent, /上传成功|暂不支持自动匹配|请先选择/);
});

test('selected styles stay visible and the next action states AI appraisal, including its busy state', () => {
  for (const busy of [false, true]) {
    const document = cardPage({sample: true, cardBrand: '宝可梦', cardStyle: '角色收藏卡', busy});
    const recognition = document.querySelector('.card-recognition');
    assert.match(recognition.querySelector('.card-upload-message').textContent, /宝可梦 · 角色收藏卡/);
    const action = recognition.querySelector('[data-action="identify"]');
    assert.equal(action.textContent, busy ? '正在鉴定…' : '开始 AI 鉴定');
    assert.equal(action.disabled, busy);
    assert.ok(recognition.querySelector('[data-action="choose-style"]'), 'changing the selected style remains available');
  }
});

test('composer keeps accessible names, a usable upload action and one honest demo disclosure', () => {
  const document = cardPage();
  const message = document.getElementById('card-message');
  assert.equal(document.querySelector('label[for="card-message"]').textContent, '卡牌照片与问题', 'a visible label must survive copy reduction');
  assert.equal(message.getAttribute('placeholder'), '上传卡牌正面照，或输入问题');
  assert.equal(message.getAttribute('aria-label'), '卡牌鉴定对话');
  assert.equal(message.getAttribute('maxlength'), '250');
  assert.match(document.querySelector('[data-action="upload"]').textContent, /上传照片/);
  assert.equal(document.getElementById('card-upload').getAttribute('type'), 'file');
  assert.equal(document.getElementById('card-upload').getAttribute('accept'), 'image/*');
  assert.equal(document.getElementById('card-send').getAttribute('aria-label'), '发送卡牌鉴定消息');
  assert.equal(document.getElementById('card-send').disabled, true);
  assert.equal(document.getElementById('nav-back').getAttribute('aria-label'), '返回首页');
  assert.equal(document.getElementById('nav-menu').getAttribute('aria-label'), '打开功能导航');
  assert.equal(document.body.textContent.split(disclosure).length - 1, 1);
  assert.doesNotMatch(document.body.textContent, /本服务由 AI 提供，请注意甄别|图片仅在本机预览 · 鉴定结果为模拟展示/);
});

test('chat content is escaped and report states preserve simulation and evidence limits', () => {
  const document = cardPage({chatMessage: '<script>not executable</script>', report: {id: 'card-report-12345678', at: END, expert: false}});
  const chat = document.querySelector('.card-chat-message');
  assert.equal(chat.querySelector('script'), null);
  assert.match(chat.textContent, /<script>not executable<\/script>/);
  assert.equal(chat.querySelector('small'), null, 'do not repeat upload instructions beneath each chat message');
  const report = document.querySelector('.cl-report');
  assert.equal(report.querySelector('.cl-tag').textContent, '模拟结果');
  assert.match(report.textContent, /无法确认真伪/);
  assert.ok(report.querySelector('[data-action="expert"]'));
  assert.match(report.querySelector('.cl-footnote').textContent, /报告编号 12345678/);
  const reviewed = cardPage({report: {id: 'card-report-12345678', at: END, expert: true}});
  assert.match(reviewed.querySelector('.cl-expert-done').textContent, /不构成真实鉴定凭证/);
});

function picker(overrides = {}) {
  const document = createDocument(shellSource), actions = [];
  let title = '', closed = 0, uploads = 0;
  document.getElementById('card-upload').onclick = () => uploads++;
  const context = {
    esc, glyph, sample: true, fileURL: '', cardBrand: '', cardStyle: '', ...overrides,
    $: id => document.getElementById(id),
    modal(nextTitle, body) {
      title = nextTitle;
      document.getElementById('card-dialog').innerHTML = body;
      const form = document.getElementById('card-style-form');
      form.elements = Object.fromEntries(form.querySelectorAll('select').map(element => [element.getAttribute('name'), element]));
      form.reportValidity = () => Boolean(form.elements.brand.value && form.elements.style.value);
    },
    closeModal: () => closed++, action: name => actions.push(name)
  };
  vm.runInNewContext(`${pickerSource}\nchooseStyle();`, context);
  return {document, actions, context, get title() { return title; }, get closed() { return closed; }, get uploads() { return uploads; }};
}

test('style form retains required labels, dependent selection and validation without repeating the onboarding paragraph', () => {
  const result = picker(), form = result.document.getElementById('card-style-form');
  assert.equal(result.title, '选择品牌与款式');
  assert.ok(form);
  for (const [name, label] of [['brand', '卡牌品牌'], ['style', '卡牌款式']]) {
    const select = form.elements[name];
    assert.equal(select.hasAttribute('required'), true);
    assert.equal(select.closest('label').textContent.startsWith(label), true);
  }
  assert.equal(form.elements.style.disabled, true);
  assert.equal(result.document.getElementById('card-dialog').querySelector('.cl-muted'), null);
  form.onsubmit({preventDefault() {}});
  assert.deepEqual(result.actions, [], 'incomplete fields do not start appraisal');
  form.elements.brand.value = '宝可梦';
  form.elements.brand.onchange();
  assert.equal(form.elements.style.disabled, false);
  assert.ok(form.elements.style.querySelectorAll('option').some(option => option.textContent === '角色收藏卡'));
  form.elements.style.value = '角色收藏卡';
  form.onsubmit({preventDefault() {}});
  assert.deepEqual(result.actions, ['identify']);
  assert.equal(result.closed, 1);
  assert.equal(result.context.cardBrand, '宝可梦');
  assert.equal(result.context.cardStyle, '角色收藏卡');
});

test('style-selection request without a photo opens the real upload input, not an empty form', () => {
  const result = picker({sample: false});
  assert.equal(result.uploads, 1);
  assert.equal(result.document.getElementById('card-style-form'), null);
  assert.deepEqual(result.actions, []);
});
