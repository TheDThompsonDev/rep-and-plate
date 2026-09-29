import type { FoodPreferences } from '../preferences/contracts.ts';

const dairy = ['milk','buttermilk','cream','cheese','yogurt','yoghurt','butter','whey','casein','caseinate','lactalbumin','lactoglobulin','ghee'];
const eggs = ['egg','albumen','ovalbumin'];
const fish = ['fish','salmon','tuna','cod','haddock','anchovy','anchovies','sardine','trout','tilapia'];
const shellfish = ['shellfish','shrimp','prawn','crab','lobster','crayfish','clam','mussel','oyster','scallop'];
const meat = ['chicken','beef','pork','turkey','bacon','ham','lamb','duck','veal','venison','gelatin',...fish,...shellfish];
const treeNuts = ['almond','brazil nut','cashew','hazelnut','filbert','macadamia','pecan','pistachio','walnut'];
const peanuts = ['peanut','groundnut','arachis'];
const wheat = ['wheat','semolina','durum','spelt','farro','einkorn','bulgur','couscous','seitan'];
const aliases:Record<string,string[]> = {
  vegan:[...dairy,...eggs,...meat,'honey'],vegetarian:meat,
  dairy, milk:dairy,'dairy free':dairy,'milk free':dairy,
  egg:eggs,eggs,'egg free':eggs,
  fish,'fish free':fish,shellfish,'shellfish free':shellfish,
  nuts:[...peanuts,...treeNuts],'nut free':[...peanuts,...treeNuts],
  'tree nuts':treeNuts,'tree nut':treeNuts,'tree nut free':treeNuts,
  peanut:peanuts,peanuts,'peanut free':peanuts,
  soy:['soy','soya','soybean','tofu','tempeh','edamame','miso','natto'],
  'soy free':['soy','soya','soybean','tofu','tempeh','edamame','miso','natto'],
  sesame:['sesame','tahini','benne'],'sesame free':['sesame','tahini','benne'],
  wheat,'wheat free':wheat,'gluten free':[...wheat,'gluten','barley','rye','malt'],
};
const normalize=(text:string)=>text.toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** A conservative name/ingredient check, never a guarantee about allergens or handling. */
export function excludedIngredientText(name:string,preferences:FoodPreferences):string|undefined {
  const text=normalize(name);
  const exclusions=[...preferences.restrictions,...preferences.dislikes].flatMap(item=>{
    const normalized=normalize(item).replace(/^no\s+/,'').replace(/\s+allerg(?:y|ies)$/,'');
    return aliases[normalized] ?? [normalized];
  });
  return exclusions.find(term=>{
    if(!term)return false;
    // These product names do not establish the presence of dairy; ingredient text still does.
    let candidate=text;
    if(['milk','cream','butter'].includes(term)) candidate=candidate.replace(/\b(?:almond|oat|soy|soya|coconut|rice|cashew|peanut|sunflower|shea|cocoa)\s+(?:milk|cream|butter)\b/g,'plant product');
    return new RegExp(`(^|[^a-z0-9])${escape(term)}(?:s|es)?($|[^a-z0-9])`,'i').test(candidate);
  });
}
