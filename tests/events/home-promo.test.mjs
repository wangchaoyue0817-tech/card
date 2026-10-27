import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDocument} from './dom-fixture.mjs';

const source=filename=>readFileSync(new URL(`../../public/events/${filename}`,import.meta.url),'utf8');
function fixture(){
  const document=createDocument(source('home.html')),navigations=[];
  const window={addEventListener(){},jianxRoute(){},jianxNavigate(route,options){navigations.push({route,...options});}};
  const location={href:'http://localhost/home.html',search:''};
  const context=vm.createContext({
    window,document,location,URL,URLSearchParams,
    history:{replaceState(_state,_title,url){location.href=String(url);}},
    matchMedia:()=>({matches:true}),ResizeObserver:class{observe(){}},
    requestAnimationFrame(){},setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){}
  });
  for(const filename of ['data.js','assets/icon-map.js','app.js'])vm.runInContext(source(filename),context,{filename});
  return{document,window,context,navigations};
}

test('expert tab replaces only its own red dot with an always-present limited-free badge',()=>{
  const f=fixture(),expert=f.document.querySelector('[data-tab="expert"]'),ai=f.document.querySelector('[data-tab="ai"]');
  assert.equal(expert.querySelector('.home-mode-tab-dot'),null,'remove the expert red-dot element rather than hiding it');
  assert(ai.querySelector('.home-mode-tab-dot'),'keep the existing AI notification indicator');
  assert(f.document.querySelector('.icon-menu-badge'),'keep the existing menu notification indicator');
  assert.equal(f.document.querySelectorAll('.home-mode-tab-free').length,1);
  const badge=expert.querySelector('.home-mode-tab-free');
  assert.equal(badge.textContent,'限免');
  assert.equal(badge.getAttribute('title'),'限时免费');
  const css=source('expert-event-home.css');
  assert.match(css,/#app \[data-tab="expert"\] \.home-mode-tab-free\{[^}]*display:inline-flex/,
    'the badge presentation applies to the expert tab in both selected and unselected modes');
  for(const tab of [expert,ai,expert]){
    tab.click();
    assert.equal(badge.hidden,false);
    assert.equal(expert.querySelector('.home-mode-tab-free'),badge,'tab changes must not recreate or remove the badge');
    assert.equal(tab.getAttribute('aria-selected'),'true');
  }
});

test('winner ticker entirely removes voucher announcements and preserves the eight physical-prize announcements',()=>{
  const f=fixture(),ticker=f.document.getElementById('ticker');
  const announcements=Array.from(vm.runInContext('questions',f.context));
  assert.deepEqual(announcements,[
    '林** 抽中了 YSL气垫','苏** 抽中了 COACH腰带','周** 抽中了 香水小样','陈** 抽中了 雷蛇耳机',
    '叶** 抽中了 护肤品小样','江** 抽中了 COACH钱包','程** 抽中了 美妆小样','吴** 抽中了 香水小样'
  ]);
  assert.doesNotMatch(ticker.textContent,/专家鉴定券|许\*\*|宋\*\*|杨\*\*|王\*\*/);
  assert.equal(ticker.querySelectorAll('.suggestion-row').length,3);
  assert.equal(ticker.querySelectorAll('[data-winner]').length,announcements.length*2,'retain the duplicated loops for continuous scrolling');
  for(const row of ticker.querySelectorAll('.suggestion-row'))assert(row.querySelectorAll('[data-winner]').length>0);
});

test('remaining winner announcements still navigate to expert gacha and suppress accidental clicks after dragging',()=>{
  const f=fixture(),ticker=f.document.getElementById('ticker');
  const button=ticker.querySelector('[data-winner]'),label=button.querySelector('.suggestion-text');
  ticker.onclick({target:label});
  assert.deepEqual(f.navigations,[{route:'expert',intent:'gacha'}]);
  button.closest('.suggestion-track').dataset.noClick=String(Date.now()+10000);
  ticker.onclick({target:label});
  assert.equal(f.navigations.length,1);
});
