import {
  START,END,DAY,PRIZES,ACTIVITY_CATEGORIES,fresh,balances,claimDaily,submitOrder,completeOrder,draw
} from './expert-event-model.js';
import {DEFAULT_TIME,saveEvent,setEventClock} from './expert-event-session.js';

// These fixtures belong only to the explicitly selected demonstration scene.
// They never alter the production draw function or the earlier card session.
export const DEMO_SCENE_GROUPS = [
  {id:'onboarding',label:'新手体验',scenes:[
    {id:'first',label:'首次进入',description:'领取今日赠券，重新体验免费扭蛋引导'},
    {id:'daily-used',label:'今日免费券已用完',description:'查看去专鉴引导与暂无可用券状态'},
    {id:'next-day',label:'次日重新进入',description:'昨日赠券过期，今日赠券静默刷新'}
  ]},
  {id:'progress',label:'累计进度',scenes:[
    {id:'progress-1',label:'累计 1 单',description:'再提交 1 单即可获得普通券'},
    {id:'progress-2',label:'累计 2 单',description:'直接播放普通券到账动效'},
    {id:'progress-9',label:'累计 9 单',description:'距离高级券还有 1 单'},
    {id:'progress-10',label:'累计 10 单',description:'直接播放高级券到账动效'},
    {id:'progress-14',label:'累计 14 单',description:'定位第 14 单，可滑动回看之前节点'},
    {id:'progress-20',label:'累计 20 单',description:'再次解锁高级券，不同时赠普通券'},
    {id:'progress-50',label:'累计 50 单',description:'已拥有 5 张高级券，可体验高级五连'}
  ]},
  {id:'draw',label:'抽奖效果',scenes:[
    {id:'draw',label:'自选抽奖演示',description:'选择券种、单抽或五连，以及随机或指定结果',configurable:true}
  ]},
  {id:'limits',label:'特殊状态',scenes:[
    {id:'insufficient',label:'抽奖券不足',description:'普通券 4 张，五连还差 1 张'},
    {id:'physical-won',label:'已经中过实物',description:'本活动另一奖池也不再中实物，概率转为鉴定券'},
    {id:'sold-out',label:'实物库存为零',description:'实物概率转为鉴定券，仍可正常抽奖'},
    {id:'excluded',label:'非活动品类',description:'进入卡牌专鉴，免费但不累计本活动进度'},
    {id:'not-started',label:'活动尚未开始',description:'免费专鉴可用，扭蛋尚未开放'},
    {id:'ended',label:'活动已经结束',description:'抽奖券已失效，历史奖品与记录仍可查看'}
  ]},
  {id:'ranking',label:'排行榜',scenes:[
    {id:'rank-unranked',label:'尚未上榜',description:'已有提交，但专家尚未给出有效结果'},
    {id:'rank-normal',label:'榜内普通名次',description:'查看自己的名次与前 3 名之间的距离'},
    {id:'rank-top3',label:'进入前三',description:'我的头像进入鉴真榜领奖台'},
    {id:'rank-dual',label:'双榜同时前三',description:'切换鉴真、避雷榜，均可看到我的领奖台位置'}
  ]},
  {id:'card',label:'卡牌活动',scenes:[
    {id:'card-history',label:'第一期历史记录',description:'保留已有卡牌数据，查看过期券及历史奖品'},
    {id:'card-next',label:'下一期待开启',description:'下一期卡牌活动尚未开放'}
  ]}
];

export const DEMO_DRAW_OPTIONS = {
  pools:[{value:'ordinary',label:'普通抽奖券'},{value:'advanced',label:'高级抽奖券'}],
  counts:[{value:1,label:'单次扭蛋'},{value:5,label:'五次一起扭'}],
  outcomes:[
    {value:'random',label:'自然随机'},
    {value:'physical',label:'抽中实物'},
    {value:'voucher',label:'抽中鉴定券'},
    {value:'none',label:'再接再厉'},
    {value:'mixed',label:'五连混合结果'}
  ]
};

const sceneIds=new Set(DEMO_SCENE_GROUPS.flatMap(group=>group.scenes.map(scene=>scene.id)));
const product={category:'美妆',product:'圣罗兰 · 气垫粉底'};
const categoryOptions=ACTIVITY_CATEGORIES.map(category=>category.name);
const drawOutcomes=new Set(DEMO_DRAW_OPTIONS.outcomes.map(option=>option.value));

function usedIntroduction(now=DEFAULT_TIME) {
  const first=claimDaily(fresh(),now-60000).state;
  return draw(first,{pool:'ordinary',count:1,requestId:'demo-introduction'},now-59000,()=>.99).state;
}

function addOrders(state,count,now,{results=false,prefix='demo-order'}={}) {
  let next=state,reward=null;
  for(let i=0;i<count;i++) {
    const at=now-(count-i)*1000;
    const result=submitOrder(next,{
      id:`${prefix}-${i+1}`,category:categoryOptions[i%categoryOptions.length],product:product.product
    },at);
    next=result.state;reward=result.reward;
    if(results)next=completeOrder(next,result.order.id,i%3===0?'false':'true',at+500).state;
  }
  return {state:next,reward};
}

function readyToDraw(pool,count,now) {
  let state=usedIntroduction(now),amount=0;
  while(balances(state,now)[pool]<count) {
    amount++;
    state=submitOrder(state,{
      id:`demo-draw-order-${amount}`,...product
    },now-60000+amount*1000).state;
  }
  return state;
}

/**
 * The returned generator is scoped to one explicit demo draw.
 * Its sequence follows the real model's additional prize-selection random call.
 * Five-draw physical previews still obey the one-physical-prize-per-user limit.
 */
export function demoDrawRandom(state,{pool,count,outcome,prizeId}) {
  if(outcome==='random')return undefined;
  const stock=PRIZES.filter(prize=>prize.pool===pool
    &&(state.stocks[prize.id]===null||state.stocks[prize.id]>0));
  if(prizeId&&!PRIZES.some(prize=>prize.id===prizeId&&prize.pool===pool)) {
    throw new RangeError('请选择该奖池中的实物奖品');
  }
  const numbers=[];
  let physicalWon=state.physicalWon;
  for(let i=0;i<count;i++) {
    const kind=outcome==='mixed'?['physical','voucher','none','voucher','voucher'][i]
      :outcome==='physical'&&i>0?'voucher':outcome;
    if(kind==='none'){numbers.push(.9);continue;}
    if(kind==='voucher'){numbers.push(.4);continue;}
    numbers.push(.01);
    if(!physicalWon&&stock.length) {
      const chosen=prizeId?stock.findIndex(prize=>prize.id===prizeId):0;
      if(chosen<0)throw new RangeError('该演示奖品已无库存');
      numbers.push((chosen+.5)/stock.length);
      physicalWon=true;
    }
  }
  let cursor=0;
  return ()=>numbers[cursor++]??.4;
}

function drawSettings(options) {
  const pool=options.pool??'ordinary',count=Number(options.count??1),outcome=options.outcome??'random';
  if(!['ordinary','advanced'].includes(pool)||![1,5].includes(count)||!drawOutcomes.has(outcome)) {
    throw new RangeError('请选择有效的演示券种、次数与结果');
  }
  if(outcome==='mixed'&&count!==5)throw new RangeError('混合结果仅用于五连扭蛋');
  return {pool,count,outcome,prizeId:options.prizeId};
}

function rankingScene(id,now) {
  let state=usedIntroduction(now);
  // Explicit fixture marker prevents the normal leaderboard fixture being added again.
  state.demoRanking=true;
  state.users=Array.from({length:12},(_,i)=>({uid:`scene-rank-${i}`,username:`${['林','许','周','陈'][i%4]}**${i%10}`,phone:`138****${8000+i}`}));
  state.users.push({uid:state.uid,username:'我',phone:'139****2026'});
  for(let u=0;u<12;u++)for(const [kind,amount] of [['true',24-u],['false',16-u]]) {
    for(let i=0;i<amount;i++) {
      const at=START+3600000+u*60000+i*1000;
      state.orders.push({
        id:`scene-rank-${kind}-${u}-${i}`,uid:`scene-rank-${u}`,category:'美妆',
        product:product.product,eligible:true,ordinal:i+1,at,result:kind,resultAt:at+500
      });
    }
  }
  const counts=id==='rank-unranked'?[0,0]:id==='rank-normal'?[14,0]:id==='rank-top3'?[23,0]:[26,18];
  const ownCount=counts[0]+counts[1]||1;
  state=addOrders(state,ownCount,now,{prefix:'scene-my-rank'}).state;
  const mine=state.orders.filter(order=>order.uid===state.uid);
  for(let i=0;i<counts[0]+counts[1];i++) {
    const order=mine[i];
    state=completeOrder(state,order.id,i<counts[0]?'true':'false',order.at+500).state;
  }
  return state;
}

/**
 * Pure fixture construction. Every scene starts from a known state, so replaying
 * a scene is repeatable and never depends on a previous draw or the device clock.
 */
export function buildDemoScene(id,options={}) {
  if(!sceneIds.has(id))throw new RangeError('未找到这个演示场景');
  const now=DEFAULT_TIME;
  const result={id,state:fresh(),now,destination:'home',event:'expert',persist:true};
  if(id==='card-history'||id==='card-next') {
    return {...result,destination:'lottery',event:id==='card-history'?'card-past':'card-next',persist:false};
  }
  if(id==='first')return {...result,state:claimDaily(result.state,now).state,guide:true};
  if(id==='daily-used')return {...result,state:usedIntroduction(now)};
  if(id==='next-day') {
    let state=claimDaily(fresh(),now).state;
    state=claimDaily(state,now+DAY).state;
    return {...result,state,now:now+DAY,guide:false};
  }
  if(id.startsWith('progress-')) {
    const count=Number(id.slice('progress-'.length));
    const seeded=addOrders(usedIntroduction(now),count,now,{results:true});
    return {...result,...seeded,destination:'progress',progressCount:count};
  }
  if(id==='draw') {
    const settings=drawSettings(options);
    const state=readyToDraw(settings.pool,settings.count,now);
    return {...result,state,destination:'draw',...settings,random:demoDrawRandom(state,settings)};
  }
  if(id==='insufficient') {
    return {...result,state:addOrders(usedIntroduction(now),8,now).state,destination:'lottery',pool:'ordinary',count:5};
  }
  if(id==='physical-won') {
    let state=readyToDraw('ordinary',1,now);
    state=draw(state,{pool:'ordinary',count:1,requestId:'demo-prior-physical'},now-100,()=>.01).state;
    // A real ordinary-pool physical win excludes an advanced-pool win as well.
    state=addOrders(state,10,now,{prefix:'demo-after-win'}).state;
    const settings={pool:'advanced',count:1,outcome:'physical'};
    return {...result,state,destination:'draw',...settings,random:demoDrawRandom(state,settings)};
  }
  if(id==='sold-out') {
    const state=readyToDraw('advanced',1,now);
    for(const prize of PRIZES)state.stocks[prize.id]=0;
    const settings={pool:'advanced',count:1,outcome:'physical'};
    return {...result,state,destination:'draw',...settings,random:demoDrawRandom(state,settings)};
  }
  if(id==='excluded')return {
    ...result,state:usedIntroduction(now),destination:'upload',
    selection:{category:'卡牌',brand:'宝可梦',style:'收藏卡牌',name:'宝可梦 · 收藏卡牌',price:499}
  };
  if(id==='not-started')return {...result,now:START-3600000};
  if(id==='ended') {
    let state=addOrders(usedIntroduction(now),14,now,{results:true}).state;
    state=draw(state,{pool:'ordinary',count:1,requestId:'demo-history-voucher'},now,()=>.4).state;
    return {...result,state,now:END+1000,destination:'lottery',ticketStatus:'expired'};
  }
  if(id.startsWith('rank-'))return {
    ...result,state:rankingScene(id,now),destination:'ranking',rankingKind:'true'
  };
  return result;
}

/**
 * Only the new campaign's dedicated session is written. Card history routes are
 * read-only and leave both campaign sessions and the current demo clock intact.
 */
export function applyDemoScene(id,options={}) {
  const result=buildDemoScene(id,options);
  if(result.persist) {
    setEventClock(result.now,options.storage);
    saveEvent(result.state,options.storage);
  }
  return result;
}
