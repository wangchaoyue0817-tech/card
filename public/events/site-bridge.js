window.jianxActive=true;
window.jianxNavigate=(route,extra={})=>{if(parent!==window)parent.postMessage({channel:'jianx-module',type:'navigate',route,...extra},location.origin);else location.href=`index.html#${route}`;};
window.jianxNewChat=()=>{if(parent!==window)parent.postMessage({channel:'jianx-module',type:'new-chat'},location.origin);else location.href='index.html#home';};
window.jianxRoute=route=>{if(parent!==window)parent.postMessage({channel:'jianx-module',type:'route',route},location.origin);};
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.channel!=='jianx-shell')return;if(event.data.type==='visibility')window.jianxActive=event.data.active;window.dispatchEvent(new CustomEvent('jianx-shell',{detail:event.data}));});
window.jianxReady=()=>{if(parent!==window)parent.postMessage({channel:'jianx-module',type:'ready'},location.origin);};
