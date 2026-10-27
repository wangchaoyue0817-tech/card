import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {voucherMarkup,ticketEmblem} from '../public/reward-ui.js';
test('expert coupon and shared ticket icon use the bright violet design',()=>{
  assert.match(ticketEmblem(),/icons\/crystal-reward\.svg/);
  assert.doesNotMatch(ticketEmblem(),/seal-check\.svg/);
  assert.match(voucherMarkup(2,Date.UTC(2026,9,2)),/reward-coupon/);
  assert.match(voucherMarkup(2,Date.UTC(2026,9,2)),/去使用/);
  assert.doesNotMatch(ticketEmblem(),/obsidian-ticket|pearl-ticket/);
});
test('shared ticket surfaces contain no retired white coupon backgrounds',()=>{
  const css=readFileSync(new URL('../public/skin-alignment.css',import.meta.url),'utf8');
  for(const color of ['#f9f6ff','#e6ddfb','#e5d8fc','#c7b2f0','#f5f1ff','#e4dafa','#ece4fc','#d9c8f6','#f0e9ff','#cdb9f0'])assert.ok(!css.includes(color),color);
  assert.match(css,/Bright violet coupon system/);
  assert.doesNotMatch(css,/#191923|#0d0e16/);
});
