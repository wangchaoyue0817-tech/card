import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDocument} from './dom-fixture.mjs';
import {isEligibleCategory} from '../../public/events/expert-event-model.js';

const source = filename => readFileSync(new URL(`../../public/events/${filename}`, import.meta.url), 'utf8');
function fixture() {
  const document = createDocument(source('home.html'));
  const window = {addEventListener() {}, jianxRoute() {}};
  const location = {href: 'http://localhost/home.html', search: ''};
  const context = vm.createContext({
    window, document, location, URL, URLSearchParams,
    history: {replaceState(_state, _title, url) { location.href = String(url); }},
    matchMedia: () => ({matches: true}),
    ResizeObserver: class { observe() {} },
    requestAnimationFrame() {}, setInterval() {}, clearInterval() {}, setTimeout() {}, clearTimeout() {}
  });
  for (const filename of ['data.js', 'assets/icon-map.js', 'app.js', 'expert-catalog.js', 'expert-event-categories.js', 'expert-picker.js']) {
    vm.runInContext(source(filename), context, {filename});
  }
  return {document, window, context, node: id => document.getElementById(id), catalog: vm.runInContext('EXPERT_CATALOG', context)};
}

test('home and expert controllers initialize against the actual HTML with no dangling DOM bindings', () => {
  const f = fixture();
  assert.equal(typeof f.node('expertCta').onclick, 'function');
  f.node('expertCta').click();
  assert.equal(f.node('expertPickerRoot').hidden, false);
  assert.equal(f.node('expertPickerRoot').dataset.view, 'categories');
  assert.equal(f.node('epCategoryGrid').children.length, 28);
  assert.equal(f.node('epCategoryTabs').children.length, 28);
  f.node('epClose').click();
  assert.equal(f.node('expertPickerRoot').hidden, true);
});

test('all 28 categories retain original prices while displaying free expert appraisal', () => {
  const f = fixture();
  assert.equal(f.catalog.length, 28);
  assert.equal(new Set(f.catalog.map(category => category.id)).size, 28);
  f.node('expertCta').click();
  let checkedGroups = 0, checkedStyles = 0;
  for (const [index, category] of f.catalog.entries()) {
    assert.ok(category.name && category.groupLabel && category.styleLabel && category.icon, category.id);
    assert.ok(Number.isInteger(category.price) && category.price > 0, category.id);
    assert.ok(category.groups.length > 0, category.id);
    const categoryButton = f.node('epCategoryGrid').children[index];
    assert.equal(categoryButton.querySelector('del').textContent, `¥${(category.price / 100).toFixed(2)}`);
    assert.equal(categoryButton.querySelector('.ep-category-price strong').textContent, '0元');
    assert.match(categoryButton.getAttribute('aria-label'), /限时免费0元/);
    f.node('epCategoryGrid').children[index].click();
    assert.equal(f.node('epOriginalPrice').textContent, `¥${(category.price / 100).toFixed(2)}`);
    assert.equal(f.node('epPrice').textContent, '0 元');
    assert.match(f.node('epProductView').querySelector('.ep-free-notice').textContent, /全品类限时免费/);
    for (const [groupIndex, group] of category.groups.entries()) {
      assert.ok(group.name && group.styles.length, `${category.id}: group ${groupIndex}`);
      f.node('epGroups').querySelector(`[data-ep-group="${groupIndex}"]`).click();
      assert.equal(f.node('epStyles').querySelectorAll('[data-ep-style]').length, group.styles.length);
      for (const [styleIndex, style] of group.styles.entries()) {
        const name = typeof style === 'string' ? style : style.name;
        assert.ok(typeof name === 'string' && name.trim(), `${category.id}: style ${styleIndex}`);
        f.node('epStyles').querySelector(`[data-ep-style="${styleIndex}"]`).click();
        assert.equal(f.node('epConfirm').disabled, false);
        assert.equal(f.node('epConfirm').textContent, '0元开始鉴定');
        assert.ok(f.node('epSelection').textContent.includes(name));
        checkedStyles++;
      }
      checkedGroups++;
    }
  }
  assert.ok(checkedGroups >= 28 && checkedStyles >= checkedGroups);
});

test('exactly seven catalog categories show the activity corner badge and share model eligibility', () => {
  const f = fixture();
  const expected = ['3C无损','包袋','服饰','数码家电','手表','美妆','鞋靴'].sort();
  const marked = [];
  for (const [index, category] of f.catalog.entries()) {
    const card = f.node('epCategoryGrid').children[index];
    const badge = card.querySelector('.ep-category-activity');
    assert.equal(Boolean(badge), isEligibleCategory(category), category.name);
    assert.equal(card.classList.contains('has-activity'), Boolean(badge));
    if (badge) {
      marked.push(category.name);
      assert.equal(badge.textContent, '活动');
      assert.match(card.getAttribute('aria-label'), /参与双11活动/);
      badge.click();
      assert.equal(f.node('epSelection').textContent, category.name, 'corner badge remains part of the category click target');
    } else {
      assert.doesNotMatch(card.getAttribute('aria-label'), /参与双11活动/);
    }
  }
  assert.deepEqual(marked.sort(), expected);
  assert.equal(f.node('epCategoryGrid').querySelectorAll('.ep-category-activity').length, 7);
  assert.ok(source('home.html').indexOf('src="expert-event-categories.js"') < source('home.html').indexOf('src="expert-picker.js"'));
});

test('brand and style search filter actual options and recover after no-result queries', () => {
  const f = fixture();
  f.node('expertCta').click();
  f.node('epCategoryGrid').children[0].click();
  f.node('epGroupSearch').value = 'Chanel';
  f.node('epGroupSearch').dispatchEvent({type: 'input'});
  assert.equal(f.node('epGroups').querySelectorAll('[data-ep-group]').length, 1);
  f.node('epGroups').querySelector('[data-ep-group]').click();
  f.node('epStyleSearch').value = 'classic';
  f.node('epStyleSearch').dispatchEvent({type: 'input'});
  assert.equal(f.node('epStyles').querySelectorAll('[data-ep-style]').length, 1);
  assert.match(f.node('epStyles').textContent, /Classic Flap/);
  f.node('epStyleSearch').value = 'does-not-exist';
  f.node('epStyleSearch').dispatchEvent({type: 'input'});
  assert.equal(f.node('epStyles').querySelectorAll('[data-ep-style]').length, 0);
  assert.match(f.node('epStyles').textContent, /没有找到/);
  f.node('epStyleSearch').value = '';
  f.node('epStyleSearch').dispatchEvent({type: 'input'});
  assert.equal(f.node('epStyles').querySelectorAll('[data-ep-style]').length, 3);
});

test('feedback, agreement, and selection confirmation retain their interactive safeguards', () => {
  const f = fixture();
  f.node('expertCta').click();
  f.node('epCategoryGrid').children[0].click();
  f.node('epGroups').querySelector('[data-ep-group]').click();
  f.node('epStyles').querySelector('[data-ep-style]').click();
  f.node('epConfirm').click();
  assert.match(f.node('epStatus').textContent, /请先阅读并勾选/);
  f.node('epAgreementLink').click();
  assert.equal(f.node('expertPickerRoot').dataset.view, 'agreement');
  assert.match(f.node('epAuxView').textContent, /在线鉴别服务协议/);
  f.node('epBack').click();
  f.node('epFeedback').click();
  f.node('epSaveFeedback').click();
  assert.match(f.node('epFeedbackStatus').textContent, /请先填写/);
  f.node('epFeedbackText').value = '宝可梦卡牌 新增系列';
  f.node('epSaveFeedback').click();
  assert.match(f.node('epFeedbackStatus').textContent, /已在本次演示中记录/);
  f.node('epBack').click();
  f.node('epFeedback').click();
  assert.equal(f.node('epFeedbackText').value, '宝可梦卡牌 新增系列');
  f.node('epBack').click();
  f.node('epAgree').checked = true;
  f.node('epAgree').dispatchEvent({type: 'change'});
  f.node('epConfirm').click();
  assert.match(f.node('epConfirm').textContent, /已确认选择/);
  assert.match(f.node('epStatus').textContent, /未创建订单或扣费/);
});

test('free selection continues to the expert upload flow with the selected product and unchanged original price', () => {
  const f = fixture();
  const selections = [];
  f.window.onExpertSelected = product => selections.push(product);
  const categoryIndex = f.catalog.findIndex(category => category.id === 'beauty');
  const category = f.catalog[categoryIndex], group = category.groups[0];
  const style = typeof group.styles[0] === 'string' ? group.styles[0] : group.styles[0].name;
  f.node('expertCta').click();
  f.node('epCategoryGrid').children[categoryIndex].click();
  f.node('epGroups').querySelector('[data-ep-group="0"]').click();
  f.node('epStyles').querySelector('[data-ep-style="0"]').click();
  assert.equal(f.node('epConfirm').textContent, '0元开始鉴定');
  f.node('epConfirm').click();
  assert.equal(selections.length, 0, 'service agreement remains required');
  f.node('epAgree').checked = true;
  f.node('epAgree').dispatchEvent({type: 'change'});
  f.node('epConfirm').click();
  assert.equal(selections.length, 1);
  assert.equal(selections[0].category, category.name);
  assert.equal(selections[0].brand, group.name);
  assert.equal(selections[0].style, style);
  assert.equal(selections[0].name, `${group.name} · ${style}`);
  assert.equal(selections[0].price, category.price, 'display promotion must not mutate the catalog price');
  assert.equal(f.node('expertPickerRoot').hidden, true);
});
