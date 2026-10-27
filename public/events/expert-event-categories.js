// Shared by the classic product picker and the event model's module import.
// Keep the activity scope separate from the complete, free appraisal catalog.
(() => {
  const categories = Object.freeze([
    {id:'beauty',name:'美妆',aliases:['鉴美妆']},
    {id:'bags',name:'包袋',aliases:['鉴包袋']},
    {id:'footwear',name:'鞋靴',aliases:['鉴鞋靴']},
    {id:'apparel',name:'服饰',aliases:['潮服','鉴服饰','鉴潮服']},
    {id:'watches',name:'手表',aliases:['腕表','鉴手表','鉴腕表']},
    {id:'electronics-appliances',name:'数码家电',aliases:['数码3C','数码','鉴数码','鉴数码3C']},
    {id:'electronics-nondestructive',name:'3C无损',aliases:['3C']}
  ].map(category => Object.freeze({...category,aliases:Object.freeze(category.aliases)})));
  const normalize = value => value.trim().toLowerCase().replace(/\s+/g,'');
  const eligibleNames = new Set(categories.flatMap(category => [category.id,category.name,...category.aliases]).map(normalize));
  const isEligibleCategory = category => {
    // A supplied catalog ID takes precedence over the display name.
    const value = typeof category==='object'&&category!==null ? category.id||category.name : category;
    return typeof value==='string'&&eligibleNames.has(normalize(value));
  };
  globalThis.JianxExpertEventCategories = Object.freeze({categories,isEligibleCategory});
})();
