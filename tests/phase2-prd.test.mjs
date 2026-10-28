import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PHASE2, START, END, PRIZES} from '../public/phase2-model.js';

const doc = readFileSync(new URL('../docs/eb05-phase2-delta-prd.md', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('phase two PRD comparison follows the eleven user-confirmed changes without reclassifying retained rules', () => {
  const comparison = doc.split('## 差异总览\n')[1].split('\n## ')[0];
  const rows = comparison.split('\n').filter(line => line.startsWith('| ')).slice(2);
  const expected = [
    ['活动组织', '复用并扩展'],
    ['活动时间与主题', '调整'],
    ['新人礼触发', '沿用'],
    ['普通抽奖概率', '调整'],
    ['新人抽奖概率', '沿用'],
    ['实物奖品', '调整'],
    ['单品抽取方式', '新增'],
    ['奖池开放条件', '新增'],
    ['库存与补位', '新增'],
    ['记录与券状态', '复用'],
    ['邀请方式', '复用'],
  ];
  assert.equal(rows.length, expected.length);
  const cells = rows.map(row => row.split('|').map(cell => cell.trim()).filter(Boolean));
  cells.forEach((row, index) => {
    assert.equal(row.length, 4);
    assert.deepEqual([row[0], row[3]], expected[index]);
  });
  assert.equal(cells[2][1], cells[2][2], 'the two-entry welcome rule is unchanged');
  assert.match(doc, /获券数量、每日额度、结果累计及支付／结果分流均不作为本期新增/);
  assert.doesNotMatch(doc, /新增联动|新增的是与奖池开放进度的关联|收窄入口/);
});

test('phase two PRD preserves both welcome triggers and separates confirmed requirements from the demo gap', () => {
  for (const text of [
    '两个入口共用同一份领取资格',
    '同一用户本活动仅领一次，共 5 张',
    '不再次发放、不重置有效期',
    '识别为卡牌且出现选款入口时',
    '不是上传完成，也不要求点击选款入口或完成鉴定',
    '先走二级页再走首页识别，或先走首页识别再进入二级页',
    '新人礼双入口尚未完全同步',
    '这是修正实现与既有规则的偏差，不是新增业务规则',
  ]) {
    assert.ok(doc.includes(text), text);
  }
  for (const content of [doc, readme]) {
    assert.doesNotMatch(content, /首页传图识别卡牌暂不触发|首页图片识别转入暂不触发|首页传图路径不触发新人礼|首页传图识别卡牌进入的路径，本期不触发新人礼/);
  }
  assert.match(readme, /两入口共用一次领取资格，不重复领取、不重置有效期/);
  assert.match(readme, /当前 Demo 与最新确认需求的差距/);
  assert.match(readme, /不能据此认定双入口功能已经完成/);
});

test('phase two PRD dates and probability baseline match the confirmed campaign', () => {
  assert.equal(START, Date.parse('2026-10-30T00:00:00+08:00'));
  assert.equal(END, Date.parse('2026-11-06T00:00:00+08:00'));
  assert.match(doc, /2026\.10\.30 00:00—11\.05 23:59/);
  assert.ok(doc.includes(`实物 ${PHASE2.ordinary.physicalPercent}%，专家鉴定券 ${PHASE2.ordinary.voucherPercent}%`));
  assert.ok(doc.includes(`实物 ${PHASE2.welcome.physicalPercent}%，专家鉴定券 ${PHASE2.welcome.voucherPercent}%`));
  assert.match(doc, /实物 5%，专家鉴定券 95%/);
});

test('phase two PRD prize inventory weights and release thresholds match the model', () => {
  const rows = doc.split('\n').filter(line => /^\| (乔巴杂志|海贼精选套装|海贼 EB05 单包|海贼 EB05 整盒) \|/.test(line));
  assert.equal(rows.length, PRIZES.length);
  PRIZES.forEach((prize, index) => {
    const cells = rows[index].split('|').map(cell => cell.trim()).filter(Boolean);
    assert.equal(cells[1], prize.spec);
    assert.equal(cells[2], `${prize.quantity} 份`);
    assert.equal(cells[3], `${prize.weight}%`);
    assert.ok(cells[4].includes(prize.threshold ? `${prize.threshold} 单` : '全程开放'));
  });
  assert.equal(PRIZES.reduce((sum, prize) => sum + prize.quantity, 0), 46);
});

test('phase two PRD preserves critical exceptions and distinguishes demo limits from requirements', () => {
  for (const text of ['1 张专家鉴定券', '不返还抽奖券', '不重新抽取', '库存跨日持续扣减', '已填也不可修改', '仅转发本身不发券', '关闭、离开或刷新后当天不可补领', '有效 7 天', '当前范围为前端 Demo', '当前 Demo 仅累计本机演示结果', '统计范围及同一鉴定跨阶段的去重沿用既有口径']) {
    assert.ok(doc.includes(text), text);
  }
  for (const heading of ['差异总览', '活动入口与页面范围', '获券规则与进度统计', '奖池开放与补位', '其他已确认规则', '修改与复用清单', '当前 Demo 与需求的衔接', '验收条件']) {
    assert.ok(doc.includes(`## ${heading}`), heading);
  }
  assert.match(doc, /沿用转发小程序邀请，没有邀请链接/);
  assert.match(doc, /不宣称已完成真实用券闭环/);
  assert.match(doc, /本需求文档不修改线上页面/);
  assert.doesNotMatch(doc, /## 待确认事项/);
  assert.ok(readme.includes('docs/eb05-phase2-delta-prd.md'));
});
