import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createDocument,FixtureElement} from './dom-fixture.mjs';
import * as model from '../../public/events/expert-event-model.js';
import {progressMarkup,rewardArt,firstGuideMarkup,eventCount,icon,escapeHtml} from '../../public/events/expert-event-ui.js';
import {DEMO_SCENE_GROUPS,buildDemoScene} from '../../public/events/expert-event-demo.js';

const source=readFileSync(new URL('../../public/events/expert-event-home.js',import.meta.url),'utf8');
const T=model.START+10*3600000;
test('the frameless activity leaves the restored upper hero and its responsive styling unchanged',()=>{
  const html=readFileSync(new URL('../../public/events/home.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../../public/events/expert-refinement.css',import.meta.url),'utf8');
  const homeCss=readFileSync(new URL('../../public/events/expert-event-home.css',import.meta.url),'utf8');
  // Preserve the existing upper area from e214863, independently of Git being available.
  // Ignore markup whitespace, while preserving every element, attribute and text value.
  const serialize=node=>typeof node==='string'?node.replace(/\s+/g,' ').trim():({
    tag:node.tagName,
    attributes:[...node.attributes].sort(([a],[b])=>a.localeCompare(b)),
    children:node.nodes.map(serialize).filter(value=>value!=='')
  });
  const sha=value=>createHash('sha256').update(value).digest('hex');
  assert.equal(sha(JSON.stringify(serialize(createDocument(html).querySelector('.expert-welcome')))),
    '2521dbdb6073604da3d8a463238624f4c1b74cddbaf77493a620eec606c71b5d',
    'the service copy, orb, tags, original CTA and metrics must remain unchanged');
  assert.equal(sha(css),'8b11cfedcde7e9ce1a82c2091a9b819d62ba089edc4e2f591a363e0d0eb06247',
    'keep the original hero spacing, type scale, CTA and narrow-screen layout');
  assert.doesNotMatch(homeCss,/\.expert-(?:welcome|hero|spectrum)\b/,
    'activity styles must not override the preserved upper hero');
  assert.match(homeCss,/\.is-expert\{background:radial-gradient\(ellipse at 100% 50%,#452ca740,transparent 65%\),linear-gradient\(160deg,#131839,#1d1640\)!important\}/,
    'preserve the background behind the upper area');
});
test('expert home restores the complete original service hero and one working category entry',()=>{
  const html=readFileSync(new URL('../../public/events/home.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../../public/events/expert-refinement.css',import.meta.url),'utf8');
  const homeCss=readFileSync(new URL('../../public/events/expert-event-home.css',import.meta.url),'utf8');
  const document=createDocument(html);
  const hero=document.querySelector('.expert-welcome');
  assert.ok(hero,'full service introduction is present above the activity');
  assert.match(hero.textContent,/线上人工鉴别/);
  assert.match(hero.textContent,/资深专家线上鉴别/);
  assert.match(hero.textContent,/出具权威鉴别结论/);
  assert.match(hero.textContent,/错一赔三，专家一对一鉴别/);
  assert.match(hero.textContent,/最快 30 分钟出具结论/);
  assert.equal(hero.querySelectorAll('.expert-welcome-tags span').length,3);
  assert.equal(hero.querySelector('.expert-welcome-stats').children.length,3);
  assert.match(hero.textContent,/真伪图库/);
  assert.match(hero.textContent,/分钟出结果/);
  assert.match(hero.textContent,/份专家报告/);
  assert.match(hero.querySelector('.expert-spectrum').textContent,/EXPERT/);
  assert.match(css,/#expertHome \.expert-welcome-title\{/);
  assert.doesNotMatch(html,/eh-service/);
  assert.doesNotMatch(homeCss,/\.eh-service/,'compact header styles no longer override the restored hero');
  assert.equal(document.querySelectorAll('#expertCta').length,1,'existing category picker keeps one entry');
  assert.equal(hero.querySelector('#expertCta').textContent.replace(/\s+/g,''),'＋立即鉴别');
});
// The real controller uses remove() when switching between upload and report.
if(!FixtureElement.prototype.remove)FixtureElement.prototype.remove=function(){
  if(this.parentElement)this.parentElement.nodes=this.parentElement.nodes.filter(node=>node!==this);
  this.parentElement=null;
};

function fixture({initial=model.fresh(),now=T,expertVisible=true,reducedMotion=true}={}) {
  let state=structuredClone(initial),clock=now;
  const events=new Map(),microtasks=[],timers=new Map(),intervals=[],dialogs=[],progress=[];
  const draws=[],hubs=[],rules=[],rankings=[],navigations=[],scenes=[];
  const document=createDocument('<div id="app"><div id="expertHome"></div><div id="expertPickerRoot" hidden></div></div>');
  document.hidden=false;document.getElementById('expertHome').hidden=!expertVisible;
  const window={
    parent:{},jianxActive:true,
    addEventListener(type,fn){const list=events.get(type)||[];list.push(fn);events.set(type,list);},
    dispatchEvent(event){for(const listener of events.get(event.type)||[])listener(event);}
  };
  const emit=(type,detail)=>window.dispatchEvent({type,detail});
  window.jianxNavigate=(route,options)=>navigations.push({route,...options});
  window.jianxSetTab=tab=>{
    document.getElementById('expertHome').hidden=tab!=='expert';
    document.getElementById('expertPickerRoot').hidden=true;
    if(tab==='expert')emit('expert-tab-open');
  };
  window.expertPicker={open(){document.getElementById('expertPickerRoot').hidden=false;}};
  // home-card-entry registers first and selects the tab before the extension sees the intent.
  window.addEventListener('jianx-shell',event=>{
    if(event.detail.type==='activate')window.jianxSetTab(event.detail.route==='expert'?'expert':'ai');
  });
  let timerId=0;
  const context=vm.createContext({
    ...model,window,document,location:{search:'?tab=expert'},URLSearchParams,Intl,
    DEMO_SCENE_GROUPS,
    applyDemoScene:(id,options={})=>{
      const scene=buildDemoScene(id,options);
      scenes.push({id,options:{...options}});
      if(scene.persist){state=structuredClone(scene.state);clock=scene.now;emit('expert-event-change');}
      return scene;
    },
    FormData:class {
      constructor(form){
        this.values=new Map(form.querySelectorAll('select').map(select=>[
          select.getAttribute('name'),
          select.value||select.querySelector('option[selected]')?.value||select.querySelector('option')?.value
        ]));
      }
      get(name){return this.values.get(name)??null;}
    },
    crypto:{randomUUID},matchMedia:()=>({matches:reducedMotion}),
    queueMicrotask:fn=>microtasks.push(fn),requestAnimationFrame:fn=>microtasks.push(fn),
    setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},
    clearTimeout:id=>timers.delete(id),setInterval:fn=>{intervals.push(fn);return intervals.length;},
    loadEvent:()=>structuredClone(state),
    saveEvent:next=>{state=structuredClone(next);emit('expert-event-change');return structuredClone(state);},
    eventNow:()=>clock,setEventClock:value=>{clock=value;emit('expert-event-change');},
    resetEvent:()=>{state=model.fresh();clock=T;emit('expert-event-change');return structuredClone(state);},
    machineMarkup:()=>'<div class="gm-machine"></div>',mountMachine:()=>({destroy(){}}),
    prizeArt:()=>'<span class="prize-art"></span>',
    progressMarkup,rewardArt,firstGuideMarkup,eventCount,icon,esc:escapeHtml,focusProgress(){},
    openProgress:options=>progress.push(structuredClone(options)),openLeaderboard:kind=>rankings.push(kind),
    openRules:options=>rules.push(options),openDraw:options=>draws.push(options),
    openActivityHub:options=>hubs.push(options),
    closeEventDialog:()=>{for(const dialog of dialogs)dialog.open=false;},
    showEventDialog:(title,body,options={})=>{
      for(const previous of dialogs)previous.open=false;
      const dialog=document.createElement('dialog');dialog.innerHTML=body;dialog.open=true;dialog.title=title;
      dialog.className=options.className||'';
      dialog.close=(reason='dismiss')=>{if(!dialog.open)return;dialog.open=false;dialog.returnValue=reason;options.onClose?.({reason});};dialogs.push(dialog);return dialog;
    }
  });
  vm.runInContext(source.replace(/^import .*;\n/gm,''),context,{filename:'expert-event-home.js'});
  const flush=()=>{let guard=0;while(microtasks.length){assert(++guard<100,'microtasks should settle');microtasks.shift()();}};
  return {
    document,window,dialogs,progress,draws,hubs,rules,rankings,navigations,scenes,emit,flush,
    get state(){return structuredClone(state);},
    setState(value){state=structuredClone(value);emit('expert-event-change');},
    setClock(value){clock=value;},
    enter(){emit('expert-tab-open');flush();},
    visible(){document.hidden=false;for(const listener of document.events.get('visibilitychange')||[])listener({type:'visibilitychange'});flush();},
    tick(){for(const fn of intervals)fn();flush();},
    finishAI(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}flush();}
  };
}

test('expired activity keeps free upload available without promising milestone rewards',()=>{
  const f=fixture({now:model.END});
  f.window.onExpertSelected({category:'美妆',name:'气垫粉底'});
  f.flush();
  assert.equal(f.document.querySelector('.eh-order-benefit'),null);
  assert.match(f.document.querySelector('.eh-price-summary').textContent,/全部品类免费/);
  f.document.querySelector('[data-submit]').click();
  assert.equal(f.state.orders.length,1);
  assert.equal(f.state.orders[0].eligible,false);
  assert.equal(f.progress.length,0);
});

test('AI conversion outside the activity period keeps the two service actions without lottery progress',()=>{
  for(const now of [model.START-1,model.END]){
    const f=fixture({now,expertVisible:false});
    f.window.jianxShowBeautyDemo();f.finishAI();
    const card=f.document.querySelector('.eh-convert-card');
    assert.equal(card.querySelector('.ev-progress'),null);
    assert.equal(card.querySelector('h2').textContent,'专家一对一鉴别');
    assert.equal(card.querySelector('.eh-free-badge').textContent,'限时免费');
    assert.equal(card.querySelector('.eh-convert-description').textContent,'错一赔三•专家组研判•最快30分钟出结果');
    assert.deepEqual(card.querySelectorAll('button').map(button=>button.textContent),['查看详情','去专鉴']);
    assert.doesNotMatch(card.textContent,/更进一步|攒好运|专家复核|专鉴还可|活动规则|活动已结束|活动尚未开始/);
    const before=f.state;
    card.querySelector('[data-ai-details]').click();
    assert.equal(f.document.querySelector('.eh-convert-card'),card,'details stays on the current demo surface');
    assert.deepEqual(f.state,before);
    card.querySelector('[data-ai-expert]').click();f.flush();
    assert.match(f.document.querySelector('.eh-selected-product').textContent,/圣罗兰/);
    assert(f.document.querySelector('[data-submit]'));
  }
});

test('eligible upload opens progress after submission while card upload never opens activity progress',()=>{
  for(const [category,expected] of [['美妆',1],['卡牌',0],['配饰',0]]){
    const f=fixture();f.window.onExpertSelected({category,name:'演示商品'});f.flush();
    assert.equal(Boolean(f.document.querySelector('.eh-order-benefit')),expected===1);
    f.document.querySelector('[data-submit]').click();
    assert.equal(f.progress.length,expected);
    assert.equal(eventCount(f.state),expected);
  }
});

for(const category of ['美妆','包袋','鞋靴','服饰','手表','数码家电','3C无损'])test(`${category} submissions one through eleven each open progress with rewards only at the correct milestones`,()=>{
  const f=fixture();
  for(let count=1;count<=11;count++) {
    f.window.onExpertSelected({category,name:`第 ${count} 件演示商品`});f.flush();
    assert(f.document.querySelector('.eh-order-benefit'));
    f.document.querySelector('[data-submit]').click();f.flush();
    const reward=count%2===0?{pool:count%10===0?'advanced':'ordinary',amount:1}:null;
    assert.equal(f.progress.length,count,'every eligible submission opens exactly one progress popup');
    assert.deepEqual(f.progress.at(-1),{reward});
    assert.equal(eventCount(f.state),count);
    assert.equal(f.state.orders.length,count);
    assert.equal(f.state.orders.at(-1).eligible,true);
    assert.equal(f.state.orders.at(-1).ordinal,count);
    assert.equal(f.state.tickets.length,Math.floor(count/2));
    assert.deepEqual(model.balances(f.state,T),{
      ordinary:Math.floor(count/2)-Math.floor(count/10),advanced:Math.floor(count/10),daily:0
    },'the tenth order replaces the ordinary ticket with one advanced ticket');
    assert.equal(f.document.querySelector('.eh-flow-nav strong').textContent,'鉴别报告');
    const before=f.state;
    f.setState(f.state);f.flush();
    assert.equal(f.progress.length,count,'shared state refreshes do not reopen the submission popup');
    assert.deepEqual(f.state,before,'report rendering does not award an extra ticket');
  }
});

test('pending and all three completed report states omit inline activity progress and the continue-appraisal action',()=>{
  for(const [result,label]of [[null,'专家正在鉴别中'],['true','专家结论：鉴真'],['false','专家结论：鉴假'],['unknown','专家结论：暂无法判断']]){
    const f=fixture();
    f.window.onExpertSelected({category:'美妆',name:'报告回归商品'});f.flush();
    f.document.querySelector('[data-submit]').click();f.flush();
    assert.equal(f.progress.length,1,'the automatic submission popup remains available');
    assert.deepEqual(f.progress[0],{reward:null});
    if(result)f.document.querySelector(`[data-result="${result}"]`).click();
    const before=structuredClone(f.state);
    // The report also refreshes on shared event-state notifications.
    f.setState(f.state);f.flush();
    const report=f.document.querySelector('.eh-flow');
    assert.equal(report.querySelector('.eh-flow-nav strong').textContent,'鉴别报告');
    assert.equal(report.querySelector('.eh-report-hero h1').textContent,'报告回归商品');
    assert.equal(report.querySelector('.eh-report-result h2').textContent,label);
    assert.match(report.querySelector('.eh-report-status').textContent,result?/已完成/:/专家已派单/);
    assert.equal(f.state.orders.at(-1).result,result);
    for(const selector of ['.eh-report-progress','.ev-progress','[data-report-progress]','[data-next-order]']){
      assert.equal(report.querySelector(selector),null,`${selector} must be removed in ${result||'pending'} reports`);
    }
    assert.doesNotMatch(report.textContent,/查看专鉴活动进度|继续免费专鉴|我的专鉴进度/);
    assert.equal(report.querySelectorAll('[data-result]').length,3,'the result simulator remains usable');
    assert(report.querySelectorAll('[data-result]').every(button=>button.disabled===Boolean(result)));
    assert.equal(f.progress.length,1,'report refreshes never reopen the award popup');
    assert.deepEqual(f.state,before,'rendering the completed report must not change order or reward data');
  }
});

test('report simplification preserves ordinary and advanced submission rewards without awarding again on result refresh',()=>{
  for(const [previousCount,pool]of [[1,'ordinary'],[9,'advanced']]){
    let initial=model.fresh();
    for(let i=1;i<=previousCount;i++)initial=model.submitOrder(initial,{id:`earlier-${i}`,category:'美妆'},T-100+i).state;
    const before=model.balances(initial,T),f=fixture({initial});
    f.window.onExpertSelected({category:'美妆',name:'里程碑商品'});f.flush();
    f.document.querySelector('[data-submit]').click();f.flush();
    assert.equal(eventCount(f.state),previousCount+1);
    assert.equal(f.state.tickets.length,initial.tickets.length+1);
    assert.equal(f.state.tickets.at(-1).pool,pool);
    assert.equal(f.state.tickets.at(-1).remaining,1);
    const expected={...before,[pool]:before[pool]+1};
    assert.deepEqual(model.balances(f.state,T),expected);
    assert.deepEqual(f.progress,[{reward:{pool,amount:1}}]);
    f.document.querySelector('[data-result="true"]').click();
    f.setState(f.state);f.flush();
    assert.equal(eventCount(f.state),previousCount+1);
    assert.deepEqual(model.balances(f.state,T),expected);
    assert.equal(f.state.tickets.length,initial.tickets.length+1);
    assert.deepEqual(f.progress,[{reward:{pool,amount:1}}]);
    assert.match(f.document.querySelector('.eh-report-result h2').textContent,/专家结论：鉴真/);
  }
});

test('excluded report categories do not advance an existing nine-order milestone or open its reward popup',()=>{
  let initial=model.fresh();
  for(let i=1;i<=9;i++)initial=model.submitOrder(initial,{id:`eligible-${i}`,category:'美妆'},T-100+i).state;
  for(const category of ['卡牌','配饰']){
    const f=fixture({initial});
    f.window.onExpertSelected({category,name:'非活动品类商品'});f.flush();
    f.document.querySelector('[data-submit]').click();f.flush();
    assert.equal(f.progress.length,0);
    assert.equal(eventCount(f.state),9);
    assert.equal(f.state.orders.at(-1).eligible,false);
    assert.deepEqual(f.state.tickets,initial.tickets);
    assert(f.document.querySelector('.eh-report-result'));
    assert.equal(f.document.querySelector('.eh-report-progress'),null);
    assert.equal(f.document.querySelector('[data-next-order]'),null);
    f.document.querySelector('[data-result="false"]').click();f.flush();
    assert.equal(f.progress.length,0);
    assert.equal(eventCount(f.state),9);
    assert.deepEqual(f.state.tickets,initial.tickets);
    assert.match(f.document.querySelector('.eh-report-result h2').textContent,/专家结论：鉴假/);
  }
});

test('a first ticket claimed in the center still gets its guide once on the expert homepage',()=>{
  const initial=model.claimDaily(model.fresh(),T).state;
  const f=fixture({initial});f.enter();
  assert.equal(f.dialogs.length,1);
  assert.equal(f.dialogs[0].title,'双11专鉴有礼');
  assert.equal(f.dialogs[0].className,'ev-onboarding-dialog');
  assert.equal(f.dialogs[0].querySelector('.ev-onboarding-lead').textContent,'免费专鉴，攒券扭好礼');
  const ticketArt=f.dialogs[0].querySelector('.eh-guide-ticket .ev-reward-art');
  assert(ticketArt,'the first free ticket uses the same lottery-ticket artwork as the pool and milestones');
  assert.equal(ticketArt.getAttribute('src'),'assets/gacha/reward-ordinary-v6.png');
  assert.equal(ticketArt.getAttribute('alt'),'普通淡紫抽奖券');
  assert.equal(f.dialogs[0].querySelector('.eh-guide-ticket .gm-prize-art'),null);
  assert.equal(f.state.guideShownTicketId,initial.guideTicketId);
  f.dialogs[0].close();f.enter();
  assert.equal(f.dialogs.length,1);
  const reloaded=fixture({initial:f.state});reloaded.enter();
  assert.equal(reloaded.dialogs.length,0,'shown guide survives module reload');
});

test('postponing the first guide keeps the free ticket and the activity entry available',()=>{
  const f=fixture();f.enter();
  const saved=f.state;
  f.dialogs[0].querySelector('[data-later]').click();
  assert.equal(f.dialogs[0].open,false);
  assert.deepEqual(f.state,saved);
  assert.equal(f.draws.length,0);
  assert.equal(model.balances(f.state,T).daily,1);
  f.enter();
  assert.equal(f.dialogs.length,1,'postponement does not repeatedly interrupt activity entry');
  f.document.querySelector('[data-eh="hub"]').click();
  assert.equal(f.hubs.length,1);
  assert.equal(f.state.tickets.find(ticket=>ticket.firstGuide).remaining,1);
});

test('first guide draw disables repeated activation and starts exactly one ordinary draw',()=>{
  const f=fixture();f.enter();
  const guide=f.dialogs[0],action=guide.querySelector('[data-guide]');
  action.click();action.click();
  assert.equal(action.disabled,true);
  assert.equal(action.getAttribute('aria-busy'),'true');
  assert.equal(guide.querySelector('[data-later]').disabled,true);
  assert.equal(guide.querySelector('.ev-onboarding').classList.contains('is-feeding'),true);
  assert.equal(guide.open,false);
  assert.equal(guide.returnValue,'draw');
  assert.equal(f.draws.length,1);
  assert.equal(f.draws[0].pool,'ordinary');
  assert.equal(f.draws[0].count,1);
});

test('the animated ticket feed waits before drawing and cancelling it never consumes the ticket',()=>{
  for(const cancel of [false,true]) {
    const f=fixture({reducedMotion:false});f.enter();
    const guide=f.dialogs[0],saved=f.state;
    guide.querySelector('[data-guide]').click();
    assert.equal(f.draws.length,0,'wait for the visual ticket feed before starting the draw');
    assert.equal(guide.open,true);
    if(cancel)guide.close('dismiss');
    f.finishAI();
    assert.equal(f.draws.length,cancel?0:1);
    assert.equal(guide.open,false);
    assert.deepEqual(f.state,saved,'onboarding animation itself must never debit a ticket');
  }
});

test('used or expired first guide tickets never cause another guide',()=>{
  const claimed=model.claimDaily(model.fresh(),T).state;
  const used=model.draw(claimed,{pool:'ordinary',count:1,requestId:'guide'},T,()=>0).state;
  const consumed=fixture({initial:used});consumed.enter();
  assert.equal(consumed.dialogs.length,0);
  const expired=fixture({initial:claimed,now:T+model.DAY});expired.enter();
  assert.equal(expired.dialogs.length,0);
  assert.equal(expired.state.tickets.length,2);
  assert.equal(model.balances(expired.state,T+model.DAY).daily,1);
});

test('returning to a visible expert page after midnight silently grants the new daily ticket',()=>{
  const f=fixture();f.enter();f.dialogs[0].close();
  f.document.hidden=true;f.setClock(T+model.DAY);f.visible();
  assert.equal(f.state.tickets.length,2);
  assert.equal(model.balances(f.state,T+model.DAY).daily,1);
  assert.equal(f.dialogs.length,1,'new days do not replay onboarding');
  assert.equal(f.dialogs.filter(dialog=>dialog.open).length,0,'returning never opens a next-day notice');
  f.enter();f.visible();
  assert.equal(f.state.tickets.length,2,'repeated entry keeps the daily grant idempotent');
  assert.equal(f.dialogs.length,1);
});

test('calendar refresh grants a new daily ticket when the expert page stays open across midnight',()=>{
  const f=fixture();f.enter();f.dialogs[0].close();
  f.setClock(T+model.DAY);f.tick();
  assert.equal(model.balances(f.state,T+model.DAY).daily,1);
  assert.equal(f.state.tickets.length,2);
  assert.equal(f.dialogs.length,1,'midnight refresh does not create a new notice');
  assert.equal(f.dialogs.filter(dialog=>dialog.open).length,0);
  f.tick();assert.equal(f.state.tickets.length,2);
  f.setClock(model.END);f.tick();
  assert.deepEqual(model.balances(f.state,model.END),{ordinary:0,advanced:0,daily:0});
});

test('simulated next-day entry refreshes ticket records without opening a notice or first-time guide',()=>{
  const f=fixture();
  f.document.querySelector('[data-eh="demo"]').click();
  const panel=f.dialogs.at(-1);
  panel.querySelector('[data-scene="next-day"]').click();f.flush();
  assert.equal(f.dialogs.length,1,'only the simulation selector was created');
  assert.equal(panel.open,false);
  assert.equal(f.dialogs.filter(dialog=>dialog.open).length,0);
  const inventory=model.ticketInventory(f.state,T+model.DAY);
  assert.deepEqual(inventory.counts,{unused:1,used:0,expired:1});
  assert.equal(model.balances(f.state,T+model.DAY).daily,1);
  assert.equal(f.state.tickets[1].firstGuide,false);
  assert.equal(f.draws.length,0);
  assert.equal(f.hubs.length,0);
  f.enter();f.tick();
  assert.equal(f.dialogs.length,1);
  assert.equal(f.state.tickets.length,2);
});

test('card-expert shell intent suppresses onboarding even though the earlier listener opens expert tab',()=>{
  const f=fixture({expertVisible:false});
  f.emit('jianx-shell',{type:'activate',route:'expert',intent:'card-expert'});f.flush();
  assert.equal(f.dialogs.length,0);
  assert.equal(f.state.tickets.length,0);
  assert.match(f.document.querySelector('.eh-selected-product').textContent,/卡牌/);
  f.document.querySelector('[data-submit]').click();f.flush();
  assert.equal(f.progress.length,0);
  assert.equal(f.dialogs.length,0);
  assert.equal(f.state.orders[0].eligible,false);
});

test('explicit expert selection does not put a native guide in front of the category picker',()=>{
  const f=fixture({expertVisible:false});
  f.window.openExpertSelection();f.flush();
  assert.equal(f.document.getElementById('expertPickerRoot').hidden,false);
  assert.equal(f.dialogs.length,0);
});

test('upload/report overlay stays above the existing navbar so its back control remains reachable',()=>{
  const css=file=>readFileSync(new URL(`../../public/events/${file}`,import.meta.url),'utf8');
  const declarations=(content,selector)=>{
    const blocks=[...content.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([,selectors])=>selectors.split(',').map(s=>s.trim()).includes(selector));
    return blocks.flatMap(([, ,body])=>[...body.matchAll(/z-index\s*:\s*(\d+)/g)].map(match=>Number(match[1]))).at(-1);
  };
  const flow=declarations(css('expert-event-home.css'),'.eh-flow');
  const navbar=declarations(css('original.css'),'.navbar');
  assert(Number.isFinite(flow)&&Number.isFinite(navbar));
  assert(flow>navbar,`flow z-index ${flow} must exceed navbar ${navbar}`);
});

test('demo milestones grant immediately usable tickets instead of future-dated balances',()=>{
  for(const [count,ordinary,advanced] of [[9,4,0],[14,6,1],[50,20,5]]){
    const f=fixture();
    f.document.querySelector('[data-eh="demo"]').click();
    f.dialogs.at(-1).querySelector(`[data-scene="progress-${count}"]`).click();f.flush();
    assert.equal(eventCount(f.state),count);
    assert.equal(model.balances(f.state,T).ordinary,ordinary);
    assert.equal(model.balances(f.state,T).advanced,advanced);
    assert.ok(f.state.orders.every(order=>order.at<=T));
    assert.ok(f.state.orders.filter(order=>order.result).every(order=>order.resultAt<=T));
  }
});

test('frameless activity keeps all destinations reachable without inline draw controls or duplicate information',()=>{
  const f=fixture({initial:buildDemoScene('progress-14').state});
  const home=f.document.getElementById('expertEvent');
  const before=f.state;
  assert(home.querySelector('.eh-machine-display'));
  assert(home.querySelector('.eh-campaign-copy'));
  assert(home.querySelector('.eh-machine-stage'));
  assert.equal(home.querySelector('.ev-progress'),null);
  assert.equal(home.querySelector('[data-draw]'),null);
  assert.equal(home.querySelector('[data-pool]'),null);
  for(const selector of ['.eh-campaign-top','.eh-campaign-heading','.eh-event-chip','.eh-rank-spark',
    '.eh-prize-caption','.eh-enter-arrow','.eh-daily-note','.eh-pocket']){
    assert.equal(home.querySelector(selector),null,`${selector} must be removed, not hidden`);
  }
  assert.doesNotMatch(home.textContent,/美妆[、/\s]+包袋|鞋靴[、/\s]+服饰|手表[、/\s]+数码/);
  assert.doesNotMatch(home.textContent,/好礼扭出来|YSL|COACH|雷蛇|累计专鉴|我的抽奖券|开启好运/);
  assert.equal(home.querySelector('h2').textContent,'专鉴有礼·替你的双11 战利品兜底');
  assert.equal(home.querySelector('.eh-campaign-copy p'),null,'the hero adds no repeated marketing paragraph');
  assert.equal(home.querySelector('.eh-enter-button span').textContent,'去扭蛋');
  assert.equal(home.querySelector('.eh-rank-pill').parentElement,home.querySelector('.eh-machine-stage'),
    'the ranking entrance belongs to the machine stage rather than a second promotional card');
  assert.match(readFileSync(new URL('../../public/events/expert-event-ui.js',import.meta.url),'utf8'),/今日赠券当天有效/,
    'the shared hub retains the expiry reminder removed from the compact entry');
  assert.deepEqual(home.querySelectorAll('[data-eh]').map(button=>button.dataset.eh).sort(),
    ['demo','hub','hub','ranking','rules']);
  const hubButtons=home.querySelectorAll('[data-eh="hub"]');
  assert.equal(hubButtons.length,2,'the machine and main button open the same shared hub');
  for(const button of hubButtons)button.click();
  assert.equal(f.hubs.length,2);
  assert.equal(f.draws.length,0,'home never starts a draw without the hub');
  home.querySelector('[data-eh="ranking"]').click();
  home.querySelector('[data-eh="rules"]').click();
  home.querySelector('[data-eh="demo"]').click();
  assert.equal(f.rankings.length,1);
  assert.equal(f.rules.length,1);
  assert.equal(f.dialogs.at(-1).title,'模拟场景');
  assert.deepEqual(f.state,before,'opening hero destinations does not consume tickets or change order progress');
});

test('machine hero has no surrounding card and keeps the CTA and ranking entrance layered on its stage',()=>{
  const css=readFileSync(new URL('../../public/events/expert-event-home.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/\.eh-(?:campaign-top|campaign-heading|event-chip|rank-spark|prize-caption|enter-arrow|daily-note|pocket)\b/,
    'removed content must not retain obsolete presentation rules');
  const campaign=css.match(/\.eh-campaign\{([^}]+)\}/)?.[1]||'';
  assert.match(campaign,/border:0/);
  assert.match(campaign,/background:none/);
  assert.doesNotMatch(campaign,/border-radius|grid-template-columns/,'do not retain the compact side-by-side card');
  const machine=css.match(/\.eh-machine-display\{([^}]+)\}/)?.[1]||'';
  assert.match(machine,/width:100%/,'the device uses the entire stage');
  for(const selector of ['eh-enter-button','eh-rank-pill']){
    assert.match(css.match(new RegExp(`\\.${selector}\\{([^}]+)\\}`))?.[1]||'',/position:absolute/,
      'main action and ranking entrance float over the machine');
  }
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)[^\n]+\.eh-enter-button:before\{animation:none\}/);
});

test('machine entry uses the requested CTA and preserves inactive states without altering ticket balances',()=>{
  const claimed=model.claimDaily(model.fresh(),T).state;
  const consumed=model.draw(claimed,{pool:'ordinary',count:1,requestId:'compact-guide'},T,()=>0).state;
  for(const [initial,now,buttonText,detail] of [
    [claimed,T,'去扭蛋',null],
    [consumed,T,'去扭蛋',null],
    [claimed,model.START-1,'查看活动','10 月 27 日开启'],
    [claimed,model.END,'查看活动','本期活动已结束']
  ]){
    const f=fixture({initial,now});
    assert.equal(f.document.querySelector('.eh-enter-button span').textContent,buttonText);
    assert.equal(f.document.querySelector('.eh-event-status')?.textContent||null,detail);
    f.document.querySelector('.eh-enter-button').click();
    assert.equal(f.hubs.length,1);
    assert.deepEqual(f.state,initial);
  }
});

test('active beauty AI conversion keeps the full compact milestone history and exactly the requested service copy',()=>{
  const f=fixture({initial:buildDemoScene('progress-14').state,expertVisible:false});
  f.window.jianxShowBeautyDemo();f.finishAI();
  const card=f.document.querySelector('.eh-convert-card'),track=card.querySelector('.ev-progress');
  assert(track);
  assert.equal(track.classList.contains('is-compact'),true);
  assert.equal(track.dataset.current,'14');
  for(const step of [2,10,14])assert(track.querySelector(`[data-step="${step}"]`));
  assert.equal(card.querySelector('h2').textContent,'专家一对一鉴别');
  assert.equal(card.querySelector('.eh-free-badge').textContent,'限时免费');
  assert.equal(card.querySelector('.eh-convert-description').textContent,'错一赔三•专家组研判•最快30分钟出结果');
  assert.deepEqual(card.querySelectorAll('button').map(button=>button.textContent),['查看详情','去专鉴']);
  assert.equal(card.querySelector('.eh-benefits'),null);
  assert.equal(card.querySelector('.ev-eyebrow'),null);
  assert.equal(card.querySelector('[data-ai-rules]'),null);
  assert.equal(card.querySelector('.eh-convert-glow'),null);
  assert.equal(card.querySelector('.eh-convert-scope'),null);
  assert.doesNotMatch(card.textContent,/美妆[、/\s]+包袋|鞋靴[、/\s]+服饰|手表[、/\s]+数码/);
  assert.doesNotMatch(card.textContent,/更进一步|攒好运|专家复核|专鉴还可|活动规则/);
  card.querySelector('[data-ai-details]').click();
  assert.equal(f.rules.length,0);
  assert.equal(f.navigations.length,0);
  assert.equal(f.document.querySelector('.eh-convert-card'),card);
  card.querySelector('[data-ai-expert]').click();f.flush();
  assert.match(f.document.querySelector('.eh-selected-product').textContent,/圣罗兰/);
  assert(f.document.querySelector('[data-submit]'),'AI conversion goes directly to the upload flow');
  f.document.querySelector('[data-submit]').click();f.flush();
  assert.equal(eventCount(f.state),15);
  assert.equal(f.progress.length,1,'the compact CTA keeps the existing eligible appraisal flow');
});

test('simulation panel exposes all six groups with replay and initial-state recovery',()=>{
  const f=fixture();
  f.document.querySelector('[data-eh="demo"]').click();
  const panel=f.dialogs.at(-1),groups=panel.querySelectorAll('.eh-scene-group');
  assert.equal(groups.length,6);
  assert.deepEqual(groups.map(group=>group.querySelector('h3').textContent),[
    '新手体验','累计进度','抽奖效果','特殊状态','排行榜','卡牌活动'
  ]);
  assert.equal(panel.querySelectorAll('[data-scene]').length,23);
  assert.equal(panel.querySelector('[data-replay]').disabled,true);
  assert(panel.querySelector('[data-reset]'));
});

test('progress scene triggers reward feedback and replay restores the same earned state',()=>{
  const f=fixture();
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="progress-10"]').click();f.flush();
  assert.equal(eventCount(f.state),10);
  assert.deepEqual(f.progress.at(-1),{reward:{pool:'advanced',amount:1}});
  const changed=model.submitOrder(f.state,{id:'after-scene',category:'美妆'},T).state;
  f.setState(changed);
  assert.equal(eventCount(f.state),11);
  f.document.querySelector('[data-eh="demo"]').click();
  assert.equal(f.dialogs.at(-1).querySelector('[data-replay]').disabled,false);
  f.dialogs.at(-1).querySelector('[data-replay]').click();f.flush();
  assert.equal(eventCount(f.state),10);
  assert.equal(f.progress.length,2);
  assert.deepEqual(f.scenes.map(scene=>scene.id),['progress-10','progress-10']);
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-reset]').click();f.flush();
  assert.equal(eventCount(f.state),0);
  assert.deepEqual(model.balances(f.state,T),{ordinary:1,advanced:0,daily:1});
  assert.equal(f.scenes.at(-1).id,'first');
  assert.equal(f.dialogs.at(-1).title,'双11专鉴有礼');
});

test('draw setup passes targeted five-draw parameters and an isolated random callback to shared draw UI',()=>{
  const f=fixture(),originalRandom=Math.random;
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="draw"]').click();
  const form=f.dialogs.at(-1).querySelector('form');
  form.querySelector('[name="pool"]').value='advanced';
  form.querySelector('[name="count"]').value='1';
  const outcome=form.querySelector('[name="outcome"]');
  outcome.value='mixed';outcome.dispatchEvent({type:'change'});
  assert.equal(form.querySelector('[name="count"]').value,'5');
  form.dispatchEvent({type:'submit'});f.flush();
  const call=f.draws.at(-1);
  assert.equal(call.pool,'advanced');
  assert.equal(call.count,5);
  assert.equal(typeof call.random,'function');
  assert.equal(Math.random,originalRandom);
  assert.equal(model.balances(f.state,T).advanced,5);
  const result=model.draw(f.state,{pool:call.pool,count:call.count,requestId:'controller-preview'},T,call.random);
  assert.deepEqual(result.batch.rewards.map(reward=>reward.type),['physical','voucher','none','voucher','voucher']);
  f.setState(result.state);
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-replay]').click();f.flush();
  const replay=f.draws.at(-1);
  assert.equal(f.draws.length,2);
  assert.equal(model.balances(f.state,T).advanced,5);
  assert.notEqual(replay.random,call.random,'replay creates a fresh draw sequence');
  assert.deepEqual(model.draw(f.state,{pool:replay.pool,count:replay.count,requestId:'controller-replay'},T,replay.random).batch.rewards.map(reward=>reward.type),
    ['physical','voucher','none','voucher','voucher']);
});

test('random draw setup retains natural randomness and defaults to an ordinary single draw',()=>{
  const f=fixture();
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="draw"]').click();
  f.dialogs.at(-1).querySelector('form').dispatchEvent({type:'submit'});f.flush();
  const call=f.draws.at(-1);
  assert.equal(call.pool,'ordinary');assert.equal(call.count,1);assert.equal(call.random,undefined);
});

test('scene destinations route card history and ended ticket filters to the center',()=>{
  for(const [id,event,ticketStatus] of [['card-history','card-past',undefined],['card-next','card-next',undefined],['ended','expert','expired']]){
    const f=fixture({initial:buildDemoScene('daily-used').state});
    f.document.querySelector('[data-eh="demo"]').click();
    f.dialogs.at(-1).querySelector(`[data-scene="${id}"]`).click();f.flush();
    assert.equal(f.navigations.at(-1).route,'lottery');
    assert.equal(f.navigations.at(-1).event,event);
    assert.equal(f.navigations.at(-1).ticketStatus,ticketStatus);
  }
});

test('excluded-category and leaderboard scene actions dispatch to their correct surfaces',()=>{
  const f=fixture();
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="rank-dual"]').click();f.flush();
  assert.equal(f.rankings.at(-1),'true');
  assert.equal(f.state.demoRanking,true);
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="excluded"]').click();f.flush();
  assert.match(f.document.querySelector('.eh-selected-product').textContent,/卡牌/);
  f.document.querySelector('[data-submit]').click();f.flush();
  assert.equal(f.progress.length,0);
  assert.equal(f.state.orders.at(-1).eligible,false);
});

test('full-screen appraisal flow isolates background controls and restores them on return',()=>{
  const f=fixture();f.window.onExpertSelected({category:'美妆',name:'气垫粉底'});
  assert.equal(f.document.getElementById('expertHome').inert,true);
  assert.equal(f.document.activeElement,f.document.querySelector('[data-flow-back]'));
  f.document.querySelector('[data-flow-back]').click();
  assert.equal(f.document.getElementById('expertHome').inert,false);
  assert.equal(f.document.querySelector('.eh-flow'),null);
});
