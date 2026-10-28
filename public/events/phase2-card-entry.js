// The archived campaign remains read-only; this banner only opens the new preview.
function updateEntry(){
 const entry=document.querySelector('.card-luck-entry');if(!entry||entry.dataset.phase2)return;
 entry.dataset.phase2='true';entry.dataset.action='open-eb05-preview';
 entry.querySelector('strong').textContent='海贼 EB05 上新，免费抽好礼';
 entry.querySelector('em').textContent='第二期 · 10.30—11.05 · 前往抽奖';
}
updateEntry();
new MutationObserver(updateEntry).observe(document.getElementById('card-content'),{childList:true});
document.addEventListener('click',event=>{if(event.target.closest('[data-phase2]'))window.jianxNavigate('card-eb05');});
// Keep the old campaign archived; expose the second campaign's own demo settings.
document.addEventListener('click',event=>{
 if(!event.target.closest('[data-action="demo"],#demo-settings'))return;
 event.preventDefault();event.stopImmediatePropagation();
 window.jianxNavigate('card-eb05',{intent:'demo'});
},true);
