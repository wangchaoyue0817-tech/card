// Frontend-only rules for the second card campaign. No previous activity is read.
export const DAY = 86_400_000;
export const START = Date.parse('2026-10-30T00:00:00+08:00');
export const END = Date.parse('2026-11-06T00:00:00+08:00'); // Exclusive.
export const PHASE2 = Object.freeze({
  id:'onepiece-eb05-2026', name:'海贼王 · 海贼EB05上新 免费抽活动',
  startsAt:'2026-10-30T00:00:00+08:00', endsAt:'2026-11-05T23:59:59.999+08:00',
  ordinary:Object.freeze({physicalPercent:8,voucherPercent:92}),
  welcome:Object.freeze({physicalPercent:1,voucherPercent:99,amount:5,validHours:24}),
  dailyIdentificationCap:10, expertVoucherDays:7, shippingWorkingDays:7, drawEnabled:true,
  prizes:Object.freeze([
    Object.freeze({id:'chopper',name:'乔巴杂志',spec:'1 本带 P 卡',quantity:3,weight:20,threshold:70,category:'COLLECTION',mark:'P',note:'当日卡牌鉴定出结果达 70 单开放'}),
    Object.freeze({id:'selection',name:'海贼精选套装',spec:'1 套',quantity:1,weight:15,threshold:100,category:'SPECIAL SET',mark:'SET',note:'当日卡牌鉴定出结果达 100 单开放'}),
    Object.freeze({id:'eb05-pack',name:'海贼 EB05',spec:'1 包',quantity:40,weight:50,threshold:0,category:'BOOSTER PACK',mark:'EB05',note:'卡包 · 活动全程开放'}),
    Object.freeze({id:'eb05-box',name:'海贼 EB05',spec:'1 盒',quantity:2,weight:15,threshold:100,category:'BOOSTER BOX',mark:'BOX',note:'当日卡牌鉴定出结果达 100 单开放'}),
  ]),
  earning:Object.freeze([
    Object.freeze({id:'welcome',name:'新人礼包',amount:5,kind:'新人专属券',inDailyCap:false,detail:'活动期间新注册用户首次进入卡牌鉴定二级页面，自动获赠 5 张新人券。24 小时有效，最迟活动结束失效。'}),
    Object.freeze({id:'ai',name:'AI 卡牌鉴定',amount:1,kind:'普通抽奖券',inDailyCap:true,detail:'卡牌 AI 鉴定成功出结果即可获券，无论结果真假。'}),
    Object.freeze({id:'expert',name:'专家卡牌鉴定',amount:1,kind:'普通抽奖券',inDailyCap:true,detail:'完成卡牌专家鉴定支付或用券兑换成功，可获得 1 张普通抽奖券。'}),
    Object.freeze({id:'share',name:'满额分享',amount:5,kind:'普通抽奖券',inDailyCap:false,detail:'当日鉴定获券满 10 张，在当次弹窗点击转发小程序，再获 5 张；关闭后当天不可补领。'}),
    Object.freeze({id:'invite',name:'邀请新人注册',amount:5,kind:'普通抽奖券',inDailyCap:false,detail:'转发小程序，邀请一位新用户完成注册，可获 5 张普通抽奖券。'}),
  ]),
});
export const PRIZES = PHASE2.prizes;
const clone = state => structuredClone(state);
let sequence = 0;
const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${++sequence}`}`;
const result = (state,extra={}) => ({state,awarded:false,amount:0,sharePrompt:false,...extra});
const fail = (state,error) => result(state,{error});
export const active = now => Number.isFinite(now) && now >= START && now < END;
export const activityState = (now=Date.now()) => now < START ? 'upcoming' : now >= END ? 'ended' : 'active';
export const dayKey = now => new Date(now + 8 * 3_600_000).toISOString().slice(0,10);
export function fresh({registeredAt=START,uid=id('demo-user')}={}) {
  return {version:1,activityId:PHASE2.id,uid,registeredAt,welcome:null,tickets:[],ledger:[],days:{},results:[],payments:[],invitations:[],draws:[],vouchers:[],stocks:Object.fromEntries(PRIZES.map(prize=>[prize.id,prize.quantity])),physicalWon:false,addresses:{}};
}
function day(state,now) {
  return state.days[dayKey(now)] ||= {count:0,share:null};
}
function grant(state,pool,amount,source,now,expiresAt=END) {
  const lot={id:id('ticket'),pool,type:pool,source,at:now,expiresAt,total:amount,amount,remaining:amount,used:0};
  state.tickets.push(lot);
  state.ledger.unshift({id:id('grant'),lotId:lot.id,pool,type:pool,source,at:now,expiresAt,amount});
  return lot;
}
function awardIdentification(state,source,now) {
  const today=day(state,now);
  if(today.count>=PHASE2.dailyIdentificationCap)return result(state,{capped:true});
  today.count++;
  grant(state,'ordinary',1,source,now);
  const sharePrompt=today.count===PHASE2.dailyIdentificationCap;
  if(sharePrompt)today.share='pending';
  return result(state,{awarded:true,amount:1,sharePrompt});
}
export function claimWelcome(state,now,{entry='card',fromPhoto=false}={}) {
  if(!active(now)||entry!=='card'||fromPhoto||state.welcome||!Number.isFinite(state.registeredAt)||state.registeredAt<START||state.registeredAt>now||state.registeredAt>=END)return result(state);
  const next=clone(state),expiresAt=Math.min(now+DAY,END);
  const lot=grant(next,'welcome',5,'新人礼包',now,expiresAt);
  next.welcome={at:now,expiresAt,lotId:lot.id,used:false};
  return result(next,{awarded:true,amount:5});
}
export const dailyCount = (state,now) => state.days[dayKey(now)]?.count || 0;
export const dailyResultCount = (state,now) => state.results.filter(item=>item.category==='card'&&active(item.at)&&item.at<=now&&dayKey(item.at)===dayKey(now)).length;
export function recordResult(state,{id:eventId,kind='ai',category='card',success=true}={},now) {
  if(!eventId||!['ai','expert'].includes(kind))return fail(state,'鉴定结果信息不完整');
  if(!success||category!=='card'||!active(now))return result(state);
  if(state.results.some(item=>item.id===eventId&&item.kind===kind))return result(state,{duplicate:true});
  const next=clone(state);
  next.results.push({id:eventId,kind,category,at:now});
  return kind==='ai'?awardIdentification(next,'AI 卡牌鉴定',now):result(next);
}
export function recordExpertPayment(state,{id:paymentId,category='card',success=true,voucherId}={},now) {
  if(!paymentId)return fail(state,'专家鉴定订单信息不完整');
  if(!success||category!=='card')return result(state);
  if(state.payments.some(item=>item.id===paymentId))return result(state,{duplicate:true});
  const voucher=voucherId?state.vouchers.find(item=>item.id===voucherId):null;
  if(voucherId&&(!voucher||voucher.used||now>=voucher.expiresAt))return fail(state,'鉴定券已使用或已过期');
  const next=clone(state);
  if(voucherId){const used=next.vouchers.find(item=>item.id===voucherId);used.used=true;used.usedAt=now;used.paymentId=paymentId;}
  next.payments.push({id:paymentId,category,at:now,...(voucherId?{voucherId}:{})});
  return active(now)?awardIdentification(next,voucherId?'专家鉴定券兑换':'专家卡牌鉴定',now):result(next);
}
export function useVoucher(state,voucherId,now,{paymentId=id('voucher-order'),category='card'}={}) {
  return recordExpertPayment(state,{id:paymentId,category,voucherId},now);
}
export function share(state,now,action='claim') {
  if(!active(now)||!['claim','dismiss'].includes(action))return result(state);
  if(state.days[dayKey(now)]?.share!=='pending')return result(state);
  const next=clone(state);
  day(next,now).share=action==='claim'?'claimed':'dismissed';
  if(action==='dismiss')return result(next);
  grant(next,'ordinary',5,'满额分享',now);
  return result(next,{awarded:true,amount:5});
}
export function dismissPendingShares(state) {
  const next=clone(state);
  for(const value of Object.values(next.days))if(value.share==='pending')value.share='dismissed';
  return next;
}
export const dismissPendingShare = (state,now) => share(state,now,'dismiss').state;
export function invite(state,{id:inviteeId,registeredAt,lastInviter}={},now) {
  if(!active(now)||!inviteeId||inviteeId===state.uid||!Number.isFinite(registeredAt)||registeredAt<START||registeredAt>now||lastInviter!==state.uid)return result(state);
  if(state.invitations.some(item=>item.id===inviteeId))return result(state,{duplicate:true});
  const next=clone(state);
  next.invitations.push({id:inviteeId,registeredAt,lastInviter,at:now});
  grant(next,'ordinary',5,'邀请新人注册',now);
  return result(next,{awarded:true,amount:5});
}
export function available(state,now) {
  const totals={ordinary:0,welcome:0};
  if(!active(now))return totals;
  for(const lot of state.tickets)if(lot.at<=now&&now<lot.expiresAt)totals[lot.pool]+=lot.remaining;
  return totals;
}
export function ticketRows(state,status='unused',now=Date.now()) {
  if(!['unused','used','expired'].includes(status))status='unused';
  return state.tickets.filter(lot=>lot.at<=now).flatMap(lot=>{
    const amount=status==='used'?lot.used:status==='expired'?(now>=lot.expiresAt?lot.remaining:0):(now<lot.expiresAt?lot.remaining:0);
    return amount>0?[{...lot,amount,status}]:[];
  }).reverse();
}
export const ticketCounts = (state,now) => Object.fromEntries(['unused','used','expired'].map(status=>[status,ticketRows(state,status,now).reduce((total,row)=>total+row.amount,0)]));
export function prizeStatus(state,prizeId,now) {
  const prize=PRIZES.find(item=>item.id===prizeId);
  if(!prize)return null;
  const resultCount=dailyResultCount(state,now),remaining=state.stocks[prizeId]??0;
  return {open:resultCount>=prize.threshold,soldOut:remaining<=0,remaining,threshold:prize.threshold,resultCount};
}
function randomValue(rng) {
  const value=Number(rng());
  if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('随机数须在 0 到 1 之间');
  return value;
}
function weightedPrize(roll) {
  let limit=0;
  return PRIZES.find(prize=>{limit+=prize.weight;return roll*100<limit;})||PRIZES.at(-1);
}
export function draw(state,pool,count,now,rng=Math.random,{requestId}={}) {
  if(requestId){const batch=state.draws.find(item=>item.requestId===requestId);if(batch)return result(state,{batch,duplicate:true});}
  if(!active(now))return fail(state,now<START?'活动尚未开始':'活动已结束');
  if(!['ordinary','welcome'].includes(pool)||!Number.isInteger(count)||(pool==='welcome'?count!==5:![1,5].includes(count)))return fail(state,'新人券仅限整组五连抽，普通券支持单抽或五连抽');
  if(available(state,now)[pool]<count)return fail(state,'可用抽奖券不足或已过期');
  const next=clone(state),batchId=id('draw'),consumed=[];
  let remaining=count;
  for(const lot of next.tickets.filter(item=>item.pool===pool&&item.remaining>0&&item.at<=now&&now<item.expiresAt).sort((a,b)=>a.expiresAt-b.expiresAt||a.at-b.at)) {
    const used=Math.min(remaining,lot.remaining);lot.remaining-=used;lot.used+=used;remaining-=used;
    consumed.push({lotId:lot.id,amount:used});if(!remaining)break;
  }
  if(pool==='welcome')next.welcome.used=true;
  const rewards=[];
  try {
    for(let index=0;index<count;index++) {
      const roll=randomValue(rng),chance=PHASE2[pool].physicalPercent/100;
      let prize=null;
      if(roll<chance&&!next.physicalWon) {
        const selected=weightedPrize(randomValue(rng)),status=prizeStatus(next,selected.id,now);
        if(status.open&&!status.soldOut)prize=selected;
      }
      if(prize) {
        next.stocks[prize.id]--;next.physicalWon=true;
        rewards.push({id:id('reward'),type:'physical',prizeId:prize.id,at:now});
      } else {
        const voucher={id:id('voucher'),type:'voucher',at:now,expiresAt:now+PHASE2.expertVoucherDays*DAY,used:false};
        next.vouchers.push(voucher);rewards.push({...voucher});
      }
    }
  } catch(error) {return fail(state,error.message);}
  const batch={id:batchId,pool,count,at:now,rewards,consumed,...(requestId?{requestId}:{})};
  next.draws.unshift(batch);
  next.ledger.unshift({id:id('use'),batchId,pool,type:pool,source:pool==='welcome'?'新人五连抽':count===5?'普通五连抽':'普通单抽',amount:-count,at:now});
  return result(next,{batch});
}
export function addressStatus(state,rewardId,now) {
  const reward=state.draws.flatMap(batch=>batch.rewards).find(item=>item.id===rewardId&&item.type==='physical');
  if(!reward)return 'missing';
  return state.addresses[rewardId]?(now>=END?'locked':'saved'):(now>=END?'forfeited':'pending');
}
export function validateAddress(address={}) {
  return {name:String(address.name||'').trim()?'':'请填写收货人',phone:/^1\d{10}$/.test(String(address.phone||'').trim())?'':'请填写正确的手机号',region:String(address.region||'').trim()?'':'请填写所在地区',detail:String(address.detail||'').trim()?'':'请填写详细地址'};
}
export function saveAddress(state,rewardId,address,now) {
  if(now>=END)return fail(state,'活动已结束，收货信息不可新增或修改');
  if(addressStatus(state,rewardId,now)==='missing')return fail(state,'未找到对应实物奖品');
  const normalized=Object.fromEntries(['name','phone','region','detail'].map(key=>[key,String(address?.[key]||'').trim()]));
  const errors=validateAddress(normalized);
  if(Object.values(errors).some(Boolean))return result(state,{error:'请完善收货信息',errors});
  const next=clone(state);next.addresses[rewardId]={...normalized,updatedAt:now};
  return result(next,{saved:true});
}
