(()=>{
const L=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const fmt=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const mk=(t,txt,fn)=>{const b=document.createElement(t);b.textContent=txt;if(fn)b.onclick=fn;return b};
COL.rec='#ff5d6c';COL.focus='#c28bff';

/* tabs */
const body=$('#body'),chat=document.createElement('div');chat.className='pane on';chat.id='p-Chat';
[...body.children].forEach(c=>chat.append(c));body.append(chat);
const names=['Chat','Agents','Rec','Notes','Tasks','Focus'],tabs=document.createElement('div');tabs.id='tabs';body.prepend(tabs);
names.forEach(n=>{tabs.append(mk('button',n,()=>show(n)));if(n!=='Chat'){const p=document.createElement('div');p.className='pane';p.id='p-'+n;body.append(p)}});
const show=n=>{names.forEach(x=>$('#p-'+x).classList.toggle('on',x===n));if(n==='Focus')recap()};

/* audio helpers */
const micStream=()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
async function toF32(blob){const ac=new AudioContext({sampleRate:16000}),b=await ac.decodeAudioData(await blob.arrayBuffer());ac.close();return b.getChannelData(0)}
async function stt(blob){setMood('work','Transcribing…',0);try{const t=await window.api.transcribe(await toF32(blob));setMood('done','Transcribed',3000);return t}catch(e){setMood('alert','Transcription failed: '+e.message,8000);return''}}
window.api.onSttProgress(p=>{if(p.status==='progress')setMood('work','Downloading speech model '+Math.round(p.progress)+'% (first time only)',0)});
function recorder(stream){const ch=[],r=new MediaRecorder(stream);r.ondataavailable=e=>e.data.size&&ch.push(e.data);
 return{start:()=>r.start(1000),stop:()=>new Promise(res=>{r.onstop=()=>res(new Blob(ch,{type:'audio/webm'}));r.stop()})}}
const stop=ss=>ss.forEach(s=>s.getTracks().forEach(t=>t.stop()));

/* dictation button: click to talk, click again to insert text */
function dictBtn(target){let rec,st;const b=mk('button','🎤',async()=>{
  if(!rec){try{st=await micStream()}catch(e){return setMood('alert','Mic blocked: '+e.message,6000)}rec=recorder(st);rec.start();b.textContent='⏹';setMood('rec','Listening…',0)}
  else{const r=rec;rec=null;b.textContent='🎤';const blob=await r.stop();stop([st]);const t=await stt(blob);
   if(t){target.value+=(target.value&&!/\s$/.test(target.value)?' ':'')+t;target.dispatchEvent(new Event('input'))}}});
 b.title='Dictate (speech to text, runs locally)';return b}
$('#row').insertBefore(dictBtn($('#in')),$('#send'));

/* recording: mic + system sound */
const R=$('#p-Rec');
R.innerHTML=`<div class="row"><select id="src"><option value="both">Mic + system sound</option><option value="mic">Mic only</option><option value="sys">System sound only</option></select><button id="rb">⏺ Record</button><button id="of">Open folder</button></div><div class="hint">Use headphones for “Mic + system” so your mic doesn’t re-record the speakers. System sound capture works on Windows. Shortcut: Ctrl/Cmd+Shift+R.</div><div id="rl" class="list"></div>`;
let rc,streams=[],ac,tick,t0;
async function startRec(){
 const mode=$('#src').value;ac=new AudioContext();const d=ac.createMediaStreamDestination();streams=[];
 try{
  if(mode!=='sys'){const m=await micStream();streams.push(m);ac.createMediaStreamSource(m).connect(d)}
  if(mode!=='mic'){const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});streams.push(s);
   const a=s.getAudioTracks();if(!a.length)throw Error('No system audio available');
   ac.createMediaStreamSource(new MediaStream(a)).connect(d);s.getVideoTracks().forEach(t=>t.stop())}
 }catch(e){stop(streams);ac.close();return setMood('alert',e.message,6000)}
 rc=recorder(d.stream);rc.start();t0=Date.now();$('#rb').textContent='⏹ Stop';
 tick=setInterval(()=>setMood('rec','● REC '+fmt(Date.now()-t0),0),500);
}
async function stopRec(){
 clearInterval(tick);const blob=await rc.stop();stop(streams);ac.close();rc=null;$('#rb').textContent='⏺ Record';
 const name=await window.api.saveRec(await blob.arrayBuffer());setMood('done','Saved '+name,5000);logEv('rec');item(name,blob);
}
$('#rb').onclick=()=>rc?stopRec():startRec();
$('#of').onclick=()=>window.api.openRecs();
function item(name,blob){
 const d=document.createElement('div');d.className='it';const s=mk('span',name),out=document.createElement('div');out.className='tx';
 d.append(s,mk('button','Transcribe',async()=>{const t=await stt(blob);if(!t)return;out.textContent=t;
  out.append(document.createElement('br'),mk('button','Copy',()=>navigator.clipboard.writeText(t)),mk('button','To notes',()=>addNote(t)))}),out);
 $('#rl').prepend(d);
}
window.api.onToggleRec(()=>{if(!open)setOpen(true);show('Rec');$('#rb').click()});

/* notes */
const N=$('#p-Notes');
N.innerHTML=`<div class="row"><select id="ns"></select><button id="nn">New</button><button id="nd">Delete</button></div><textarea id="nt" placeholder="Write or dictate…"></textarea>`;
let notes=L('notes',[{t:''}]),ni=0;
const title=t=>(t.split('\n')[0]||'Untitled').slice(0,40);
function nr(){$('#ns').innerHTML='';notes.forEach((n,i)=>$('#ns').add(new Option(title(n.t),i)));$('#ns').value=ni;$('#nt').value=notes[ni].t}
$('#ns').onchange=e=>{ni=+e.target.value;$('#nt').value=notes[ni].t};
$('#nt').oninput=()=>{notes[ni].t=$('#nt').value;S('notes',notes);$('#ns').options[ni].text=title($('#nt').value)};
$('#nn').onclick=()=>{notes.unshift({t:''});ni=0;S('notes',notes);nr()};
$('#nd').onclick=()=>{notes.splice(ni,1);if(!notes.length)notes=[{t:''}];ni=0;S('notes',notes);nr()};
N.firstChild.append(dictBtn($('#nt')));nr();
function addNote(t){notes.unshift({t});ni=0;S('notes',notes);nr();show('Notes')}

/* tasks */
const T=$('#p-Tasks');
T.innerHTML=`<div class="row"><input id="ti" placeholder="Add a task… (or dictate)" style="flex:1;padding:6px"><button id="ta">Add</button></div><div id="tl" class="list"></div>`;
let tasks=L('tasks',[]);
function tr(){$('#tl').innerHTML='';tasks.forEach((k,i)=>{const d=document.createElement('label'),c=document.createElement('input');d.className='it';c.type='checkbox';c.checked=k.d;
 c.onchange=()=>{if(c.checked)logEv('task');k.d=c.checked;S('tasks',tasks);tr()};const s=mk('span',k.t);if(k.d)s.style.textDecoration='line-through';
 d.append(c,s,mk('button','✕',()=>{tasks.splice(i,1);S('tasks',tasks);tr()}));$('#tl').append(d)})}
const addT=()=>{const v=$('#ti').value.trim();if(v){tasks.unshift({t:v,d:false});$('#ti').value='';S('tasks',tasks);tr()}};
$('#ta').onclick=addT;$('#ti').onkeydown=e=>e.key==='Enter'&&addT();T.firstChild.append(dictBtn($('#ti')));tr();

/* focus timer */
const F=$('#p-Focus');
F.innerHTML=`<div class="row"><select id="fm"><option value="25">25 min focus</option><option value="50">50 min focus</option><option value="5">5 min break</option></select><button id="fb">Start</button></div><div id="fd">25:00</div><div id="rc" class="hint" style="text-align:center"></div>`;
let fe=0,ft=0;
$('#fm').onchange=()=>{if(!ft)$('#fd').textContent=$('#fm').value+':00'};
$('#fb').onclick=()=>{
 if(ft){clearInterval(ft);ft=0;$('#fb').textContent='Start';$('#fd').textContent=$('#fm').value+':00';return setMood('idle','Ready.')}
 fe=Date.now()+$('#fm').value*60000;$('#fb').textContent='Stop';
 ft=setInterval(()=>{const r=fe-Date.now();
  if(r<=0){clearInterval(ft);ft=0;$('#fb').textContent='Start';setMood('done','Time is up!',0);logEv('focus',+$('#fm').value);new Notification('Cotton Candy',{body:'Time is up!'});return}
  $('#fd').textContent=fmt(r);if(!rc&&['idle','focus','done'].includes(mood))setMood('focus','Focus '+fmt(r),0)},500);
};
/* ---- tailored assistant style (customer support, Philips) ---- */
const DEF_SYS=`You are Cotton Candy, a writing and productivity assistant for a Philips consumer-electronics customer support specialist who handles escalations, service requests, warranty and replacement cases, refund and delivery issues, VOC and internal escalation notes.
Rules:
- Answer directly. No preamble, no explanations unless asked. Default to short, ready-to-send output.
- Tone: professional, empathetic, solution-focused, non-confrontational, ownership-driven. Apologise for delays where relevant and reassure the customer with a clear next step.
- Grammar fixes: keep the original meaning and intent, return only the corrected text.
- Emails and replies: give a subject line, greeting, short body and sign-off. Use [brackets] for unknown facts. Never invent order numbers, dates, policies or refund timelines.
- Escalation notes: use short labelled lines (Issue, Customer, Order/Serial, Actions taken, Request, Next step).
- If the user says "in short", reply in 2-3 lines.
- Tech or automation questions (Power Automate, Power Apps, Excel, Office Scripts, Windows, Outlook, PC hardware): concise numbered steps.
- Plain text only, no markdown symbols, so it can be pasted straight into Outlook or chat.`;
window.SYS=()=>localStorage.getItem('sys')||DEF_SYS;
const st=document.createElement('style');
st.textContent='#chips{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:6px}#chips button{font-size:12px;padding:2px 9px;border-radius:99px}#sysbox{display:none;width:100%;height:170px;padding:8px;margin-bottom:6px;resize:none}';
document.head.append(st);
const chips=document.createElement('div');chips.id='chips';
const box=document.createElement('textarea');box.id='sysbox';box.value=SYS();
[['Fix grammar','Fix grammar, keep my meaning:\n'],['Email','Draft an email: '],['Reply','Draft a customer reply to this:\n'],['Escalation','Write an internal escalation note for: '],['VOC','Draft a VOC response to this:\n'],['Subject lines','Give 5 subject lines for: '],['Shorter','Make this shorter:\n']]
 .forEach(([l,t])=>chips.append(mk('button',l,()=>{$('#in').value=t;$('#in').focus()})));
chips.append(mk('button','⚙ Style',()=>{box.style.display=box.style.display==='block'?'none':'block'}));
chips.append(mk('button','Save style',()=>{localStorage.setItem('sys',box.value);setMood('done','Style saved',2500)}));
chips.append(mk('button','Reset style',()=>{localStorage.removeItem('sys');box.value=DEF_SYS;setMood('done','Style reset',2500)}));
$('#p-Chat').prepend(box);$('#p-Chat').prepend(chips);
window.api.onDone(()=>{const m=[...document.querySelectorAll('.m.a')].pop();if(m&&m.textContent)m.append(document.createElement('br'),mk('button','Copy',e=>{navigator.clipboard.writeText(m.firstChild.textContent);e.target.textContent='Copied'}))});

/* ---- auto-minimise to a slim bar after 15 s of inactivity ---- */
const IDLE_MS=15000;let slim=false,last=Date.now(),dw;
const sb=document.createElement('div');sb.id='slimbar';sb.title='Cotton Candy – hover or click to open';$('#isl').append(sb);
const st2=document.createElement('style');
st2.textContent='#slimbar{display:none;height:100%;background:linear-gradient(90deg,var(--c),#ff9ad5,var(--c));border-radius:0 0 12px 12px;cursor:pointer}body.slim #slimbar{display:block}body.slim #bar,body.slim #body{display:none!important}body.slim #isl{background:transparent}body.slim.pulse #slimbar{animation:pl 1s ease infinite alternate}@keyframes pl{to{opacity:.3}}@media (prefers-reduced-motion:reduce){body.slim.pulse #slimbar{animation:none}}';
document.head.append(st2);
const touch=()=>{last=Date.now()};
['mousemove','mousedown','keydown','wheel','touchstart'].forEach(e=>document.addEventListener(e,touch,{passive:true}));
function goSlim(){slim=true;setOpen(false);document.body.classList.add('slim');window.api.resize(360,14)}
function unslim(resize){if(!slim)return;slim=false;document.body.classList.remove('slim','pulse');touch();if(resize)window.api.resize(300,56)}
sb.onmouseenter=()=>{dw=setTimeout(()=>unslim(true),350)};sb.onmouseleave=()=>clearTimeout(dw);sb.onclick=()=>unslim(true);
setInterval(()=>{
 document.body.classList.toggle('pulse',slim&&(mood==='alert'||mood==='rec'));
 if(slim)return;
 if(busy||(open&&mood==='rec')||$('#ap').children.length)return touch();
 if(Date.now()-last>IDLE_MS)goSlim();
},1000);
window.api.onToggle(()=>unslim(false));window.api.onToggleRec(()=>unslim(false));
window.api.onAgent(e=>{const ev=e.hook_event_name||e.event;if(ev==='Notification'||ev==='Stop')unslim(true)});

/* ---- Agents tab: live sessions + approvals from the island (Claude Code hooks) ---- */
const A=$('#p-Agents');
A.innerHTML=`<div id="ap" class="list" style="flex:none"></div><div id="as" class="list"></div><div class="row"><span class="hint">Outfit</span><select id="fit"><option value="none">None</option><option value="bow">Bow</option><option value="hat">Party hat</option><option value="glasses">Glasses</option><option value="crown">Crown</option></select></div><div class="hint">Shows Claude Code and other agents that post to 127.0.0.1:47821. Setup is in the README.</div>`;
const st3=document.createElement('style');st3.textContent='.ap{border-color:#ffa63e}';document.head.append(st3);
const sess={},DOT={work:'#3ea6ff',alert:'#ffa63e',done:'#3ddc84'};
const short=o=>{if(!o)return'';const v=o.command||o.file_path||o.path||o.pattern||o.url||o.description||JSON.stringify(o);return String(v).replace(/\s+/g,' ').slice(0,90)};
function ar(){const l=$('#as');l.innerHTML='';
 Object.values(sess).filter(s=>Date.now()-s.ts<36e5).sort((a,b)=>b.ts-a.ts).forEach(s=>{
  const d=document.createElement('div'),dot=mk('span','●');d.className='it';dot.style.cssText='flex:none;color:'+(DOT[s.st]||'#888');
  d.append(dot,mk('b',s.agent+' · '+s.proj),mk('span',s.txt));l.append(d)})}
window.api.onAgent(e=>{
 const ev=e.hook_event_name||e.event||'',k=e.session_id||e.agent||'agent',s=sess[k]=sess[k]||{};
 s.agent=e.agent||'Claude Code';s.proj=(e.cwd||'').split(/[\\/]/).pop()||s.proj||'session';s.ts=Date.now();
 if(['PreToolUse','PostToolUse','UserPromptSubmit'].includes(ev)){s.st='work';s.txt=(e.tool_name||'thinking')+(e.tool_input?': '+short(e.tool_input):'')}
 else if(ev==='Notification'){s.st='alert';s.txt=e.message||'needs you'}
 else if(['Stop','SubagentStop','SessionEnd'].includes(ev)){s.st='done';s.txt='finished'}
 ar()});
window.api.onApproval(a=>{
 const d=document.createElement('div');d.className='it ap';
 const fin=v=>{window.api.decide(a.id,v);d.remove();if(!$('#ap').children.length)setMood('idle','Ready.')};
 d.append(mk('b','Approve '+a.tool_name+'?'),mk('span',short(a.tool_input)),mk('button','Allow',()=>fin('allow')),mk('button','Deny',()=>fin('deny')),mk('button','Ask in terminal',()=>fin('ask')));
 $('#ap').append(d);unslim(false);if(!open)setOpen(true);show('Agents');setMood('alert','Approve '+a.tool_name+'?',0)});
setInterval(ar,30000);

/* ---- Pip outfits ---- */
const FIT={none:'',bow:'<circle cx="11" cy="8" r="3.2" fill="#ff7ab8"/><circle cx="19" cy="8" r="3.2" fill="#ff7ab8"/><circle cx="15" cy="8" r="1.6" fill="#d94b8c"/>',hat:'<polygon points="20,0 13,9 27,9" fill="#ffd166"/><circle cx="20" cy="1.5" r="1.6" fill="#ff7ab8"/>',glasses:'<circle cx="14" cy="19" r="7" fill="none" stroke="#111" stroke-width="1.6"/><circle cx="26" cy="19" r="7" fill="none" stroke="#111" stroke-width="1.6"/><path d="M21 19h-2" stroke="#111" stroke-width="1.6"/>',crown:'<polygon points="12,9 14,2 20,7 26,2 28,9" fill="#ffd166"/>'};
const fg=document.createElementNS('http://www.w3.org/2000/svg','g');$('#pip').append(fg);
const setFit=v=>{fg.innerHTML=FIT[v]||'';localStorage.setItem('fit',v)};
$('#fit').value=localStorage.getItem('fit')||'none';setFit($('#fit').value);$('#fit').onchange=e=>setFit(e.target.value);

/* ---- 7-day recap ---- */
function logEv(k,m){const l=L('log',[]);l.push({k,m,t:Date.now()});S('log',l.slice(-600))}
function recap(){const w=L('log',[]).filter(x=>Date.now()-x.t<6048e5),c=k=>w.filter(x=>x.k===k);
 $('#rc').textContent=`Last 7 days: ${c('focus').reduce((a,x)=>a+(x.m||0),0)} focus min · ${c('task').length} tasks done · ${c('rec').length} recordings · ${notes.length} notes`}
recap();
})();
