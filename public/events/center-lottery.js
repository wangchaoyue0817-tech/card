import {START,END,active,balances} from './expert-event-model.js';
import {ticketPanel} from './center-pages.js';
import {machineMarkup} from './capsule-machine.js';
import {progressMarkup,rewardArt,icon} from './expert-event-ui.js';
import {eventTicketPanelMarkup} from './event-ticket-list.js';

export function activityChoiceMarkup(state,now){
 const balance=balances(state,now);
 return `<section class="ac-choices" aria-label="选择抽奖活动"><h2>选择活动</h2>
 <button class="ac-choice ac-choice-expert" data-action="event:expert"><span class="ac-choice-copy"><small>10.27 — 11.10</small><strong>双11扭蛋活动</strong><span>每日免费扭蛋 · 专鉴再得券</span><b>${now<START?'即将开始':now>=END?'已结束 · 查看抽奖券':`可用 ${balance.ordinary+balance.advanced} 张券`} ${icon()}</b></span><span class="ac-choice-device" aria-hidden="true">${machineMarkup({pool:"advanced",compact:true})}</span></button>
 <button class="ac-choice ac-choice-card" data-action="event:card-past"><span class="ac-choice-copy"><small>第一期已结束 · 下期待开启</small><strong>卡牌抽奖活动</strong><span>抽奖券与历史奖品持续保留</span><b>查看活动 ${icon()}</b></span><span class="ac-choice-cards" aria-hidden="true"><img src="assets/lottery-card-back.png" alt=""><img src="assets/lottery-card-back.png" alt=""></span></button>
 </section>`;
}

export function expertLotteryMarkup(state,now,{pool='ordinary',drawing=false,ticketStatus='unused'}={}){
 const balance=balances(state,now),enabled=active(now),premium=pool==='advanced';
 const drawHint=count=>drawing?'正在开奖':!enabled?(now<START?'活动尚未开始':'活动已结束'):balance[pool]<count?`还差 ${count-balance[pool]} 张${premium?'高级':'普通'}券`:count===5?'使用 5 张同种券':`使用 1 张${premium?'高级':'普通'}券`;
 return `<section class="ac-gacha-page" aria-label="双11扭蛋活动">
 <div class="ac-activity-heading"><button class="ac-back-activities" data-action="choose-activity" aria-label="返回活动选择">${icon('back')}<strong>双11扭蛋</strong></button><div class="ac-activity-tools"><button class="ac-ranking-entry" data-action="ranking" aria-label="查看专鉴王者榜"><span class="ac-ranking-emblem" aria-hidden="true">${icon('crown')}</span><span>王者榜</span>${icon()}</button><button data-action="expert-rules">规则</button></div></div>
 <div class="ac-pool-selector" role="tablist" aria-label="选择抽奖券">${['ordinary','advanced'].map(value=>`<button role="tab" data-action="pool:${value}" data-pool="${value}" aria-selected="${pool===value}" ${drawing?'disabled':''}>${rewardArt(value)}<span><strong>${value==='advanced'?'高级抽奖券':'普通抽奖券'}</strong><small><b>${balance[value]}</b> 张可用</small></span><i aria-hidden="true">${pool===value?icon('check'):''}</i></button>`).join('')}</div>
 <div class="ac-machine-stage">${machineMarkup({pool,compact:true})}<button data-action="skip-draw" class="ac-skip" ${drawing?'':'hidden'}>跳过动画 ${icon()}</button></div>
 <div class="ac-draw-actions"><button class="cl-secondary draw-state-button" data-action="draw:1" ${drawing||!enabled||balance[pool]<1?'disabled':''}><strong>${!premium&&balance.daily?'免费扭一次':'扭一次'}</strong><small>${drawHint(1)}</small></button><button class="cl-primary draw-state-button ${premium?'is-premium':''}" data-action="draw:5" ${drawing||!enabled||balance[pool]<5?'disabled':''}><strong>五连扭蛋</strong><small>${drawHint(5)}</small></button></div>
 <p class="ac-expiry-note" role="status">${!enabled?(now<START?'10月27日开启，敬请期待':'活动已结束，奖品与记录保留'):balance.daily&&!premium?'每日赠券当天有效，优先使用':balance[pool]<1?'暂无可用券，完成专鉴即可得券':'鉴定所得抽奖券，活动结束时失效'}</p>
 <div class="ac-inline-progress">${progressMarkup(state,{compact:true})}<button class="ac-progress-expert" data-action="go-expert">去专鉴 ${icon()}</button></div>
 ${eventTicketPanelMarkup(state,now,ticketStatus)}
 </section>`;
}

export function cardLotteryMarkup(state,now,status='unused',{isDemo=false}={}){
 return `<div class="ac-activity-heading"><button class="ac-back-activities" data-action="choose-activity" aria-label="返回活动选择">${icon('back')}<strong>卡牌抽奖活动</strong></button><small>下期待开启</small></div>
 ${isDemo?'<p class="ac-demo-note">当前为第一期历史示例，未写入你的卡牌记录。</p>':''}
 ${ticketPanel(state,now,status,{ticketOnly:true})}
 <div class="ac-card-bottom"><button class="cl-primary" data-action="go-card">去鉴卡牌</button></div>`;
}
