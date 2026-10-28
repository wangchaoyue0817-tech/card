import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PHASE2, START, END, PRIZES} from '../public/phase2-model.js';

const doc = readFileSync(new URL('../docs/eb05-phase2-delta-prd.md', import.meta.url), 'utf8');

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

test('phase two PRD preserves critical exceptions and distinguishes demo limits from pending decisions', () => {
  for (const text of ['1 张专家鉴定券', '不返还抽奖券', '不重新抽取', '库存跨日持续扣减', '已填也不可修改', '仅转发本身不发券', '关闭、离开或刷新后当天不可补领', '有效 7 天', '首页传图识别卡牌暂不触发', '当前范围为前端 Demo', '当前 Demo 仅累计本机演示结果', '跨阶段去重']) {
    assert.ok(doc.includes(text), text);
  }
  for (const heading of ['差异总览', '活动入口与页面范围', '获券规则与进度统计', '奖池开放与补位', '页面表达调整', '开发范围与当前完成度', '验收条件', '待确认事项']) {
    assert.ok(doc.includes(`## ${heading}`), heading);
  }
  assert.match(doc, /原规则文档中的“邀请链接”废弃/);
  assert.match(doc, /不宣称已完成真实用券闭环/);
  assert.match(doc, /本需求文档不修改线上页面/);
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.ok(readme.includes('docs/eb05-phase2-delta-prd.md'));
});
