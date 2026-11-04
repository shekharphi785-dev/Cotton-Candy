(()=>{
const L=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const fmt=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const mk=(t,txt,fn)=>{const b=document.createElement(t);b.textContent=txt;if(fn)b.onclick=fn;return b};
COL.rec='#ff5d6c';COL.focus='#c28bff';

/* tabs */
const body=$('#body'),chat=document.createElement('div');chat.className='pane on';chat.id='p-Chat';
[...body.children].forEach(c=>chat.append(c));body.append(chat);
const names=['Chat','Rec','Notes','Tasks','Focus'],tabs=document.createElement('div');tabs.id='tabs';body.prepend(tabs);
names.forEach(n=>{tabs.append(mk('button',n,()=>show(n)));if(n!=='Chat'){const p=document.createElement('div');p.className='pane';p.id='p-'+n;body.append(p)}});
const show=n=>names.forEach(x=>$('#p-'+x).classList.toggle('on',x===n));

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
 const name=await window.api.saveRec(await blob.arrayBuffer());setMood('done','Saved '+name,5000);item(name,blob);
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
 c.onchange=()=>{k.d=c.checked;S('tasks',tasks);tr()};const s=mk('span',k.t);if(k.d)s.style.textDecoration='line-through';
 d.append(c,s,mk('button','✕',()=>{tasks.splice(i,1);S('tasks',tasks);tr()}));$('#tl').append(d)})}
const addT=()=>{const v=$('#ti').value.trim();if(v){tasks.unshift({t:v,d:false});$('#ti').value='';S('tasks',tasks);tr()}};
$('#ta').onclick=addT;$('#ti').onkeydown=e=>e.key==='Enter'&&addT();T.firstChild.append(dictBtn($('#ti')));tr();

/* focus timer */
const F=$('#p-Focus');
F.innerHTML=`<div class="row"><select id="fm"><option value="25">25 min focus</option><option value="50">50 min focus</option><option value="5">5 min break</option></select><button id="fb">Start</button></div><div id="fd">25:00</div>`;
let fe=0,ft=0;
$('#fm').onchange=()=>{if(!ft)$('#fd').textContent=$('#fm').value+':00'};
$('#fb').onclick=()=>{
 if(ft){clearInterval(ft);ft=0;$('#fb').textContent='Start';$('#fd').textContent=$('#fm').value+':00';return setMood('idle','Ready.')}
 fe=Date.now()+$('#fm').value*60000;$('#fb').textContent='Stop';
 ft=setInterval(()=>{const r=fe-Date.now();
  if(r<=0){clearInterval(ft);ft=0;$('#fb').textContent='Start';setMood('done','Time is up!',0);new Notification('Cotton Candy',{body:'Time is up!'});return}
  $('#fd').textContent=fmt(r);if(!rc&&['idle','focus','done'].includes(mood))setMood('focus','Focus '+fmt(r),0)},500);
};
})();
