/* =====================================================================
   INDUSTRIAL DATING — inspection mode (swipe)
   Right = certify, left = red-tag. Uses the same anonymous voter_id as
   the roster page, so a swipe here and a click there are the same vote.
   ===================================================================== */

const REST = CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
const FN = CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1';
const API_HEADERS = {
  apikey: CONFIG.SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
};

/* Founding crew — key/name/photo/meta/bio only (specs live on the roster). */
const CREW = [
  { key: 'johnny-the-drill-sims', name: 'Johnny "The Drill" Sims', photo: 'assets/img/johnny.jpg', meta: 'Site foreman + mountain safety · Won\'t discuss it', bio: 'They said I couldn\'t put a spark plug in a relationship. Twelve engines later, still married to the job.' },
  { key: 'jye-butterfingers-beech', name: 'Jye "Butterfingers" Beech', photo: 'assets/img/jye.jpg', meta: 'Carpenter\'s mate · Son of a Beech', bio: 'Owns 40 clamps and still cannot hold on to anyone. Never drops anything. Just almost drops everything, constantly.' },
  { key: 'dave-the-supervisor-schenkhisenhowsener', name: 'Dave "The Supervisor" Schenkhisenhowsener', photo: 'assets/img/dave.jpg', meta: 'Level 1.9 rope access tech · self-appointed', bio: 'A title he gave himself and nobody has bothered to revoke. Very good at pushing rope on and off the mountain.' },
  { key: 'andrew-second-thoughts-mcnabb', name: 'Andrew "Second Thoughts" McNabb', photo: 'assets/img/andrew.jpg', meta: 'Safety Captain — or whatever, he doesn\'t care I guess', bio: 'A fully air-pneumatic suggestion box: enormous output, precisely zero follow-through.' },
  { key: 'ali-andro-castro', name: 'Ali "Andro" Castro', photo: 'assets/img/ali.jpg', meta: 'Level 8 carpenter · battery mule', bio: 'Hauls everyone else\'s dead packs uphill and still has charge to spare. Loves to drill holes and screw anything he cannot nail.' },
  { key: 'robbie-one-done-chmelyker', name: 'Robbie "One & Done" Chmelyker', photo: 'assets/img/robbie.jpg', meta: 'Rope access tech · no protection required', bio: 'Strictly a one-and-done encounter who always has a very important meeting to run to immediately afterward. He will call you.' },
  { key: 'kai-the-algorithm-mcgrady', name: 'Kai "The Algorithm" McGrady', photo: 'assets/img/kai.jpg', meta: 'Rope access tech · content creator', bio: 'Will scale a rock, but only if the lighting is good. Load-tested primarily by the algorithm.' },
  { key: 'walker-the-talker-ragpuller', name: 'Walker "The Talker" Ragpuller', photo: 'assets/img/walker.jpg', meta: 'Rag puller · rope access tech', bio: 'Pulls rope. Pulls focus. Pulls up before anyone asks a follow-up question. Free mustache rides, requested or otherwise.' },
];

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function initialsFrom(name){var p=String(name||'').trim().split(/\s+/).map(function(w){return w[0]||'';});return (p.join('').slice(0,2).toUpperCase())||'??';}
function myVotes(){ try{return JSON.parse(localStorage.getItem('id_votes'))||{};}catch(e){return {};} }
function setVote(key,vote){ var v=myVotes(); if(vote) v[key]=vote; else delete v[key]; localStorage.setItem('id_votes',JSON.stringify(v)); }
function voterId(){
  var v=localStorage.getItem('id_voter');
  if(!v){
    v=(crypto&&crypto.randomUUID)?crypto.randomUUID()
      :'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});
    localStorage.setItem('id_voter',v);
  }
  return v;
}
function sendVote(key,vote){
  fetch(FN+'/vote',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},API_HEADERS),
    body:JSON.stringify({member_key:key,vote:vote,voter_id:voterId()})
  }).catch(function(e){ console.warn('Vote not recorded:',e.message); });
}

const deck = document.getElementById('deck');
let queue = [];

async function loadQueue(){
  var units = CREW.slice();
  try{
    const res = await fetch(REST+'/industrial_dating_members?select=id,name,title,bio,photo&order=created_at.desc',{headers:API_HEADERS});
    if(res.ok){
      (await res.json()).forEach(function(m){
        units.push({ key:'u-'+m.id, name:m.name, photo:m.photo||'', meta:m.title||'Unspecified unit', bio:m.bio||'' });
      });
    }
  }catch(e){ /* founding crew only */ }
  // Un-inspected units first, then ones you've already judged (re-swipe = change vote)
  var votes=myVotes();
  units.sort(function(a,b){ return (votes[a.key]?1:0)-(votes[b.key]?1:0) || Math.random()-0.5; });
  queue = units;
  render();
}

function render(){
  deck.innerHTML='';
  if(!queue.length){ return showDone(); }
  // Bottom-most cards first in DOM; top card last so it stacks on top
  queue.slice(0,3).reverse().forEach(function(u,i,arr){
    deck.appendChild(buildCard(u, i===arr.length-1));
  });
}

function buildCard(u, top){
  var el=document.createElement('div');
  el.className='scard';
  var photo=u.photo
    ? '<img src="'+esc(u.photo)+'" alt="'+esc(u.name)+'" draggable="false">'
    : '<div class="noimg">'+esc(initialsFrom(u.name))+'</div>';
  el.innerHTML=
    '<div class="sphoto">'+photo+
      '<div class="sstamp cert">Certified</div>'+
      '<div class="sstamp tag">Red-tagged</div>'+
    '</div>'+
    '<div class="sbody">'+
      '<div class="sname">'+esc(u.name)+'</div>'+
      '<div class="smeta">'+esc(u.meta)+(myVotes()[u.key]?' · previously '+(myVotes()[u.key]==='certify'?'certified ✔':'red-tagged ⚠'):'')+'</div>'+
      '<p class="sbio">“'+esc(u.bio)+'”</p>'+
    '</div>';
  if(top) attachDrag(el,u);
  return el;
}

function attachDrag(el,u){
  var startX=0, dx=0, dragging=false;
  el.addEventListener('pointerdown',function(e){
    dragging=true; startX=e.clientX; el.setPointerCapture(e.pointerId);
    el.style.transition='none';
  });
  el.addEventListener('pointermove',function(e){
    if(!dragging) return;
    dx=e.clientX-startX;
    el.style.transform='translateX('+dx+'px) rotate('+(dx/18)+'deg)';
    el.querySelector('.sstamp.cert').style.opacity=Math.max(0,Math.min(1,dx/80));
    el.querySelector('.sstamp.tag').style.opacity=Math.max(0,Math.min(1,-dx/80));
  });
  function release(){
    if(!dragging) return;
    dragging=false;
    if(dx>90) fly(el,u,'certify');
    else if(dx<-90) fly(el,u,'redtag');
    else{
      el.style.transition='transform .2s ease';
      el.style.transform='';
      el.querySelectorAll('.sstamp').forEach(function(s){s.style.opacity=0;});
    }
    dx=0;
  }
  el.addEventListener('pointerup',release);
  el.addEventListener('pointercancel',release);
}

function fly(el,u,vote){
  var dir=vote==='certify'?1:-1;
  el.style.transition='transform .3s ease, opacity .3s ease';
  el.style.transform='translateX('+(dir*600)+'px) rotate('+(dir*30)+'deg)';
  el.style.opacity='0';
  setVote(u.key,vote);
  sendVote(u.key,vote);
  setTimeout(function(){ queue.shift(); render(); },250);
}

function judgeTop(vote){
  if(!queue.length) return;
  var top=deck.querySelector('.scard:last-child');
  if(top) fly(top,queue[0],vote);
}
function skipTop(){
  if(queue.length<2){ queue.shift(); render(); return; }
  queue.push(queue.shift());
  render();
}

function showDone(){
  deck.innerHTML=
    '<div class="sdone">'+
      '<span class="bigstamp">Site inspected</span>'+
      '<p>// ALL UNITS PROCESSED<br>// FINDINGS FILED WITH THE COMMITTEE<br>// GO DO SOME ACTUAL WORK</p>'+
      '<a href="index.html" class="btn btn-y">View the results</a>'+
    '</div>';
}

document.getElementById('btn-cert').addEventListener('click',function(){judgeTop('certify');});
document.getElementById('btn-tag').addEventListener('click',function(){judgeTop('redtag');});
document.getElementById('btn-skip').addEventListener('click',skipTop);

loadQueue();
