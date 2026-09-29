async function init() {
 const response = await fetch('manifest.json');
 if (!response.ok) throw Error('The story collection could not load. Please refresh.');
 const items = await response.json();
 const selected = new URLSearchParams(location.search).get('card');
 if (selected && !items.some(item => item.id === selected)) throw Error('That story was not found. Open the collection without the card parameter.');
 if (selected) document.body.classList.add('export');
 const root = document.querySelector('#stories');
 for (const item of items) {
  if (selected && selected !== item.id) continue;
  const article = document.createElement('article'); article.className='story'; article.dataset.category=item.category;
  const poster = document.createElement('div'); poster.className='story-poster';
  const conversation = document.createElement('div'); conversation.className='conversation';
  const user = document.createElement('p'); user.className='user-line'; user.textContent=item.setup;
  const reply = document.createElement('p'); reply.className='spot-line';
  const avatar = document.createElement('img'); avatar.src='../../images/spot/expansion/shrug.png'; avatar.alt='Spot';
  const replyText = document.createElement('span'); replyText.textContent=item.reply; reply.append(avatar,replyText);conversation.append(user,reply);
  const scene = document.createElement('img'); scene.className='scene'; scene.src=item.asset; scene.alt=item.alt || item.scene; scene.loading=selected?'eager':'lazy';
  const punchline = document.createElement('div'); punchline.className='punchline';
  const title = document.createElement('h2'); title.textContent=item.title;
  const signature = document.createElement('span'); signature.className='signature'; signature.textContent='Rep & Plate'; punchline.append(title,signature);
  poster.append(conversation,scene,punchline);
  const details = document.createElement('p'); details.className='details';
  const category = document.createElement('b'); category.textContent=item.category+' · ';details.append(category,document.createTextNode(item.use));
  const actions = document.createElement('div'); actions.className='actions';
  for (const [label,url] of [['Share card',item.card],['Scene only',item.asset]]) { const a=document.createElement('a');a.href=url;a.download='';a.textContent=label;a.setAttribute('aria-label',`${label}: ${item.title}`);actions.append(a); }
  const copy=document.createElement('button');copy.type='button';copy.textContent='Copy exchange';copy.setAttribute('aria-label',`Copy exchange: ${item.title}`);
  copy.onclick=async()=>{const text=[item.setup,item.reply,item.title].join('\n');try{await navigator.clipboard.writeText(text);document.querySelector('#status').textContent='Exchange copied.';}catch{document.querySelector('#status').textContent='Copy this exchange: '+text;}};
  actions.append(copy);article.append(poster,details,actions);root.append(article);
 }
 const filters=document.querySelector('.filters');
 for (const category of ['All',...new Set(items.map(item=>item.category))]) {const button=document.createElement('button');button.type='button';button.textContent=category;button.setAttribute('aria-pressed',String(category==='All'));button.onclick=()=>{for(const b of filters.children)b.setAttribute('aria-pressed',String(b===button));let count=0;for(const card of root.children){card.hidden=category!=='All'&&card.dataset.category!==category;if(!card.hidden)count++;}document.querySelector('#count').textContent=`${count} little stories`;};filters.append(button);}
 document.querySelector('#count').textContent=`${items.length} little stories · ready to share`;
}
init().catch(error=>{document.querySelector('#status').textContent=error.message;});
