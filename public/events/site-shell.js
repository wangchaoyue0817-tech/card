const routes={home:'home',expert:'home',card:'card',lottery:'activity',prizes:'activity',ranking:'activity'};
const titles={home:'首页',expert:'专家鉴别',card:'鉴卡牌',lottery:'抽奖中心',prizes:'我的奖品',ranking:'专鉴荣誉榜'};
const frames=new Map(),pending=new Map(),ready=new Set();let current='';
function send(frame,message){frame.contentWindow?.postMessage({channel:'jianx-shell',...message},location.origin);}
function activate(route,extra={}){
  if(!routes[route]){route='home';history.replaceState({route},'','#home');}current=route;const module=routes[route];
  document.title=`图灵鉴 X · ${titles[route]}`;
  document.getElementById('site-loading').hidden=ready.has(module);
  for(const [key,frame]of frames){frame.hidden=key!==module;send(frame,{type:'visibility',active:key===module});}
  let frame=frames.get(module);const message={type:'activate',route,...extra};
  if(!frame){frame=document.createElement('iframe');frame.title=titles[route];frame.src=`${module}.html?embedded=1${route==='expert'?'&tab=expert':''}${module!=='home'?'#'+route:''}`;frame.dataset.module=module;frames.set(module,frame);pending.set(module,message);document.querySelector('.site-shell').append(frame);document.getElementById('site-loading').hidden=false;}
  else {frame.hidden=false;if(ready.has(module))send(frame,message);else pending.set(module,message);}
}
function navigate(route,extra={}){if(!routes[route])return;if(location.hash!=='#'+route)history.pushState({route},'',`#${route}`);activate(route,extra);}
function navigationExtras(message){
  const extra={intent:message.intent,...(message.photo?{photo:message.photo}:{})};
  if(['expert','card-past','card-next'].includes(message.event))extra.event=message.event;
  if(['ordinary','advanced'].includes(message.pool))extra.pool=message.pool;
  if(['unused','used','expired'].includes(message.ticketStatus))extra.ticketStatus=message.ticketStatus;
  return extra;
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.channel!=='jianx-module')return;
  const entry=[...frames].find(([,frame])=>frame.contentWindow===event.source);if(!entry)return;
  const [module,frame]=entry, message=event.data;
  if(message.type==='ready'){ready.add(module);const next=pending.get(module);pending.delete(module);if(routes[current]===module){send(frame,next||{type:'activate',route:current});document.getElementById('site-loading').hidden=true;}send(frame,{type:'visibility',active:routes[current]===module});}
  if(message.type==='navigate')navigate(message.route,navigationExtras(message));
  if(message.type==='route'&&routes[current]===module&&routes[message.route]===module){current=message.route;history.replaceState({route:current},'',`#${current}`);document.title=`图灵鉴 X · ${titles[current]}`;}
  if(message.type==='new-chat'){for(const other of frames.values())send(other,{type:'reset-chat'});navigate('home',{intent:'new-chat'});}
});
window.addEventListener('popstate',()=>activate(location.hash.slice(1)||'home'));
window.addEventListener('hashchange',()=>{const route=location.hash.slice(1)||'home';if(route!==current)activate(route);});
activate(location.hash.slice(1)||'home');
