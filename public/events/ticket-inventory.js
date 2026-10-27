import {END} from './lottery-model.js';

// Ordinary tickets share an event deadline. Consume oldest grants first,
// matching each actual debit to its pool; a partially used grant becomes two groups.
export function ticketInventory(data,now){
  const lots=[];
  for(const row of [...data.ledger].reverse()){
    if(row.amount>0){
      lots.push({...row,total:row.amount,remaining:row.amount,used:0,expiresAt:row.type==='welcome'?data.welcome.expiresAt:END});
    }else{
      let debit=-row.amount;
      for(const lot of lots){
        if(lot.type!==row.type||lot.expiresAt<=row.at||debit===0)continue;
        const take=Math.min(debit,lot.remaining);lot.remaining-=take;lot.used+=take;debit-=take;
      }
    }
  }
  const unused=lots.filter(lot=>lot.remaining>0&&now<lot.expiresAt).reverse();
  const expired=lots.filter(lot=>lot.remaining>0&&now>=lot.expiresAt).reverse();
  return {lots:lots.reverse(),unused,expired,counts:{unused:unused.reduce((n,l)=>n+l.remaining,0),used:lots.reduce((n,l)=>n+l.used,0),expired:expired.reduce((n,l)=>n+l.remaining,0)}};
}
