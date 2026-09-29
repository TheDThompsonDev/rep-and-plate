async function init(){
 const response=await fetch('manifest.json'); if(!response.ok)throw Error('The reaction library could not load.');
 const items=await response.json();
 const params=new URLSearchParams(location.search), selected=params.get('card');
 if(selected)document.body.classList.add('export');
 const root=document.querySelector('#cards');
 const papers=['#e7efdf','#e4efe9','#f5ead6','#efece2','#e9eedc','#f3e8d6','#e4eeea','#efe9d9','#e4eff0','#e9eddd','#ede8f0','#e5ecdf'];
 for(const [index,item] of items.entries()){
  if(selected&&selected!==item.id)continue;
  const article=document.createElement('article');article.className='card';article.dataset.id=item.id;article.dataset.category=item.category;
  const poster=document.createElement('div');poster.className='poster';poster.style.setProperty('--paper',papers[index%papers.length]);
  const title=document.createElement('h3');title.textContent=item.title;
  const caption=document.createElement('p');caption.textContent=item.caption;
  const art=document.createElement('img');art.src=item.asset;art.alt=item.alt;art.loading=selected?'eager':'lazy';
  const signature=document.createElement('span');signature.className='signature';signature.textContent='Rep & Plate';
  poster.append(title,caption,art,signature);
  const meta=document.createElement('p');meta.className='meta';const cat=document.createElement('b');cat.textContent=item.category+' · ';meta.append(cat,document.createTextNode(item.use));
  const actions=document.createElement('div');actions.className='actions';
  for(const [label,url] of [['Sticker PNG',item.asset],['Meme PNG',item.meme]]){const link=document.createElement('a');link.textContent=label;link.href=url;link.download='';link.setAttribute('aria-label',`${label}: ${item.title}`);actions.append(link);}
  const copy=document.createElement('button');copy.type='button';copy.textContent='Copy caption';copy.setAttribute('aria-label',`Copy caption: ${item.title}`);copy.onclick=async()=>{try{await navigator.clipboard.writeText(item.title+'\n'+item.caption);document.querySelector('#status').textContent='Caption copied.';}catch{document.querySelector('#status').textContent='Copy this caption: '+item.title+' '+item.caption;}};actions.append(copy);
  article.append(poster,meta,actions);root.append(article);
 }
 const filters=document.querySelector('.filters');
 for(const category of ['All',...new Set(items.map(x=>x.category))]){const button=document.createElement('button');button.type='button';button.textContent=category;button.setAttribute('aria-pressed',String(category==='All'));button.onclick=()=>{for(const b of filters.children)b.setAttribute('aria-pressed',String(b===button));let count=0;for(const card of root.children){card.hidden=category!=='All'&&card.dataset.category!==category;if(!card.hidden)count++;}document.querySelector('.count').textContent=`${count} reactions ready to use`;};filters.append(button);}
 document.querySelector('.count').textContent=`${items.length} reactions · transparent stickers + 1080 × 1080 caption cards`;
}
init().catch(error=>{document.querySelector('#status').textContent=error.message;});
