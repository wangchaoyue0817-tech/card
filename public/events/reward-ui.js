import {esc,glyph} from './ui-common.js';
export const rewardTime=t=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(t);
export const ticketEmblem=()=>'<img class="ticket-emblem" src="assets/icons/crystal-reward.svg" alt="" aria-hidden="true">';
export function voucherMarkup(count,expiresAt,options={}){
  const {
    title='专家线上鉴别券',category='卡牌专属 · 专家服务',action='voucher-use',
    used=false,expired=false,readOnly=false,displayExpiresAt=expiresAt,
    note='中奖后有效期 7 天',
  }=options;
  const unavailable=used||expired;
  const status=used?'已使用':expired?'已过期':'可使用';
  const control=expiresAt?(unavailable
    ?`<button class="coupon-use" disabled>${status}</button>`
    :readOnly?`<small class="coupon-status">${status}</small>`
    :`<button class="coupon-use" data-action="${esc(action)}">去使用 ${glyph('arrow-right')}</button>`):'';
  return `<div class="center-voucher-reward reward-coupon${used?' is-used':expired?' is-expired':''}"><div class="coupon-value"><span>EXPERT PASS</span>${ticketEmblem()}<strong>×${esc(count)}</strong><small>专家鉴别券</small></div><div class="coupon-content"><span class="coupon-category">${esc(category)}</span><strong>${esc(title)}</strong><small>${expiresAt?`到期时间<br>${rewardTime(displayExpiresAt)}`:esc(note)}</small>${control}</div></div>`;
}
export function grantMarkup({amount=1,source='AI 鉴定完成',pool='ordinary',expiresAt,today=null,sharePrompt=false,retry=false}){
  const newcomer=pool==='welcome',complete=today===10;
  return `<section class="grant-hero grant-hero-designed"><span>${newcomer?'A WELCOME GIFT, JUST FOR YOU':'YOUR COLLECTION DESERVES MORE'}</span><div class="grant-keepsake"><div class="grant-keepsake-rule"></div><span>图灵鉴 X · 收藏礼遇</span>${ticketEmblem()}${amount?`<b>+${amount}<small> 张抽奖券</small></b>`:'<b class="grant-complete-mark">鉴定完成</b>'}<em>${amount?'100% 中奖 · 好礼为你而来':'每一次认真，都值得被看见'}</em></div><h3>${amount?(newcomer?'初见礼遇，五重惊喜':'你的热爱，自有回响'):'今天的探索，已集满'}</h3><p>${amount?'让下一份收藏惊喜，从此刻发生。':'鉴定已完成，继续发现收藏的价值。'}</p><small>${source}</small></section>
    ${today!==null?`<p class="grant-daily-note">今日鉴定获券 ${today} / 10 张 · 每日上限 10 张${amount?'':'<br>本次不再新增抽奖券，已有抽奖券仍可使用。'}</p>`:''}
    ${amount?`<p class="grant-validity">${rewardTime(expiresAt)} 到期 · ${newcomer?'5 张需一次性抽完':'可单抽或积攒五连抽'}</p>`:''}
    ${sharePrompt?`<section class="grant-share"><h4>今日满额，再领 5 张好运</h4><button class="cl-gold cl-full" data-action="share-claim">转发小程序 · 再领 5 张</button><p>每天限领一次，仅本弹窗内点击转发有效。关闭或离开此弹窗，当天不可补领；不占每日鉴定额度。</p></section>`:''}
    <div class="grant-actions">${amount?`<button class="cl-gold" data-action="${newcomer?'draw-welcome':'draw-one'}">${newcomer?'立即五连抽':'立即抽奖'} ${glyph('arrow-right')}</button>`:''}<button class="${amount?'cl-secondary':'cl-primary'}" data-action="grant-center">去抽奖中心 ${glyph('arrow-right')}</button><button class="cl-text-button" data-action="close">${amount?'稍后再说':'继续探索'}</button></div>${retry?'<button class="cl-text-button cl-full" data-action="share-retry">重试转发</button>':''}`;
}
export function rulesMarkup(){
  return `<div class="cl-rules"><p class="cl-event-label">2026.09.25—2026.10.07 · 北京时间</p><h3>01 / 先认识你的抽奖券</h3><p>活动期新注册用户首次进入鉴卡牌，或在首页上传卡牌图片出现选款入口时，可领新人券 5 张，两种入口不重复领取。需一次性五连抽，到账 24 小时有效，最晚不超过活动结束。普通券可单抽或五连抽，活动结束失效。</p><h3>02 / 每一次都有好礼</h3><table><thead><tr><th>抽奖类型</th><th>实物</th><th>鉴定券</th></tr></thead><tbody><tr><td>普通抽奖</td><td>5%</td><td>95%</td></tr></tbody></table><p>中奖率 100%，没有空奖。专家鉴定券有效期一周，可在「我的奖品」查看实际到期日。</p><h3>03 / 把好运攒起来</h3><p>AI 出结果、专家支付或用券兑换成功，各送 1 张；同卡转专家可再送。每日合计最多 10 张。达到第 10 张时，当次弹窗点击转发小程序再得 5 张，每天一次；关闭当天不可补领。</p><h3>04 / 分享热爱，也分享好运</h3><p>转发小程序，邀请一位新用户完成注册即可得 5 张，无需先达到 10 张。普通转发本身不送券；新用户注册前最后打开的小程序分享卡片所属邀请人获得奖励。邀请、新人及满额分享奖励不计入鉴定每日上限。</p><h3>05 / 关于领奖</h3><p>实物中奖后填写收货地址，可随时修改。活动结束后 7 个工作日内寄出。未过期专家鉴定券不随活动结束失效。</p></div>`;
}
