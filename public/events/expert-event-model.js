import './expert-event-categories.js';

// The expert event is independent of the earlier card campaign.
export const START = Date.parse('2026-10-27T00:00:00+08:00');
export const END = Date.parse('2026-11-11T00:00:00+08:00');
// Exclusive expiry: the voucher remains usable throughout December 12.
export const VOUCHER_END = Date.parse('2026-12-13T00:00:00+08:00');
export const DAY = 86400000;
export const PRIZES = [
  {id:'ysl-cushion',pool:'advanced',name:'YSL气垫',quantity:1},
  {id:'coach-belt',pool:'advanced',name:'COACH腰带',quantity:1},
  {id:'razer-headphones',pool:'advanced',name:'雷蛇耳机',quantity:1},
  {id:'coach-wallet',pool:'advanced',name:'COACH钱包',quantity:1},
  {id:'makeup-sample',pool:'ordinary',name:'美妆小样',quantity:null},
  {id:'skincare-sample',pool:'ordinary',name:'护肤品小样',quantity:null},
  {id:'perfume-sample',pool:'ordinary',name:'香水小样',quantity:null}
];

export const active = now => Number.isFinite(now) && now >= START && now < END;
export const dayKey = now => new Date(now + 8 * 3600000).toISOString().slice(0,10);
export const isEligibleCategory = globalThis.JianxExpertEventCategories.isEligibleCategory;
export const ACTIVITY_CATEGORIES = globalThis.JianxExpertEventCategories.categories;
const clone = state => structuredClone(state);
const eventOrder = order => order.eligible!==false&&isEligibleCategory(order.category)&&active(order.at);
const ownOrders = state => state.orders.filter(order => order.uid===state.uid&&eventOrder(order));
const pools = ['ordinary','advanced'];
const validTicket = (ticket,now) => ticket.remaining > 0 && ticket.at <= now && now < ticket.expiresAt;
const ticketSort = (a,b) => a.expiresAt - b.expiresAt || a.at - b.at || a.id.localeCompare(b.id);

export function fresh(uid='demo-me') {
  return {
    version:1,uid,orders:[],tickets:[],draws:[],vouchers:[],addresses:{},
    dailyClaims:[],stocks:Object.fromEntries(PRIZES.map(prize => [prize.id,prize.quantity])),
    physicalWon:false,guideTicketId:null
  };
}

export function balances(state,now) {
  const result={ordinary:0,advanced:0,daily:0};
  if(!active(now))return result;
  for(const ticket of state.tickets) {
    if(!validTicket(ticket,now)||!pools.includes(ticket.pool))continue;
    result[ticket.pool]+=ticket.remaining;
    if(ticket.sourceKey==='daily')result.daily+=ticket.remaining;
  }
  return result;
}

export function claimDaily(state,now) {
  const next=clone(state);
  if(!active(now))return {state:next,awarded:false,ticket:null};
  const day=dayKey(now);
  if(next.dailyClaims.includes(day))return {state:next,awarded:false,ticket:null};
  const firstGuide=next.guideTicketId===null;
  const expiresAt=Math.min(Date.parse(`${day}T00:00:00+08:00`)+DAY,END);
  const ticket={
    id:`daily-${day}`,pool:'ordinary',source:'每日免费赠券',sourceKey:'daily',
    amount:1,remaining:1,at:now,expiresAt,firstGuide
  };
  next.tickets.push(ticket);
  next.dailyClaims.push(day);
  if(firstGuide)next.guideTicketId=ticket.id;
  return {state:next,awarded:true,ticket};
}

export function submitOrder(state,{id,category,product}={},now) {
  const next=clone(state);
  if(typeof id!=='string'||!id.trim())return {state:next,order:null,reward:null,error:'订单编号不能为空'};
  const existing=next.orders.find(order => order.id===id);
  if(existing)return {state:next,order:existing,reward:null,duplicate:true};
  if(!Number.isFinite(now))return {state:next,order:null,reward:null,error:'订单时间无效'};
  const eligible=isEligibleCategory(category)&&active(now);
  const ordinal=eligible?ownOrders(next).length+1:null;
  const order={id,uid:next.uid,category:category||'专家鉴别',product:product||'鉴定商品',at:now,ordinal,eligible,result:null,resultAt:null};
  next.orders.push(order);
  let reward=null;
  if(eligible&&ordinal%2===0) {
    const pool=ordinal%10===0?'advanced':'ordinary';
    const ticket={
      id:`milestone-${id}`,pool,source:`累计鉴定 ${ordinal} 单`,sourceKey:'milestone',
      amount:1,remaining:1,at:now,expiresAt:END,firstGuide:false
    };
    next.tickets.push(ticket);
    reward={pool,amount:1};
  }
  return {state:next,order,reward,excluded:!eligible};
}

export function completeOrder(state,id,result,now) {
  const next=clone(state);
  const order=next.orders.find(item => item.id===id);
  if(!order)return {state:next,order:null,error:'未找到鉴定订单'};
  if(!['true','false','unknown'].includes(result))return {state:next,order,error:'请选择有效的鉴别结果'};
  if(!Number.isFinite(now)||now<order.at)return {state:next,order,error:'结果时间不能早于提交时间'};
  if(order.result!==null) {
    return order.result===result
      ? {state:next,order,duplicate:true,counted:eventOrder(order)&&active(order.resultAt)&&order.result!=='unknown'}
      : {state:next,order,error:'该订单已经生成最终结果'};
  }
  order.result=result;
  order.resultAt=now;
  return {state:next,order,counted:eventOrder(order)&&active(now)&&result!=='unknown'};
}

function randomUnit(random) {
  const value=random();
  if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('随机数必须在 0（含）到 1（不含）之间');
  return value;
}

export function draw(state,{pool,count,requestId}={},now,random=Math.random) {
  const next=clone(state);
  const fail=error => ({state:clone(state),batch:null,error});
  if(typeof requestId!=='string'||!requestId.trim())return fail('抽奖请求编号不能为空');
  const previous=next.draws.find(batch => batch.requestId===requestId);
  if(previous) {
    if(previous.pool!==pool||previous.count!==count)return fail('该抽奖请求已用于其他抽取方式');
    return {state:next,batch:previous,duplicate:true};
  }
  if(!active(now))return fail('活动尚未开始或已结束');
  if(!pools.includes(pool)||![1,5].includes(count))return fail('请选择同一类抽奖券，单抽或五连抽');
  if(balances(next,now)[pool]<count)return fail('该类可用抽奖券不足');

  // Keep debit and all results in one copied state, then return it for one save.
  const available=next.tickets.filter(ticket => ticket.pool===pool&&validTicket(ticket,now)).sort(ticketSort);
  const consumed=[],ticketDebits=[];
  let remaining=count;
  for(const ticket of available) {
    const amount=Math.min(remaining,ticket.remaining);
    if(!amount)continue;
    for(let i=0;i<amount;i++)consumed.push({ticketId:ticket.id,firstGuide:ticket.firstGuide});
    ticket.remaining-=amount;
    ticketDebits.push({ticketId:ticket.id,amount});
    remaining-=amount;
    if(!remaining)break;
  }
  const batch={id:`expert-draw-${requestId}`,requestId,pool,count,at:now,rewards:[],ticketDebits};
  try {
    for(const [index,ticket] of consumed.entries()) {
      const base={id:`${batch.id}-${index}`,at:now,ticketId:ticket.ticketId};
      // This rule belongs only to the original free guide ticket, never the account's next draw.
      if(ticket.firstGuide) {
        batch.rewards.push({...base,type:'none'});
        continue;
      }
      const roll=randomUnit(random);
      const physicalRate=pool==='advanced'?.05:.08;
      const stock=PRIZES.filter(prize => prize.pool===pool&&(next.stocks[prize.id]===null||next.stocks[prize.id]>0));
      if(roll<physicalRate&&!next.physicalWon&&stock.length) {
        const prize=stock[Math.floor(randomUnit(random)*stock.length)];
        next.physicalWon=true;
        if(next.stocks[prize.id]!==null)next.stocks[prize.id]--;
        batch.rewards.push({...base,type:'physical',prizeId:prize.id});
      } else if(roll<.8) {
        // Ineligible or sold-out physical probability transfers entirely to vouchers.
        const voucher={...base,type:'voucher',expiresAt:VOUCHER_END,used:false};
        next.vouchers.push(voucher);
        batch.rewards.push(voucher);
      } else {
        batch.rewards.push({...base,type:'none'});
      }
    }
  } catch(error) {
    return fail(error instanceof Error?error.message:'抽奖暂未完成，请重试');
  }
  next.draws.unshift(batch);
  return {state:next,batch};
}

export function ticketInventory(state,now) {
  const lots=state.tickets.map(ticket => ({
    ...ticket,total:ticket.amount,used:ticket.amount-ticket.remaining,
    status:ticket.remaining===0?'used':now>=ticket.expiresAt?'expired':'unused'
  })).sort((a,b) => b.at-a.at||b.id.localeCompare(a.id));
  const unused=lots.filter(ticket => ticket.remaining>0&&ticket.at<=now&&now<ticket.expiresAt);
  const used=lots.filter(ticket => ticket.used>0);
  const expired=lots.filter(ticket => ticket.remaining>0&&now>=ticket.expiresAt);
  return {
    lots,unused,used,expired,
    counts:{
      unused:unused.reduce((sum,ticket) => sum+ticket.remaining,0),
      used:used.reduce((sum,ticket) => sum+ticket.used,0),
      expired:expired.reduce((sum,ticket) => sum+ticket.remaining,0)
    }
  };
}

export function leaderboard(state,kind) {
  if(!['true','false'].includes(kind))return [];
  const users=new Map((state.users||[]).map(user => [user.uid,user.username||user.name]));
  const entries=new Map();
  for(const order of state.orders) {
    if(order.result!==kind||!eventOrder(order)||!active(order.resultAt))continue;
    const entry=entries.get(order.uid)||{
      uid:order.uid,username:users.get(order.uid)||(order.uid===state.uid?'我':'鉴友'),
      count:0,reachedAt:0
    };
    entry.count++;
    entry.reachedAt=Math.max(entry.reachedAt,order.resultAt);
    entries.set(order.uid,entry);
  }
  return [...entries.values()]
    .sort((a,b) => b.count-a.count||a.reachedAt-b.reachedAt||a.uid.localeCompare(b.uid))
    .map((entry,index) => ({...entry,rank:index+1}));
}
