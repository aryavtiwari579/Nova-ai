const KEY = 'nova-ai-chats-v1';
const $ = (s) => document.querySelector(s);
const listEl = $('#chatList'), conversation = $('#conversation'), input = $('#messageInput');
let chats = loadChats(), activeId = chats[0]?.id || null, busy = false, aborter = null, toastTimer;
const uid = () => crypto.randomUUID();
function loadChats() { try { const x = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(x) ? x : []; } catch { return []; } }
function save() { localStorage.setItem(KEY, JSON.stringify(chats)); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function inline(s) {
  let x = esc(s);
  x = x.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  x = x.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  x = x.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  return x;
}
function tableCells(line) {
  const text=line.trim();
  if(!text.includes('|')) return null;
  const row=(text.startsWith('|')?text.slice(1):text).replace(/\|\s*$/,'');
  const cells=[]; let cell='';
  for(let i=0;i<row.length;i++){
    if(row[i]==='\\'&&row[i+1]==='|'){cell+='|';i++;}
    else if(row[i]==='|'){cells.push(cell.trim());cell='';}
    else cell+=row[i];
  }
  cells.push(cell.trim());
  return cells;
}
function tableAlignments(line) {
  const cells=tableCells(line);
  if(!cells||!cells.length||!cells.every(cell=>/^:?-{3,}:?$/.test(cell.replace(/\s/g,'')))) return null;
  return cells.map(cell=>cell.startsWith(':')?(cell.endsWith(':')?'center':'left'):(cell.endsWith(':')?'right':'left'));
}
function markdown(raw) {
  const parts = raw.split(/```([\w-]*)\n?([\s\S]*?)```/g); let html = '';
  for (let i=0; i<parts.length; i++) {
    if (i%3===1) { const code=parts[i+1]||''; html += `<div class="code-block"><div class="code-head"><span>${esc(parts[i]||'code')}</span><button data-copy="${encodeURIComponent(code)}">Copy code</button></div><pre><code>${esc(code)}</code></pre></div>`; i+=2; continue; }
    const lines=parts[i].split('\n'); let inList=false, listType='', para=[];
    const flush=()=>{ if(para.length){html+=`<p>${para.map(inline).join('<br>')}</p>`;para=[];} };
    const closeList=()=>{if(inList){html+=`</${listType}>`;inList=false;}};
    for (let i=0; i<lines.length; i++) {
      const line=lines[i], h=line.match(/^(#{1,3})\s+(.+)/), li=line.match(/^\s*([-*]|\d+\.)\s+(.+)/);
      const alignments=i+1<lines.length?tableAlignments(lines[i+1]):null;
      const header=alignments?tableCells(line):null;
      if(header){
        flush();closeList();
        const cellHtml=(row,tag)=>`<tr>${header.map((_,col)=>`<${tag} class="align-${alignments[col]||'left'}">${inline(row[col]||'')}</${tag}>`).join('')}</tr>`;
        html+='<div class="response-table-wrap"><table class="response-table"><thead>'+cellHtml(header,'th')+'</thead><tbody>';
        let rowIndex=i+2;
        while(rowIndex<lines.length&&lines[rowIndex].trim()){
          const row=tableCells(lines[rowIndex]);
          if(!row)break;
          html+=cellHtml(row,'td');rowIndex++;
        }
        html+='</tbody></table></div>';
        i=rowIndex-1;
      }
      else if(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)){flush();closeList();html+='<hr>';}
      else if(h){flush();closeList();const n=h[1].length;html+=`<h${n}>${inline(h[2])}</h${n}>`;}
      else if(li){flush();const type=/\d/.test(li[1])?'ol':'ul';if(!inList||type!==listType){closeList();html+=`<${type}>`;listType=type;inList=true;}html+=`<li>${inline(li[2])}</li>`;}
      else if(!line.trim()){flush();closeList();}
      else {closeList();para.push(line);}
    }
    flush();closeList();
  }
  return html;
}
function active(){return chats.find(c=>c.id===activeId);}
function titleFor(text){return text.trim().replace(/\s+/g,' ').slice(0,38)+(text.trim().length>38?'…':'');}
function newChat(){const c={id:uid(),title:'New conversation',messages:[],updated:Date.now()};chats.unshift(c);activeId=c.id;save();render();input.focus();}
function renderList(){const q=$('#searchChats').value.toLowerCase();const filtered=chats.filter(c=>(c.title+' '+c.messages.map(m=>m.content).join(' ')).toLowerCase().includes(q));$('#chatCount').textContent=chats.length;listEl.innerHTML=filtered.length?filtered.map(c=>`<div class="chat-row ${c.id===activeId?'selected':''}" data-id="${c.id}"><button class="chat-open"><span class="chat-glyph">◌</span><span class="chat-title">${esc(c.title)}</span></button><button class="chat-more" aria-label="Conversation options">···</button></div>`).join(''):`<div class="list-empty">${q?'No matches':'Your chats will appear here'}</div>`;}
function welcome(){return `<div class="welcome"><div class="welcome-symbol">✦</div><div class="eyebrow">A LITTLE MORE CLARITY, A LITTLE MORE MAGIC</div><h1>Good ideas start<br>with <span>a conversation.</span></h1><p>I'm Nova, your AI thinking partner. What would you like to explore today?</p><div class="welcome-note"><span>✧</span> Ask anything. Build something. Find your next idea.</div></div>`;}
function renderMessages(){const c=active(); if(!c||!c.messages.length){conversation.innerHTML=welcome();$('#suggestions').hidden=false;return;}$('#suggestions').hidden=true;conversation.innerHTML=`<div class="message-stack">${c.messages.map((m,i)=>`<article class="message ${m.role}"><div class="message-avatar ${m.role==='assistant'?'nova-avatar':''}">${m.role==='assistant'?'✦':'Y'}</div><div class="message-main"><div class="message-meta"><strong>${m.role==='assistant'?'Nova':'You'}</strong><time>${new Date(m.time).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</time></div><div class="message-content">${m.role==='assistant'?markdown(m.content):esc(m.content).replace(/\n/g,'<br>')}</div>${m.role==='assistant'?`<div class="message-actions"><button data-action="copy" data-index="${i}">▢ &nbsp;Copy</button>${i===c.messages.length-1?'<button data-action="regen">↻ &nbsp;Regenerate</button>':''}</div>`:''}</div></article>`).join('')}${busy?'<article class="message assistant"><div class="message-avatar nova-avatar">✦</div><div class="message-main"><div class="message-meta"><strong>Nova</strong><span class="thinking-label">Thinking</span></div><div class="typing"><i></i><i></i><i></i></div></div></article>':''}</div>`;conversation.scrollTop=conversation.scrollHeight;}
function render(){renderList();renderMessages();}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800);}
async function send(text, regenerate=false){if(busy)return;const c=active()||(()=>{newChat();return active();})();if(regenerate){if(c.messages.at(-1)?.role==='assistant')c.messages.pop();}else{if(!text.trim())return;c.messages.push({role:'user',content:text.trim(),time:Date.now()});if(c.messages.length===1)c.title=titleFor(text);input.value='';resize();}
  c.updated=Date.now();save();busy=true;aborter=new AbortController();$('#stopButton').hidden=false;render();
  try{const {askNova}=await import('./api.js');const answer=await askNova(c.messages.map(({role,content})=>({role,content})),aborter.signal);c.messages.push({role:'assistant',content:answer,time:Date.now()});}
  catch(e){if(e.message==='Generation stopped.')toast('Generation stopped.');else{c.messages.push({role:'assistant',content:`I couldn't complete that request. ${e.message}`,time:Date.now(),error:true});toast(e.message);}}
  finally{busy=false;aborter=null;$('#stopButton').hidden=true;c.updated=Date.now();save();render();}
}
function resize(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,150)+'px';}
$('#composer').addEventListener('submit',e=>{e.preventDefault();send(input.value);});
input.addEventListener('input',resize);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#composer').requestSubmit();}});
$('#newChat').onclick=newChat;$('#searchChats').addEventListener('input',renderList);
listEl.addEventListener('click',e=>{const row=e.target.closest('.chat-row');if(!row)return;const c=chats.find(x=>x.id===row.dataset.id);if(e.target.closest('.chat-more')){const action=prompt('Type rename or delete');if(action==='delete'){chats=chats.filter(x=>x.id!==c.id);if(activeId===c.id)activeId=chats[0]?.id||null;save();render();}else if(action==='rename'){const name=prompt('Conversation name',c.title);if(name?.trim()){c.title=name.trim();save();renderList();}}return;}activeId=c.id;render();$('#sidebar').classList.remove('open');});
conversation.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.copy!==undefined){await navigator.clipboard.writeText(decodeURIComponent(b.dataset.copy));toast('Code copied.');return;}const c=active();if(b.dataset.action==='copy'){await navigator.clipboard.writeText(c.messages[+b.dataset.index].content);toast('Response copied.');}if(b.dataset.action==='regen'){if(c.messages.length>1&&c.messages.at(-2).role==='user')await send('',true);else toast('There is no question to regenerate.');}});
$('#stopButton').onclick=()=>aborter?.abort();
$('#clearChat').onclick=()=>{const c=active();if(!c)return;c.messages=[];c.title='New conversation';save();render();};
$('#exportChat').onclick=()=>{const c=active();if(!c?.messages.length){toast('This conversation is empty.');return;}const data=c.messages.map(m=>`${m.role==='user'?'You':'Nova'}:\n${m.content}`).join('\n\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'text/plain'}));a.download=`${c.title.replace(/[^a-z0-9]/gi,'-').toLowerCase()}.txt`;a.click();URL.revokeObjectURL(a.href);};
$('#themeToggle').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('nova-theme',document.body.classList.contains('dark')?'dark':'light');};
if(localStorage.getItem('nova-theme')==='dark')document.body.classList.add('dark');
$('#suggestions').addEventListener('click',e=>{const b=e.target.closest('button');if(b){input.value=b.textContent.replace(/^[^A-Za-z]+/,'').trim();input.focus();resize();}});
$('#mobileMenu').onclick=()=>$('#sidebar').classList.toggle('open');
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();newChat();}});
render();
