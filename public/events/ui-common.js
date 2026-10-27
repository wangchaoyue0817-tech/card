import {sidebarIcons} from './sidebar-icons.js';
export const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const glyph = name => `<img class="cl-icon" src="assets/icons/${name}.svg" alt="" aria-hidden="true">`;
export function notify(message){
  let el=document.getElementById('cl-toast');if(!el){el=document.createElement('div');el.id='cl-toast';el.setAttribute('role','status');document.body.append(el);}
  el.textContent=message;el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.hidden=true,3200);
}
// Shared navigation for the four retained modules; no fake history or dead links.
export function setupDrawer(openButton, actions={}){
  if(document.getElementById('app-drawer-layer'))return;
  const icon=(name, className='')=>sidebarIcons[name].replace('<svg ',`<svg class="${className}" `);
  const layer=document.createElement('div');layer.id='app-drawer-layer';layer.className='app-drawer-layer';layer.setAttribute('aria-hidden','true');layer.inert=true;
  layer.innerHTML=`
    <button class="app-drawer-scrim" type="button" aria-label="关闭侧边栏" tabindex="-1" data-close></button>
    <aside class="app-drawer" role="dialog" aria-modal="true" aria-label="图灵鉴功能导航">
      <header class="drawer-account">
        <div class="drawer-user-entry">
          <span class="drawer-avatar"><img src="assets/sidebar-avatar.png" alt="用户头像"></span>
          <span class="drawer-user-copy"><strong>图灵鉴 X</strong><span>发现每一份收藏的价值</span></span>
        </div>
        <button class="drawer-close" type="button" aria-label="关闭侧边栏" data-close>${icon('X')}</button>
      </header>
      <section class="drawer-console" aria-label="快捷功能">
        <div class="drawer-shortcuts two-columns" role="group" aria-label="鉴定服务">
          <button class="drawer-shortcut" type="button" data-route="home"><span>${icon('Sparkle')}</span><b>AI 鉴别</b></button>
          <button class="drawer-shortcut" type="button" data-route="expert"><span>${icon('Scan')}</span><b>专家鉴别</b></button>
        </div>
        <div class="drawer-divider" aria-hidden="true"></div>
        <div class="drawer-shortcuts two-columns" role="group" aria-label="卡牌与好礼">
          <button class="drawer-shortcut" type="button" data-route="card"><span>${icon('Scan')}</span><b>卡牌鉴定</b></button>
          <button class="drawer-shortcut drawer-lottery-entry" type="button" data-route="lottery"><span>${icon('Gift')}</span><b>抽奖中心</b></button>
        </div>
      </section>
      <button class="drawer-new-chat" type="button" data-new-chat>
        <span class="drawer-new-chat-icon">${icon('SparkleFill','drawer-new-chat-icon-spark')}</span>
        <span><b>新建对话</b></span><span class="drawer-new-chat-spark">${icon('ArrowRight')}</span>
      </button>
    </aside>`;
  const host=document.querySelector('.cl-device')||document.getElementById('app');
  host.append(layer);
  const drawer=layer.querySelector('.app-drawer'), closeButton=layer.querySelector('.drawer-close');
  let previousFocus, background=[];
  function close(){
    if(!layer.classList.contains('is-open'))return;
    layer.classList.remove('is-open');layer.setAttribute('aria-hidden','true');layer.inert=true;
    background.forEach(([element,inert])=>element.inert=inert);background=[];
    document.removeEventListener('keydown',onKeyDown,true);
    previousFocus?.focus();
  }
  function onKeyDown(event){
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
    if(event.key!=='Tab')return;
    const focusables=[...drawer.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')];
    const first=focusables[0],last=focusables.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  function open(event){
    event?.stopPropagation();document.getElementById('menuPanel')?.setAttribute('hidden','');
    previousFocus=document.activeElement;
    background=[...host.children].filter(element=>element!==layer).map(element=>[element,element.inert]);
    background.forEach(([element])=>element.inert=true);
    layer.inert=false;layer.setAttribute('aria-hidden','false');layer.classList.add('is-open');
    document.addEventListener('keydown',onKeyDown,true);closeButton.focus();
  }
  openButton?.addEventListener('click',open);
  layer.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
  layer.querySelectorAll('[data-route]').forEach(button=>button.onclick=()=>{close();window.jianxNavigate(button.dataset.route);});
  layer.querySelector('[data-new-chat]').onclick=()=>{close();if(actions.onNewChat)actions.onNewChat();else window.jianxNewChat();};
  window.addEventListener('jianx-shell',event=>{if(event.detail.type==='visibility'&&!event.detail.active)close();});
  return {open,close,element:layer};
}
