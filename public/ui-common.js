import {sidebarIcons} from './sidebar-icons.js';
export const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const glyph = name => `<img class="cl-icon" src="assets/icons/${name}.svg" alt="" aria-hidden="true">`;
export function notify(message){
  let el=document.getElementById('cl-toast');if(!el){el=document.createElement('div');el.id='cl-toast';el.setAttribute('role','status');document.body.append(el);}
  el.textContent=message;el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.hidden=true,3200);
}
// Static port of the existing app/app-sidebar.tsx. Keep its content and structure;
// the only new element is drawer-lottery-entry in the top service row.
export function setupDrawer(openButton, actions={}){
  if(document.getElementById('app-drawer-layer'))return;
  const icon=(name, className='')=>sidebarIcons[name].replace('<svg ',`<svg class="${className}" `);
  const conversationGroups=[
    {label:'今天',items:[{title:'我的秋日肤况复盘',time:'21:36',active:true},{title:'暖黄调底妆怎么选',time:'14:20'}]},
    {label:'近 7 天',items:[{title:'换季屏障修护计划',time:'09/11'},{title:'眼周疲态护理建议',time:'09/07'}]},
    {label:'近 30 天',items:[{title:'T 区油光分区护理',time:'08/28'},{title:'晨间精简护肤流程',time:'08/21'}]}
  ];
  const layer=document.createElement('div');layer.id='app-drawer-layer';layer.className='app-drawer-layer';layer.setAttribute('aria-hidden','true');layer.inert=true;
  layer.innerHTML=`
    <button class="app-drawer-scrim" type="button" aria-label="关闭侧边栏" tabindex="-1" data-close></button>
    <aside class="app-drawer" role="dialog" aria-modal="true" aria-label="图灵鉴功能导航">
      <header class="drawer-account">
        <button class="drawer-user-entry" type="button" aria-label="用户名，用户设置入口">
          <span class="drawer-avatar"><img src="assets/sidebar-avatar.png" alt="用户头像"></span>
          <span class="drawer-user-copy"><strong>用户名</strong><span>用户设置</span></span>
          ${icon('CaretRight','drawer-entry-arrow')}
        </button>
        <button class="drawer-badge" type="button" aria-label="我的徽章，已获得9枚，共11枚；演示入口暂不跳转">
          ${icon('Medal')}<span><small>我的徽章</small><b>9 / 11</b></span>${icon('CaretRight','drawer-entry-arrow')}
        </button>
        <button class="drawer-close" type="button" aria-label="关闭侧边栏" data-close>${icon('X')}</button>
      </header>
      <section class="drawer-console" aria-label="快捷功能">
        <div class="drawer-shortcuts two-columns has-lottery" role="group" aria-label="订单服务">
          <button class="drawer-shortcut" data-expert><span>${icon('Scan')}</span><b>专鉴服务</b></button>
          <button class="drawer-shortcut" type="button" data-orders aria-label="商品订单，查看核验与物流"><span>${icon('Bag')}</span><b>商品订单</b></button>
          <button class="drawer-shortcut drawer-lottery-entry"><span>${icon('Gift')}</span><b>抽奖中心</b></button>
        </div>
        <div class="drawer-divider" aria-hidden="true"></div>
        <div class="drawer-shortcuts three-columns" role="group" aria-label="智能功能">
          <button class="drawer-shortcut" type="button" data-skin><span>${icon('Sparkle')}</span><b>皮肤管理</b></button>
          <div class="drawer-shortcut is-static"><span>${icon('ShirtFolded')}</span><b>穿搭管理</b></div>
          <div class="drawer-shortcut is-static"><span>${icon('ForkKnife')}</span><b>鉴餐管理</b></div>
        </div>
      </section>
      <button class="drawer-new-chat" type="button" data-new-chat>
        <span class="drawer-new-chat-icon">${icon('SparkleFill','drawer-new-chat-icon-spark')}</span>
        <span><b>新建对话</b></span><span class="drawer-new-chat-spark">${icon('ArrowRight')}</span>
      </button>
      <section class="drawer-history">
        <header><span>${icon('ChatCircleDots')} 历史对话</span></header>
        <div class="drawer-history-scroll">${conversationGroups.map(group=>`<div class="drawer-history-group"><h3>${group.label}</h3>${group.items.map(item=>`<div class="drawer-chat-row ${item.active?'is-current':''}"><span><span class="drawer-chat-dot ${item.active?'is-live':''}"></span></span><b>${item.title}</b><time>${item.time}</time>${icon('ArrowRight','drawer-chat-arrow')}</div>`).join('')}</div>`).join('')}</div>
      </section>
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
  layer.querySelector('.drawer-lottery-entry').onclick=()=>{close();window.jianxNavigate('lottery');};
  layer.querySelector('[data-expert]').onclick=()=>{close();window.jianxNavigate('expert');};
  layer.querySelector('[data-orders]').onclick=()=>{close();(actions.onOrders||(()=>window.jianxNavigate('orders')))();};
  layer.querySelector('[data-skin]').onclick=()=>{close();(actions.onSkinManagement||(()=>window.jianxNavigate('skin-management')))();};
  layer.querySelector('[data-new-chat]').onclick=()=>{close();if(actions.onNewChat)actions.onNewChat();else window.jianxNewChat();};
  return {open,close,element:layer};
}
