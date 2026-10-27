import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDocument} from './dom-fixture.mjs';
import {fresh} from '../../public/events/expert-event-model.js';
import {leaderboardMarkup} from '../../public/events/expert-event-ui.js';

const css=readFileSync(new URL('../../public/events/expert-event-ui.css',import.meta.url),'utf8');
const block=selector=>{
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`,'g'))][0]?.[1]||'';
};
const tokens=Object.fromEntries([...block('.ev-ranking-dialog').matchAll(/(--rank-[\w-]+)\s*:\s*(#[\da-f]{6})/gi)].map(([,name,value])=>[name,value]));
const luminance=hex=>{
  const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast=(foreground,background)=>{
  const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
};

test('quiet leaderboard surfaces remain dark while labels and scores retain readable contrast',()=>{
  const backgrounds=[tokens['--rank-page'],tokens['--rank-surface']];
  for(const color of backgrounds) {
    assert(color,'ranking surfaces have inspectable color tokens');
    assert(luminance(color)<.04,'large content surfaces must not become bright campaign panels');
    for(const name of ['--rank-text','--rank-muted','--rank-accent','--rank-gold'])
      assert(contrast(tokens[name],color)>=4.5,`${name} must remain readable against ${color}`);
  }
  // The pedestal top and current-user row are lighter than the ordinary list.
  for(const color of ['#3a365c','#302c50'])
    assert(contrast(tokens['--rank-muted'],color)>=4.5,`secondary labels need contrast on ${color}`);
  assert(contrast(tokens['--rank-text'],tokens['--rank-selected'])>=4.5,'selected tab label remains readable');
});

test('ranking controls stay touchable and keyboard navigation remains visible after visual changes',()=>{
  for(const selector of ['.ev-rank-rules-button','.ev-ranking-tabs button','.ev-my-rank button'])
    assert(Number(block(selector).match(/min-height:\s*(\d+)px/)?.[1])>=44,`${selector} keeps a 44px touch target`);
  const focused=block('.ev-ranking-dialog button:focus-visible,.ev-ranking-scroll:focus-visible');
  assert.match(focused,/outline:\s*[2-9]px\s+solid/,'keyboard users get a visible boundary');
  const document=createDocument(`<main>${leaderboardMarkup({...fresh('me'),demoRanking:true})}</main>`);
  assert.equal(document.querySelector('.ev-ranking-scroll').getAttribute('tabindex'),'0');
  assert.equal(document.querySelectorAll('.ev-ranking-tabs button[role="tab"]').length,2);
  assert(document.querySelector('[data-rank-expert]'));
  assert(document.querySelector('[data-rules]'));
});

test('long rankings have an independent scroll region and a non-scrolling personal summary',()=>{
  assert.match(block('.ev-ranking-scroll'),/overflow-y:\s*auto/);
  assert.match(block('.ev-ranking-scroll'),/min-height:\s*0/);
  assert.match(block('.ev-my-rank'),/flex-shrink:\s*0/);
  const document=createDocument(`<main>${leaderboardMarkup({...fresh('me'),demoRanking:true})}</main>`);
  const personal=document.querySelector('.ev-my-rank');
  assert.equal(personal.closest('.ev-ranking-scroll'),null,'personal summary is outside the scrolling list');
  assert.match(personal.textContent,/暂未上榜/);
  assert.doesNotMatch(css.slice(css.indexOf('/* Leaderboard:')),/leaderboard-podium-v3|#fff1c7|#f8edffbf/,'retired pale illustration and list panels are absent');
});
