export const START = Date.parse('2026-09-25T00:00:00+08:00');
export const END = Date.parse('2026-10-08T00:00:00+08:00');
export const DAY = 86400000;
export const PRIZES = [
  {id:'coin',name:'宝可梦30周年硬币',spec:'1 包',quantity:15,crop:[530,440,128,210]},
  {id:'booster',name:'宝可梦30周年扩展包',spec:'1 包',quantity:40,crop:[533,663,123,130]},
  {id:'partner',name:'最初的伙伴 Vol.1',fullName:'宝可梦30周年最初的伙伴 Vol.1',spec:'1 盒',quantity:30,crop:[554,801,80,120]}
];
export const active = now => now >= START && now < END;
export const dayKey = now => new Date(now+8*3600000).toISOString().slice(0,10);
export function fresh(uid='preview-new',registeredAt=START+3600000){
  return {version:1,uid,registeredAt,welcome:null,ordinary:0,days:{},events:[],invites:[],ledger:[],draws:[],vouchers:[],physicalWon:false,addresses:{}};
}
const copy = s => structuredClone(s);
const day = (s,now) => s.days[dayKey(now)] ||= {count:0,share:'locked'};
const entry = (s,source,amount,now,type='ordinary',event='') => s.ledger.unshift({id:`${now}-${s.ledger.length}`,source,amount,at:now,type,event});
export const dailyCount = (s,now) => s.days[dayKey(now)]?.count || 0;
export const available = (s,now) => ({ordinary:active(now)?s.ordinary:0,welcome:active(now)&&s.welcome&&!s.welcome.used&&now<s.welcome.expiresAt?5:0});
export function welcome(s,now){
  const n=copy(s);
  if(!active(now)||n.welcome||n.registeredAt<START||n.registeredAt>now) return {state:n,awarded:false};
  n.welcome={at:now,expiresAt:Math.min(now+DAY,END),used:false};
  entry(n,'新人礼包',5,now,'welcome');
  return {state:n,awarded:true};
}
export function identify(s,{id,kind,success=true},now){
  const n=copy(s);
  if(!id||!['ai','expert'].includes(kind)||!success||!active(now)||n.events.includes(`${kind}:${id}`))return {state:n,awarded:false};
  n.events.push(`${kind}:${id}`);
  const d=day(n,now);
  if(d.count>=10)return {state:n,awarded:false,capped:true};
  d.count++;n.ordinary++;
  entry(n,kind==='ai'?'AI 鉴定':'专家鉴定',1,now,'ordinary',id);
  if(d.count===10)d.share='pending';
  return {state:n,awarded:true,sharePrompt:d.count===10};
}
export function share(s,now,action='claim'){
  const n=copy(s),d=day(n,now);
  if(!active(now)||d.share!=='pending')return {state:n,awarded:false};
  if(action==='dismiss'){d.share='dismissed';return {state:n,awarded:false};}
  d.share='claimed';n.ordinary+=5;entry(n,'满额分享',5,now);
  return {state:n,awarded:true};
}
export function invite(s,{id,registeredAt,clicks=[]},now){
  const n=copy(s);
  if(!active(now)||!id||id===n.uid||registeredAt<START||registeredAt>now||n.invites.includes(id))return {state:n,awarded:false};
  const last=[...clicks].filter(c=>c.at<=registeredAt).sort((a,b)=>a.at-b.at).at(-1);
  if(!last||last.uid!==n.uid)return {state:n,awarded:false};
  n.invites.push(id);n.ordinary+=5;entry(n,'邀请新用户注册',5,now,'ordinary',id);
  return {state:n,awarded:true};
}
export function draw(s,pool,count,now,random=Math.random){
  const n=copy(s),v=available(n,now);
  if(!active(now))return {state:n,error:'活动未开始或已结束'};
  if(pool==='welcome'?(count!==5||v.welcome!==5):(pool!=='ordinary'||![1,5].includes(count)||v.ordinary<count))return {state:n,error:'可用抽奖券不足，或抽取方式不符合规则'};
  if(pool==='welcome')n.welcome.used=true;else n.ordinary-=count;
  entry(n,pool==='welcome'?'新人五连抽':count===5?'普通五连抽':'普通单抽',-count,now,pool);
  const rewards=[];
  for(let i=0;i<count;i++){
    const id=`draw-${now}-${n.draws.length}-${i}`;
    if(!n.physicalWon&&random()<(pool==='welcome'?0.01:0.05)){
      n.physicalWon=true;
      const prize=PRIZES[Math.min(PRIZES.length-1,Math.floor(random()*PRIZES.length))];
      rewards.push({id,type:'physical',prizeId:prize.id,at:now});
    }else{
      const r={id,type:'voucher',at:now,expiresAt:now+7*DAY,used:false};n.vouchers.push(r);rewards.push(r);
    }
  }
  const batch={id:`batch-${now}-${n.draws.length}`,pool,at:now,rewards};n.draws.unshift(batch);
  return {state:n,batch};
}
export function payExpert(s,id,now,useVoucher=false){
  if(s.events.includes(`expert:${id}`))return {state:copy(s),awarded:false,duplicate:true};
  let n=copy(s);
  if(useVoucher){const v=n.vouchers.find(v=>!v.used&&v.expiresAt>now);if(!v)return {state:n,error:'暂无可用专家鉴定券'};v.used=true;}
  return identify(n,{id,kind:'expert'},now);
}
export function validateAddress(a){
  return {name:a.name?.trim().length>=2?'':'请填写至少 2 个字的收货人姓名',phone:/^1\d{10}$/.test(a.phone||'')?'':'请填写 11 位手机号码',region:a.region?.trim().length>=3?'':'请填写省、市、区',detail:a.detail?.trim().length>=5?'':'请填写完整街道及门牌信息'};
}
