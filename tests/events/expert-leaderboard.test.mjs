import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-fixture.mjs';
import {START,END,fresh,leaderboard} from '../../public/events/expert-event-model.js';
import {leaderboardMarkup,maskedRankPhone,rankingState} from '../../public/events/expert-event-ui.js';
import {buildDemoScene} from '../../public/events/expert-event-demo.js';

const T=START+3600000;
function rankingFixture(users=[],uid='me') {
  const state={...fresh(uid),demoRanking:true,users:[]};
  for(const [index,user] of users.entries()) {
    state.users.push({uid:user.uid,username:user.name||user.uid,...('phone' in user?{phone:user.phone}:{})});
    for(const kind of ['true','false']) {
      for(let i=0;i<(user[kind]||0);i++)state.orders.push({
        id:`${user.uid}-${kind}-${i}`,uid:user.uid,category:'美妆',eligible:true,
        at:T,result:kind,resultAt:user.reachedAt??T+1000+index*100+i
      });
    }
  }
  return state;
}
const view=(state,kind='true')=>createDocument(`<main>${leaderboardMarkup(state,kind)}</main>`);
const seat=(document,rank)=>document.querySelector(`.ev-podium-person[data-rank="${rank}"]`);
const ranks=document=>document.querySelectorAll('.ev-podium-person').map(node=>Number(node.dataset.rank));
const baseUsers=[
  {uid:'winner',name:'林清清',true:8,false:1},
  {uid:'second',name:'许**7',true:5,false:7},
  {uid:'third',name:'周小鱼',true:3,false:5},
  {uid:'fourth',name:'陈**8',true:2,false:2}
];

test('phone masking accepts mainland numbers and supported country-code formatting but exposes only the prefix and suffix',()=>{
  for(const value of [
    '13812345678',13812345678,'138 1234 5678','138-1234-5678',
    '+8613812345678','+86 138 1234 5678','+86-138-1234-5678',
    '008613812345678','0086 138 1234 5678','0086-138-1234-5678',
    '  +86 138-1234-5678  ','138****5678','+86 138****5678'
  ])assert.equal(maskedRankPhone(value),'138****5678',`unsupported phone representation: ${String(value)}`);
  assert.equal(maskedRankPhone('19987654321'),'199****4321');
  assert.equal(maskedRankPhone(maskedRankPhone('13812345678')),'138****5678','masking is idempotent');
});

test('missing or invalid phone values produce a safe placeholder without echoing raw input',()=>{
  for(const value of [
    undefined,null,'','   ',0,123,1381234567,138123456789,NaN,Infinity,true,false,{},[],[13812345678],
    '12812345678','23812345678','1381234567','138123456789','138****56789','138****abcd',
    '+1 13812345678','电话13812345678','13812345678转1','<img src=x onerror=alert(1)>13812345678',
    {toString(){return '13812345678';}}
  ])assert.equal(maskedRankPhone(value),'手机号未提供');
});

test('ordinary rows in both boards nest masked names and phone numbers while keeping the existing rank and count',()=>{
  const users=[
    {uid:'first',name:'林小清',phone:'13811110001',true:8,false:9},
    {uid:'second',name:'许小鱼',phone:'13811110002',true:7,false:8},
    {uid:'third',name:'周小星',phone:'13811110003',true:6,false:7},
    {uid:'me',name:'自己的完整名字',phone:13812345678,true:3,false:1},
    {uid:'fifth',name:'陈小王',phone:'+86 139-8765-4321',true:1,false:3}
  ];
  const state=rankingFixture(users),before=structuredClone(state);
  for(const kind of ['true','false']){
    const document=view(state,kind),expected=leaderboard(state,kind).slice(3,100);
    const rows=document.querySelectorAll('.ev-rank-row');
    assert.equal(rows.length,2);
    for(const [index,row]of rows.entries()){
      const user=users.find(user=>user.uid===expected[index].uid),identity=row.querySelector('.ev-rank-user');
      assert(identity,'ordinary row groups the display name and phone in one identity column');
      assert.equal(identity.querySelector('.ev-rank-username').parentElement,identity);
      assert.equal(identity.querySelector('.ev-rank-phone').parentElement,identity);
      assert.equal(identity.querySelector('.ev-rank-phone').textContent,user.uid==='me'?'138****5678':'139****4321');
      assert.equal(row.dataset.rank,String(expected[index].rank));
      assert.equal(row.querySelector('.ev-rank-number').textContent,String(expected[index].rank).padStart(2,'0'));
      assert.match(row.querySelector('strong').textContent,new RegExp(`^${expected[index].count}\\s*单$`));
      assert.equal(row.classList.contains('is-me'),user.uid==='me');
      if(user.uid==='me')assert.equal(identity.querySelector('.ev-rank-username').textContent,'我');
    }
    assert.equal(document.querySelectorAll('.ev-rank-phone').length,rows.length);
    assert.equal(document.querySelector('.ev-podium .ev-rank-phone'),null);
    assert.equal(document.querySelector('.ev-my-rank .ev-rank-phone'),null);
    assert.doesNotMatch(document.querySelector('.ev-podium').textContent,/1[3-9]\d\*{4}\d{4}/);
    assert.doesNotMatch(document.querySelector('.ev-my-rank').textContent,/1[3-9]\d\*{4}\d{4}/);
    for(const user of users)assert.equal(document.querySelector('main').textContent.includes(String(user.phone)),false);
  }
  assert.deepEqual(state,before);
});

test('ordinary rows with old or malformed phone data show placeholders instead of invented numbers or raw input',()=>{
  const state=rankingFixture([
    ...baseUsers.slice(0,3),
    {uid:'missing',name:'无手机号',true:2,false:1},
    {uid:'malformed',name:'异常手机号',phone:'<script>13812345678</script>',true:1,false:2}
  ]);
  for(const kind of ['true','false']){
    const document=view(state,kind),rows=document.querySelectorAll('.ev-rank-row');
    assert.equal(rows.length,2);
    assert(rows.every(row=>row.querySelector('.ev-rank-phone').textContent==='手机号未提供'));
    assert.doesNotMatch(document.querySelector('main').textContent,/13812345678|138\*{4}5678/);
    assert.equal(document.querySelectorAll('script').length,0);
  }
});

test('default and explicit ranking demos supply already masked phone data to ordinary rows',()=>{
  const states=[rankingState(fresh()),...['rank-unranked','rank-normal','rank-top3','rank-dual'].map(id=>buildDemoScene(id).state)];
  for(const state of states)for(const kind of ['true','false']){
    const document=view(state,kind),rows=document.querySelectorAll('.ev-rank-row');
    assert(rows.length>0,'the demo includes ordinary rows below the podium');
    for(const row of rows)assert.match(row.querySelector('.ev-rank-phone').textContent,/^1[3-9]\d\*{4}\d{4}$/);
    assert.equal(document.querySelector('.ev-podium .ev-rank-phone'),null);
    assert.equal(document.querySelector('.ev-my-rank .ev-rank-phone'),null);
  }
});

test('default ranking fixtures preserve supplied identity records and never invent a phone for old users',()=>{
  const state=rankingFixture([
    {uid:'me',name:'本人的保存资料',true:5,false:5},
    {uid:'rank-4',name:'已有演示账号资料',phone:'+86 13912345678',true:1,false:1}
  ]);
  delete state.demoRanking;
  const before=structuredClone(state),ranked=rankingState(state);
  for(const user of state.users)assert.deepEqual(ranked.users.find(item=>item.uid===user.uid),user);
  assert.deepEqual(state,before);
  for(const kind of ['true','false']){
    const document=view(ranked,kind),mine=document.querySelector('.ev-rank-row.is-me');
    assert(mine,'the saved account remains an ordinary-row participant');
    assert.equal(mine.querySelector('.ev-rank-phone').textContent,'手机号未提供');
  }
});

test('compact leaderboard removes retired campaign slogans while retaining clear rules and expert actions',()=>{
  const document=view(rankingFixture(baseUsers)),text=document.querySelector('main').textContent;
  assert.doesNotMatch(text,/每一份判断，都值得被看见|让专业，成为你的荣誉/);
  assert(document.querySelector('[data-rules]'));
  assert(document.querySelector('[data-rank-expert]'));
  assert(document.querySelector('.ev-rank-reward'));
});

test('both ranking tabs expose selected state and show the correct top-three reward',()=>{
  const state=rankingFixture(baseUsers);
  for(const kind of ['true','false']) {
    const document=view(state,kind),tabs=document.querySelector('.ev-ranking-tabs');
    assert.equal(tabs.getAttribute('role'),'tablist');
    for(const value of ['true','false']) {
      const button=tabs.querySelector(`[data-kind="${value}"]`);
      assert.equal(button.getAttribute('role'),'tab');
      assert.equal(button.getAttribute('aria-selected'),String(value===kind));
      assert.match(button.textContent,value==='true'?/鉴真王者/:/避雷王者/);
    }
    const reward=document.querySelector('.ev-rank-reward').textContent;
    assert.match(reward,/前三|TOP\s*3|Top\s*3/);
    assert.match(reward,kind==='true'?/200/:/终身免费专鉴/);
    assert.doesNotMatch(reward,kind==='true'?/终身免费专鉴/:/200/);
  }
});

test('podium displays actual winners in visual order second, first, third with dynamic names and counts',()=>{
  const document=view(rankingFixture(baseUsers));
  assert.deepEqual(ranks(document),[2,1,3]);
  for(const [rank,name,count] of [[1,'林**清',8],[2,'许**7',5],[3,'周**鱼',3]]) {
    const person=seat(document,rank);
    assert.equal(person.classList.contains('is-vacant'),false);
    assert(person.textContent.includes(name));
    assert.match(person.textContent,new RegExp(`${count}\\s*单`));
  }
  const row=document.querySelector('.ev-rank-row[data-rank="4"]');
  assert(row.textContent.includes('陈**8'));
  assert.match(row.textContent,/2\s*单/);
});

test('empty leaderboard keeps three explicit vacant podium places without invented users or zero-count winners',()=>{
  const document=view(rankingFixture());
  assert.deepEqual(ranks(document),[2,1,3]);
  for(const person of document.querySelectorAll('.ev-podium-person')) {
    assert.equal(person.classList.contains('is-vacant'),true);
    assert.match(person.textContent,/虚位以待/);
    assert.doesNotMatch(person.textContent,/鉴\*\*友|0\s*单/);
  }
  assert.equal(document.querySelectorAll('.ev-rank-row').length,0);
  assert.match(document.querySelector('.ev-my-rank').textContent,/暂未上榜/);
});

test('one and two participant leaderboards reserve only unoccupied places',()=>{
  for(const count of [1,2]) {
    const document=view(rankingFixture(baseUsers.slice(0,count)));
    assert.equal(document.querySelectorAll('.ev-podium-person.is-vacant').length,3-count);
    for(let rank=1;rank<=3;rank++) {
      assert.equal(seat(document,rank).classList.contains('is-vacant'),rank>count);
      if(rank>count)assert.doesNotMatch(seat(document,rank).textContent,/0\s*单/);
    }
  }
});

test('all peer display names are masked and existing masked names remain stable',()=>{
  const users=[...baseUsers,{uid:'fifth',name:'王大亮',true:1}];
  const document=view(rankingFixture(users)),text=document.querySelector('main').textContent;
  for(const hidden of ['林清清','周小鱼','王大亮'])assert.equal(text.includes(hidden),false);
  for(const shown of ['林**清','许**7','周**鱼','陈**8','王**亮'])assert(text.includes(shown));
});

test('an incidental asterisk in a full username does not bypass leaderboard privacy masking',()=>{
  const document=view(rankingFixture([{uid:'peer',name:'王小明*店主',true:3}]));
  const text=seat(document,1).textContent;
  assert(text.includes('王**主'));
  assert.equal(text.includes('王小明*店主'),false);
  assert.equal(text.includes('小明'),false);
});

test('current user is labelled me in either podium or ordinary row without exposing their saved name',()=>{
  for(const [uid,rank] of [['winner',1],['fourth',4]]) {
    const document=view(rankingFixture(baseUsers,uid));
    const entry=rank<=3?seat(document,rank):document.querySelector(`.ev-rank-row[data-rank="${rank}"]`);
    assert.match(entry.textContent,/我/);
    assert.match(document.querySelector('.ev-my-rank').textContent,new RegExp(`第\\s*${rank}\\s*名`));
    assert.equal(document.querySelector('main').textContent.includes(baseUsers.find(user=>user.uid===uid).name),false);
  }
});

test('saved names containing HTML remain inert text in podium and ordinary rows',()=>{
  const payload='<img src=x onerror=alert(1)>**末';
  const state=rankingFixture([
    {uid:'bad-top',name:payload,true:8},
    {uid:'two',name:'许**7',true:6},
    {uid:'three',name:'周**8',true:5},
    {uid:'bad-row',name:payload,true:2}
  ]);
  const html=leaderboardMarkup(state),document=createDocument(`<main>${html}</main>`);
  assert.equal(document.querySelectorAll('[onerror]').length,0);
  assert.equal(document.querySelectorAll('script').length,0);
  assert.equal(document.querySelectorAll('img[src="x"]').length,0);
  assert(seat(document,1).textContent.includes('<**末'));
  assert(document.querySelector('.ev-rank-row[data-rank="4"]').textContent.includes('<**末'));
  assert.equal(document.querySelector('main').textContent.includes(payload),false);
});

test('main ranking stops at one hundred while personal rank remains visible beyond that limit',()=>{
  const users=Array.from({length:103},(_,i)=>({
    uid:i===102?'me':`user-${i}`,name:`鉴友${i}`,true:1,reachedAt:T+1000+i
  }));
  const document=view(rankingFixture(users)),rows=document.querySelectorAll('.ev-rank-row');
  assert.equal(rows.length,97);
  assert.equal(rows[0].dataset.rank,'4');
  assert.equal(rows.at(-1).dataset.rank,'100');
  assert.equal(document.querySelector('.ev-rank-row[data-rank="101"]'),null);
  assert.match(document.querySelector('.ev-my-rank').textContent,/第\s*103\s*名/);
  assert.match(document.querySelector('.ev-my-rank').textContent,/1\s*单/);
});

test('one user may rank in both boards with different result totals',()=>{
  const state=rankingFixture([
    {uid:'me',name:'自己的名字',true:7,false:5},
    {uid:'peer',name:'林**8',true:2,false:8}
  ]);
  const trueBoard=view(state,'true'),falseBoard=view(state,'false');
  assert.match(trueBoard.querySelector('.ev-my-rank').textContent,/第\s*1\s*名/);
  assert.match(trueBoard.querySelector('.ev-my-rank').textContent,/7\s*单/);
  assert.match(falseBoard.querySelector('.ev-my-rank').textContent,/第\s*2\s*名/);
  assert.match(falseBoard.querySelector('.ev-my-rank').textContent,/5\s*单/);
  assert.match(seat(trueBoard,1).textContent,/我/);
  assert.match(seat(falseBoard,2).textContent,/我/);
});

test('equal-count podium order follows the time users reached their total',()=>{
  const state=rankingFixture([
    {uid:'late',name:'晚**1',true:2,reachedAt:T+3000},
    {uid:'early',name:'早**2',true:2,reachedAt:T+2000}
  ]);
  const document=view(state);
  assert.match(seat(document,1).textContent,/早\*\*2/);
  assert.match(seat(document,2).textContent,/晚\*\*1/);
});

test('pending, noneligible and out-of-period results cannot become visual winners',()=>{
  const state=rankingFixture([{uid:'valid',name:'林**7',true:1}]);
  for(const [index,change] of [
    {result:null,resultAt:null},
    {result:'unknown'},
    {category:'卡牌'},
    {eligible:false},
    {at:START-1},
    {resultAt:END}
  ].entries())state.orders.push({
    id:`excluded-${index}`,uid:`excluded-${index}`,category:'美妆',eligible:true,
    at:T,result:'true',resultAt:T+2000,...change
  });
  const document=view(state);
  assert.match(seat(document,1).textContent,/林\*\*7/);
  assert.equal(document.querySelectorAll('.ev-podium-person.is-vacant').length,2);
  assert.equal(document.querySelectorAll('.ev-rank-row').length,0);
});

test('leaderboard markup does not mutate session orders, identities or rewards while switching tabs',()=>{
  const state=rankingFixture(baseUsers),before=structuredClone(state);
  leaderboardMarkup(state,'true');
  leaderboardMarkup(state,'false');
  assert.deepEqual(state,before);
});

test('podium remains readable without artwork and exposes each winner as structured text',()=>{
  const document=view(rankingFixture(baseUsers)),podium=document.querySelector('.ev-podium');
  assert.equal(podium.querySelectorAll('img').length,0,'the podium no longer depends on the bright decorative campaign image');
  assert.equal(podium.getAttribute('aria-label'),'前三名领奖台');
  for(const rank of [1,2,3]) {
    const person=seat(document,rank);
    assert.match(person.getAttribute('aria-label'),new RegExp(`第 ${rank} 名`));
    assert(person.querySelector('.ev-podium-info').textContent.includes('单'));
    assert.equal(person.querySelector('.ev-podium-rank').getAttribute('aria-hidden'),'true','duplicate visual rank is not announced twice');
  }
});
