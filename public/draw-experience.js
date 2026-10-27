import {PRIZES} from './lottery-model.js';
import {esc,glyph} from './ui-common.js?v=original-sidebar-1';
import {ticketEmblem} from './reward-ui.js';

export const rewardTier = reward => reward.type==='physical'?'rare':'voucher';
export const rarityCopy = pool => `稀有实物 · 命中 ${pool==='welcome'?'1%':'5%'} 的幸运`;
export function selectionMarkup(count,pool){
  return `<section class="draw-experience" data-phase="selecting" data-count="${count}">
    <div class="draw-intro"><span class="draw-kicker">${count===5?'FIVE GIFTS. ONE MAGIC TOUCH.':'YOUR NEXT COLLECTIBLE SURPRISE'}</span><h3>${count===5?'一触开启，五重惊喜':'好运就位，等你翻开'}</h3><p>${count===5?'轻触任意卡牌，五份好礼同时揭晓':'轻触一张卡牌，揭晓属于你的好礼'}</p></div>
    <div class="draw-stage" aria-label="选择一张幸运卡牌">${Array.from({length:5},(_,i)=>`<button class="draw-choice" style="--slot:${i-2};--delay:${i*90}ms" data-pick="${i}" aria-label="选择第 ${i+1} 张卡牌"><span class="draw-card-inner"><span class="draw-card-back"><img src="assets/lottery-card-back.png" alt="蓝紫金收藏卡背"></span><span class="draw-card-front"></span></span></button>`).join('')}</div>
    <div class="draw-live" aria-live="polite"><strong>${count===5?'这一刻，五份惊喜一起绽放':'下一份收藏惊喜，由你亲手开启'}</strong><p>${pool==='welcome'?'新人专属 · 一次使用 5 张抽奖券':`本次使用 ${count} 张普通抽奖券`} · 中奖率 100%</p></div>
    <p class="draw-quiet">选中后开始抽取；离开前未选牌，不消耗抽奖券</p>
    <button class="draw-skip cl-text-button" hidden>跳过动画，查看全部结果</button>
    <div class="draw-batch-actions" hidden><button class="draw-details cl-primary">查看奖品详情 ${glyph('arrow-right')}</button><button class="cl-text-button" data-action="grant-prizes">前往我的奖品</button></div>
  </section>`;
}

function front(reward,photo){
  const prize=PRIZES.find(p=>p.id===reward.prizeId);
  return prize?`<span class="draw-front-level">稀有实物</span>${photo(prize,true)}<strong>${esc(prize.name)}</strong><small>${prize.spec}</small>`:`<span class="draw-front-level">专属好礼</span>${ticketEmblem()}<strong>专家线上<br>鉴定券</strong><small>1 张 · 有效期 7 天</small>`;
}

// Decorative particles are transient animation, not prize assets. No strobe or infinite effects.
export function celebrate(host,tier='voucher'){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return ()=>{};
  const canvas=document.createElement('canvas');canvas.className='draw-celebration';canvas.setAttribute('aria-hidden','true');host.append(canvas);
  const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return ()=>{};}
  const box=host.getBoundingClientRect(),w=box.width,h=Math.min(host.clientHeight,760),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.height=`${h}px`;ctx.scale(dpr,dpr);
  const rare=tier==='rare',duration=rare?3000:1700,colors=rare?['#ffe6a3','#f6c76e','#fff0cc','#d2b8ff']:['#bfa7ff','#88d6ee','#eed8ff'];
  const particles=Array.from({length:rare?130:38},(_,i)=>{
    const burst=i%3,angle=(i*2.39996),speed=rare?35+(i%17)*6:25+(i%9)*6;
    return {x:w*[.2,.8,.5][burst],y:h*[.23,.28,.18][burst],vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,born:rare?burst*350:0,color:colors[i%colors.length],size:1+(i%3)*.5};
  });
  let raf=0,stopped=false,start=performance.now();
  function frame(t){if(stopped)return;ctx.clearRect(0,0,w,h);for(const p of particles){const age=(t-start-p.born)/1000;if(age<0||age>1.8)continue;ctx.globalAlpha=Math.max(0,1-age/1.8);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x+p.vx*age,p.y+p.vy*age+36*age*age,p.size,0,Math.PI*2);ctx.fill();}if(t-start<duration)raf=requestAnimationFrame(frame);else canvas.remove();}
  raf=requestAnimationFrame(frame);return ()=>{stopped=true;cancelAnimationFrame(raf);canvas.remove();};
}

export function mountDraw({dialog,count,pool,photo,commit,onComplete,onError,effect=celebrate}){
  const root=dialog.querySelector('.draw-experience'),buttons=[...root.querySelectorAll('[data-pick]')],live=root.querySelector('.draw-live');
  let phase='selecting',batch=null,selected=null,index=0,timers=[],effects=[];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const later=(fn,delay)=>timers.push(setTimeout(()=>{if(phase!=='closed')fn();},reduced?Math.min(delay,120):delay));
  const clear=()=>{timers.forEach(clearTimeout);timers=[];effects.forEach(fn=>fn());effects=[];};
  function finish(){if(!['revealing','revealed'].includes(phase))return;phase='complete';clear();onComplete(batch);}
  function revealBatch(){
    if(phase!=='revealing')return;
    clear();phase='revealed';root.dataset.phase='revealed';
    const rare=batch.rewards.some(reward=>rewardTier(reward)==='rare');
    buttons.forEach((button,i)=>{
      button.dataset.tier=rewardTier(batch.rewards[i]);
      button.querySelector('.draw-card-front').innerHTML=front(batch.rewards[i],photo);
      button.classList.add('is-flipped');
      button.setAttribute('aria-label',`第 ${i+1} 份奖品：${batch.rewards[i].type==='physical'?PRIZES.find(p=>p.id===batch.rewards[i].prizeId).name:'专家线上鉴定券 1 张'}`);
    });
    root.dataset.tier=rare?'rare':'voucher';
    root.querySelector('.draw-intro').innerHTML='<span class="draw-kicker">ALL FIVE GIFTS, ALL YOURS</span><h3>五重惊喜，全部收下</h3><p>每一份热爱，都有一份好礼回应</p>';
    live.innerHTML=`<strong>${rare?'稀有实物惊喜，也在其中':'恭喜！5 份好礼已全部揭晓'}</strong><p>${rare?rarityCopy(pool):'专家线上鉴定券 · 每张有效期一周'}</p>${pool==='welcome'?'<p>完成一次 AI 或专家鉴定，再获 1 张抽奖券<br><small>每日通过鉴定最多获得 10 张</small></p>':''}`;
    root.querySelector('.draw-skip').hidden=true;
    root.querySelector('.draw-batch-actions').hidden=false;
    const details=root.querySelector('.draw-details');details.onclick=finish;details.focus({preventScroll:true});
    later(()=>effects.push(effect(dialog,rare?'rare':'voucher')),reduced?0:350);
  }
  function reveal(){
    const reward=batch.rewards[index],rare=rewardTier(reward)==='rare';
    selected.classList.remove('is-flipped');
    later(()=>{
      selected.dataset.tier=rewardTier(reward);selected.querySelector('.draw-card-front').innerHTML=front(reward,photo);selected.classList.add('is-flipped');
      root.dataset.tier=rewardTier(reward);live.innerHTML=`<strong>${rare?'这一刻，稀有好运选中了你':'恭喜，收藏路上又添一份好礼'}</strong><p>${rare?rarityCopy(pool):'专家线上鉴定券 · 有效期一周'}</p><span class="draw-counter">${index+1} / ${count} 份惊喜已揭晓</span>`;
      later(()=>effects.push(effect(dialog,rewardTier(reward))),300);
      later(()=>{index++;if(index<count)reveal();else finish();},rare?2450:1650);
    },index===0?360:450);
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{
    if(phase!=='selecting')return;phase='committing';buttons.forEach(b=>b.disabled=true);
    const result=commit();if(result.error){phase='closed';onError(result.error);return;}
    batch=result.batch;phase='revealing';selected=button;root.dataset.phase='revealing';
    buttons.forEach(b=>{b.classList.toggle('is-selected',count===1&&b===button);b.setAttribute('aria-hidden',count===5||b===button?'false':'true');});
    root.querySelector('.draw-intro').innerHTML=`<span class="draw-kicker">YOUR LUCK, REVEALED</span><h3>${count===5?'五份好礼，即将揭晓':'为你揭晓'}</h3><p>${count===5?'好运正在向你靠近':'每份惊喜，都值得这一刻'}</p>`;
    root.querySelector('.draw-quiet').textContent='结果已保存，中途离开也可在「我的奖品」查看';
    const skip=root.querySelector('.draw-skip');skip.hidden=false;skip.onclick=count===5?revealBatch:finish;skip.focus();
    if(count===5)later(revealBatch,620);else reveal();
  }));
  return ()=>{phase='closed';clear();};
}
