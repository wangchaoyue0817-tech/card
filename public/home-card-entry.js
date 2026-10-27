import {setupDrawer} from './ui-common.js?v=original-sidebar-1';
import {claimCampaignWelcome} from './events/campaign-session.js';
import {grantMarkup} from './reward-ui.js';
for(const href of ['design-tokens.css','drawer.css','card-theme.css','draw-experience.css','reward-polish.css']){const style=document.createElement('link');style.rel='stylesheet';style.href=href;document.head.append(style);}
const button=document.querySelector('.icon-menu');
if(button){button.onclick=null;setupDrawer(button);}
const dialog=document.createElement('dialog');dialog.className='cl-dialog is-reward home-welcome-dialog';document.body.append(dialog);
window.addEventListener('card-image-detected',()=>{try{const result=claimCampaignWelcome();if(!result.awarded)return;dialog.innerHTML='<header class="cl-modal-head"><h2>新人专属礼遇</h2><button data-action="close" class="cl-icon-button" aria-label="关闭弹窗">×</button></header>'+grantMarkup({amount:5,pool:'welcome',source:'卡牌类别专属新人礼',expiresAt:result.state.welcome.expiresAt});dialog.showModal();}catch{window.dispatchEvent(new CustomEvent('preview-error'));}});
dialog.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;dialog.close();if(button.dataset.action==='draw-welcome')window.jianxNavigate('lottery',{intent:'draw-welcome'});if(button.dataset.action==='grant-center')window.jianxNavigate('lottery');});
window.addEventListener('jianx-shell',event=>{const m=event.detail;if(m.type==='visibility'&&!m.active&&dialog.open)dialog.close();if(m.type!=='activate')return;if(m.intent==='new-chat'){document.getElementById('newConversation').click();}else if(m.route==='home')document.querySelector('[data-tab="ai"]').click();if(m.route==='expert')document.querySelector('[data-tab="expert"]').click();});
window.jianxReady();
