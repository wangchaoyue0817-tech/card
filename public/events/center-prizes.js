import {PRIZES, VOUCHER_END} from './expert-event-model.js';
import {PRIZES as CARD_PRIZES} from './lottery-model.js';
import {esc, glyph} from './ui-common.js';
import {voucherMarkup} from './reward-ui.js';
import {prizeArt} from './capsule-machine.js';

const time=value=>new Intl.DateTimeFormat('zh-CN',{
  timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hour12:false,
}).format(Number.isFinite(value)?value:0);
const poolName=pool=>pool==='advanced'?'高级抽奖券':pool==='welcome'?'新人专属抽奖券':'普通抽奖券';
const campaign=legacy=>legacy?'卡牌第一期':'双11扭蛋活动';
const source=legacy=>legacy?'card':'expert';
const button=(label,action,style='cl-secondary')=>`<button class="${style}" data-action="${esc(action)}">${label}</button>`;
const rewardCount=batch=>batch.rewards?.length||0;
const batchLabel=batch=>batch.pool==='welcome'?'新人五连抽':`${batch.pool==='advanced'?'高级':'普通'}${rewardCount(batch)===5?'五连抽':'单抽'}`;

function currentVoucher(reward,state) {
  return (state?.vouchers||[]).find(item=>item.id===reward.id)||reward;
}

function voucherOptions(reward,state,now,legacy) {
  const voucher=currentVoucher(reward,state);
  // Card vouchers keep their original precise timestamp; the new event's
  // exclusive midnight expiry is presented as December 12 at 23:59.
  const expiresAt=voucher.expiresAt??(legacy?null:VOUCHER_END);
  return {
    expiresAt,
    options:{
      title:'专家线上鉴别券',
      category:`${campaign(legacy)} · ${poolName(reward.pool)}`,
      action:`voucher:${source(legacy)}:${reward.id}`,
      used:Boolean(voucher.used),
      expired:!voucher.used&&expiresAt!==null&&now>=expiresAt,
      displayExpiresAt:!legacy&&expiresAt===VOUCHER_END?expiresAt-1:expiresAt,
      note:'有效期以原中奖记录为准',
    },
  };
}

function cardPrizeArt(prize) {
  if(!prize?.crop)return `<div class="cl-prize-art small">${glyph('handbag')}</div>`;
  const [x,y,width,height]=prize.crop,scale=72/height;
  return `<div class="cl-prize-art small"><span role="img" aria-label="${esc(prize.name)}" style="width:${width*scale}px;height:${height*scale}px;background-image:url('assets/prize-source.jpg');background-size:${1532*scale}px ${1256*scale}px;background-position:${-x*scale}px ${-y*scale}px"></span></div>`;
}

export function prizeMarkup(reward,state={},now=Date.now(),legacy=false) {
  if(reward.type==='voucher') {
    const {expiresAt,options}=voucherOptions(reward,state,now,legacy);
    return voucherMarkup(1,expiresAt,options);
  }
  if(reward.type!=='physical')return '';
  const prize=(legacy?CARD_PRIZES:PRIZES).find(item=>item.id===reward.prizeId);
  const address=state.addresses?.[reward.id];
  const phone=String(address?.phone||'').replace(/^(\d{3})\d{4}(\d{4})$/,'$1****$2');
  const visual=legacy?cardPrizeArt(prize):`<div class="cl-prize-art small">${prizeArt(reward.prizeId)}</div>`;
  return `<div class="center-physical-reward"><div class="cl-owned-product">${visual}<div><small>实物奖品 · ${campaign(legacy)}</small><h3>${esc(prize?.fullName||prize?.name||'实物奖品')}</h3><p>${prize?.spec?`${esc(prize.spec)} × 1`:'1 份'} · ${poolName(reward.pool)}</p></div></div>${address?`<div class="cl-saved-address"><strong>${esc(address.name)} · ${esc(phone)}</strong><p>${esc(address.region)} ${esc(address.detail)}</p></div>`:''}${legacy?`<p class="cl-footnote">${address?'已填写收货信息':'未填写收货信息'} · 保留原活动领取状态</p>`:button(address?'修改收货信息':'填写收货信息',`address:${reward.id}`,'cl-gold cl-full')}</div>`;
}

function batchRewardsMarkup(batch,{legacy=false,state={},now=Date.now()}={}) {
  const rewards=(batch.rewards||[]).map(reward=>({...reward,pool:batch.pool,at:reward.at??batch.at}));
  const physical=rewards.filter(reward=>reward.type==='physical').map(reward=>prizeMarkup(reward,state,now,legacy)).join('');
  const groups=new Map();
  for(const reward of rewards.filter(item=>item.type==='voucher')) {
    const details=voucherOptions(reward,state,now,legacy);
    const key=JSON.stringify([details.expiresAt,details.options.used,details.options.expired]);
    if(!groups.has(key))groups.set(key,{...details,count:0});
    groups.get(key).count++;
  }
  const vouchers=[...groups.values()].map(({count,expiresAt,options})=>voucherMarkup(count,expiresAt,options)).join('');
  const none=rewards.filter(reward=>reward.type==='none').length;
  return `${physical}${vouchers}${none?`<div class="center-prize-hint center-no-prize"><p>再接再厉${none>1?` × ${none}`:''}</p></div>`:''}`;
}

export function batchResultMarkup(batch,{legacy=false,state={},now=Date.now()}={}) {
  return `<article class="center-reward-batch"><header><span>${time(batch.at)}</span><b>${campaign(legacy)} · ${batchLabel(batch)}</b></header>${batchRewardsMarkup(batch,{legacy,state,now})}</article>`;
}

function uniqueBatches(state,legacy,now) {
  const batches=new Set(),rewards=new Set();
  return (state?.draws||[]).flatMap((batch,index)=>{
    const identity=batch.id??`missing-batch-${index}`;
    if(batches.has(identity))return [];
    batches.add(identity);
    const originalRewards=batch.rewards||[];
    const distinctRewards=originalRewards.filter((reward,rewardIndex)=>{
      const key=reward.id??`${identity}:missing-reward-${rewardIndex}`;
      if(rewards.has(key))return false;
      rewards.add(key);return true;
    });
    if(originalRewards.length&&!distinctRewards.length)return [];
    return [{batch:{...batch,rewards:distinctRewards},state,legacy,now,index}];
  });
}

export function unifiedPrizesMarkup(expertState,legacyState,now,{legacyNow=now,isDemo=false}={}) {
  const batches=[
    ...uniqueBatches(expertState,false,now),
    ...uniqueBatches(legacyState,true,legacyNow),
  ].sort((a,b)=>(b.batch.at||0)-(a.batch.at||0)||Number(a.legacy)-Number(b.legacy)||a.index-b.index);
  const rewards=batches.flatMap(item=>item.batch.rewards);
  const physical=rewards.filter(reward=>reward.type==='physical').length;
  const vouchers=rewards.filter(reward=>reward.type==='voucher').length;
  return `<section class="center-prize-overview" aria-label="中奖汇总"><div><strong>${physical+vouchers}</strong><span>累计获得奖品</span></div><div><strong>${physical}</strong><span>实物奖品</span></div><div><strong>${vouchers}</strong><span>专家鉴别券</span></div></section>
  <div class="center-prize-hint">${glyph('shield-check')}<p>鉴别券自动到账，有效期见券面；实物奖品请填写收货信息。${isDemo?'<br>卡牌第一期为历史演示记录。':''}</p></div>
  <section aria-label="所有活动中奖记录"><header class="center-section-heading"><h2>中奖记录</h2><span>${batches.length} 次抽奖</span></header>${batches.length?batches.map(({batch,state,legacy,now:clock})=>`<article class="center-reward-batch" data-event="${source(legacy)}"><header><span>${time(batch.at)}</span><b>${campaign(legacy)} · ${batchLabel(batch)}</b></header>${batchRewardsMarkup(batch,{state,legacy,now:clock})}<button class="center-result-link" data-action="${esc(`result:${source(legacy)}:${batch.id}`)}">查看本次抽奖结果 ${glyph('caret-right')}</button></article>`).join(''):`<div class="cl-empty">${glyph('handbag')}<h3>还没有中奖记录</h3><p>抽中的实物、鉴别券和每次抽奖结果<br>都会保存在这里。</p>${button('查看我的抽奖券','nav-lottery')}</div>`}</section>`;
}
