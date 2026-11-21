// Append-only local guestbook. Keep the existing storage key and all previous records.
const diaryUI=(()=>{
 const overlay=document.getElementById('diary-overlay'),win=document.getElementById('diary-win');
 const form=document.getElementById('diary-form'),list=document.getElementById('diary-list');
 const name=document.getElementById('diary-name'),memo=document.getElementById('diary-msg');
 const newButton=document.getElementById('diary-new'),readButton=document.getElementById('diary-read'),exportButton=document.getElementById('diary-export');
 const count=document.getElementById('diary-count'),pager=document.getElementById('diary-pagination'),pageLabel=document.getElementById('diary-page');
 const copy=(ko,en)=>I18N.get()==='en'?en:ko;
 const PAGE_SIZE=10;
 const welcome=[
  {id:'computer-welcome-supa-v1',name:'슈퍼짱',msg:'전시 보러와줘서 고마어+ㅁ+',date:''},
  {id:'computer-welcome-noma-v1',name:'평범양',msg:'ㅎ2',date:''},
 ];
 let appRef=null,archive=[],loaded=false,view='read',page=0,total=0;
 const owner=()=>CONFIG.guestbookOwner!==false;
 function clean(entry){
  if(!entry||typeof entry!=='object')return null;
  const item={name:Util.str(entry.name,12).trim(),msg:Util.str(entry.msg,240).trim(),date:Util.str(entry.date,40)};
  if(!item.name||!item.msg)return null;
  if(typeof entry.id==='string')item.id=entry.id;
  if(typeof entry.state==='string')item.state=entry.state;
  return item;
 }
 // No record-count cap: pagination limits DOM size, never stored history.
 const cleanList=items=>Util.arr(items).map(clean).filter(Boolean);
 const isWelcome=item=>welcome.some(seed=>seed.id===item.id||(seed.name===item.name&&seed.msg===item.msg));
 const withWelcome=items=>[...welcome.map(seed=>({...seed})),...cleanList(items).filter(item=>!isWelcome(item))];
 const load=()=>withWelcome(Util.store.json(CONFIG.guestbookKey,[]));
 function initialize(){
  const raw=Util.store.json(CONFIG.guestbookKey,[]),entries=withWelcome(raw);
  if(JSON.stringify(raw)!==JSON.stringify(entries))Util.store.setJSON(CONFIG.guestbookKey,entries);
 }
 function save(items){
  if(Util.store.setJSON(CONFIG.guestbookKey,withWelcome(items)))return true;
  toast(copy('저장하지 못했어요. 입력한 메모를 복사해 보관해주세요.','Could not save. Please copy your note before closing.'));return false;
 }
 const allEntries=()=>{const local=load();return [...local.slice(0,welcome.length),...archive.filter(item=>!isWelcome(item)),...local.slice(welcome.length)];};
 async function loadArchive(){
  if(loaded)return;loaded=true;const url=Util.safeUrl(CONFIG.guestbookArchive);if(!url)return;
  try{const response=await fetch(url,{cache:'no-store'});if(response.ok)archive=cleanList(await response.json());}catch{/* Local notes remain available. */}
 }
 function selectView(next){
  view=!owner()?'read':next;form.hidden=view!=='write';list.hidden=view!=='read';pager.hidden=view!=='read';
  newButton.setAttribute('aria-current',view==='write'?'page':'false');readButton.setAttribute('aria-current',view==='read'?'page':'false');
  count.textContent=view==='write'?`${memo.value.length} / 240`:copy(`${total}개의 메모`,`${total} notes`);
 }
 function render(resetScroll=false){
  const entries=allEntries();total=entries.length;const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));page=Math.max(0,Math.min(page,pages-1));
  const fragment=document.createDocumentFragment();
  for(const item of entries.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)){
   const article=document.createElement('article');article.className='diary-entry';
   const meta=document.createElement('div');meta.className='d-meta';
   const who=document.createElement('b');who.textContent=item.name;meta.append(who);
   if(item.date){const date=document.createElement('span');date.textContent=item.date;meta.append(date);}
   const message=document.createElement('div');message.className='d-msg';message.textContent=item.msg;article.append(meta,message);fragment.append(article);
  }
  list.replaceChildren(fragment);if(resetScroll)list.scrollTop=0;
  newButton.textContent=copy('새 메모','New note');readButton.textContent=copy(`방명록 (${total})`,`Guestbook (${total})`);exportButton.textContent=copy('저장','Save');
  newButton.hidden=!owner();exportButton.hidden=!owner();win.querySelector('.memo-label').textContent=copy('메모','Memo');
  pageLabel.textContent=`${page+1} / ${pages}`;pageLabel.setAttribute('aria-label',copy(`${pages}페이지 중 ${page+1}페이지`,`Page ${page+1} of ${pages}`));
  for(const button of pager.querySelectorAll('button')){
   const action=button.dataset.page;button.textContent=copy({first:'처음',prev:'이전',next:'다음',last:'끝'}[action],{first:'First',prev:'Prev',next:'Next',last:'Last'}[action]);
   button.disabled=(action==='first'||action==='prev')?page===0:page===pages-1;
  }
  selectView(view);
 }
 pager.addEventListener('click',event=>{
  const button=event.target.closest('button[data-page]');if(!button||button.disabled)return;
  const last=Math.max(0,Math.ceil(total/PAGE_SIZE)-1);
  page=({first:0,prev:page-1,next:page+1,last})[button.dataset.page];render(true);
 });
 newButton.addEventListener('click',()=>{selectView('write');name.focus();});
 readButton.addEventListener('click',()=>{render();selectView('read');});
 memo.addEventListener('input',()=>{count.textContent=`${memo.value.length} / 240`;});
 form.addEventListener('submit',event=>{
  event.preventDefault();if(!owner())return;
  const item=clean({name:name.value,msg:memo.value,date:new Intl.DateTimeFormat(I18N.locale(),{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())});
  if(!item)return;const entries=load();entries.push(item);if(!save(entries))return;
  memo.value='';AudioSys.sfx('ding');page=Math.floor((allEntries().length-1)/PAGE_SIZE);render(true);selectView('read');
 });
 exportButton.addEventListener('click',async()=>{
  exportButton.disabled=true;
  try{const entries=allEntries();await saveGuestbookImage(entries.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE),page,Math.max(1,Math.ceil(entries.length/PAGE_SIZE)));}
  catch{toast(copy('이미지를 저장하지 못했어요. 다시 눌러주세요.','Could not save the image. Please try again.'));}
  finally{exportButton.disabled=false;}
 });
 const ui={
  async open(app){appRef=app;app.closeCurrent=()=>ui.close();initialize();page=0;view='read';I18N.apply(win);render(true);overlay.classList.remove('hidden');AudioSys.sfx('open');await loadArchive();render();},
  close(){overlay.classList.add('hidden');if(appRef)appRef.closeCurrent=()=>browserUI.close();AudioSys.sfx('close');},
  isOpen:()=>!overlay.classList.contains('hidden'),
  refreshLanguage(){I18N.apply(win);render();},
 };
 document.getElementById('diary-close').addEventListener('click',()=>ui.close());addEventListener('computer-language-change',()=>ui.refreshLanguage());
 // Another open tab can add a note; refresh the visible page without discarding its editor draft.
 addEventListener('storage',event=>{if(event.key===CONFIG.guestbookKey&&ui.isOpen())render();});
 return ui;
})();
