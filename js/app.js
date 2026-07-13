/* =====================================================================
   INDUSTRIAL DATING — roster + voting
   - Renders the founding crew (hardcoded below) immediately.
   - Fetches approved, team-submitted units from Supabase and slots
     them in at the top of the roster.
   - Lets visitors CERTIFY or RED-TAG any unit (one vote per unit,
     per browser — enforced with localStorage, which is honor-system
     security, which is on-brand for this crew).
   ===================================================================== */

const REST = CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
const FN = CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1';
const API_HEADERS = {
  apikey: CONFIG.SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
};

/* Registry of every unit on the page (key -> display info) — feeds the
   leaderboard names and the Load Match dropdowns. */
const UNITS = {
  'johnny-the-drill-sims': { name: 'Johnny "The Drill" Sims' }
};

/* ---- The founding bench ---- */
const crew = [
  {n:"Jye \"Butterfingers\" Beech", r:"Carpenter's mate", b:'Carpenter\'s mate. Measures twice, commits zero times. Great with his hands on the clock, tragic with them off it. Can frame a whole house but not a single sentence about his feelings. Owns 40 clamps and still cannot hold on to anyone. Never drops anything. Just almost drops everything, constantly, all day long. Do not believe him when he says he has a Beech bod.', t:["Great with his hands","Almost","Son of a Beech"], spec:[{l:"Grip retention",v:"LOW",p:20,hi:1},{l:"Commitment",v:"4%",p:4},{l:"Clamps owned",v:"MAX",p:100},{l:"Near-drops/hr",v:"HIGH",p:88,hi:1}], p:"assets/img/jye.jpg"},
  {n:"Dave \"The Supervisor\" Schenkhisenhowsener", r:"Level 1.9 rope access tech · unofficial supervisor", b:'Goes by Dave, because nobody can spell the rest. A level 1.9 rope access tech, which is not a real certification level, which tells you plenty about the rest of him. The crew pseudo, entirely unofficial supervisor: a title he gave himself and nobody has bothered to revoke. Very good at pushing rope on and off the mountain. Slightly taller than Jye, and mentions it.', t:["Level 1.9","Self-appointed supervisor","Pushes rope uphill"], spec:[{l:"Rope throughput",v:"HIGH",p:92,hi:1},{l:"Cert validity",v:"1.9",p:19},{l:"Authority (self-granted)",v:"MAX",p:100,hi:1},{l:"Surname spelled right",v:"8%",p:8}], p:"assets/img/dave.jpg"},
  {n:"Andrew \"Second Thoughts\" McNabb", r:"Safety Captain — or whatever, he doesn't care I guess", b:'Roughly twice the height of Jye and Dave combined. Always has a suggestion. Always takes it back about four seconds later. A fully air-pneumatic suggestion box: enormous output, precisely zero follow-through. Nominated for a safety award every single quarter despite never once being observed committing to anything. Also a self-described sub-Alpine escort, which he maintains is strictly a mountain-safety credential.', t:["Perpetual award nominee","All output, no follow-through","Non-committal"], spec:[{l:"Suggestion output",v:"MAX",p:100,hi:1},{l:"Follow-through",v:"2%",p:2},{l:"Height",v:"OFF-CHART",p:100},{l:"Award nominations",v:"MAX",p:96,hi:1}], p:"assets/img/andrew.jpg"},
  {n:"Ali \"Andro\" Castro", r:"Level 8 carpenter · battery mule", b:'Level 8 carpenter, which is either four levels above Jye or completely invented. The crew battery mule: hauls everyone else\'s dead packs uphill and still has charge to spare. A walking suggestion box who, unlike Andrew, actually commits to the bit. Loves to drill holes and screw anything he cannot nail.', t:["Level 8","Battery mule","Screws what he cannot nail"], spec:[{l:"Battery reserve",v:"FULL",p:98,hi:1},{l:"Restraint",v:"10%",p:10},{l:"Cert level",v:"8",p:80},{l:"Holes drilled",v:"MAX",p:100,hi:1}], p:"assets/img/ali.jpg"},
  {n:"Robbie \"One & Done\" Chmelyker", r:"Rope access tech · no protection required", b:'The boss on the mountain and, by his own account, in bed. The only rope access tech who never clips in - no harness, no protection - and somehow still leaves you feeling warm inside. Strictly a one-and-done encounter who always has a very important meeting to run to immediately afterward. Do not worry. He will call you.', t:["No harness required","One and done","Will definitely call"], spec:[{l:"Warmth rating",v:"HIGH",p:86,hi:1},{l:"Callback odds",v:"3%",p:3},{l:"Protection used",v:"0%",p:2},{l:"Exit speed",v:"MAX",p:100,hi:1}], p:"assets/img/robbie.jpg"},
  {n:"Kai \"The Algorithm\" McGrady", r:"Rope access tech · content creator", b:'At 23, the youngest unit on the roster and the only one with a media kit. Technically a rope access tech, functionally a content creator who films the rope access techs. Trains MMA, runs a blog nobody asked for, and has been load-tested primarily by the algorithm. Will scale a rock, but only if the lighting is good.', t:["Youngest unit","More followers than fall-arrest","Films everything"], spec:[{l:"Engagement rate",v:"HIGH",p:90,hi:1},{l:"Rock actually scaled",v:"12%",p:12},{l:"Follower count",v:"MAX",p:97,hi:1},{l:"Harness use",v:"15%",p:15}], p:"assets/img/kai.jpg"},
  {n:"Walker \"The Talker\" Ragpuller", r:"Rag puller · rope access tech", b:'Never stops talking, which is conveniently why nobody notices he is also never clipped in. Offers free mustache rides to anyone within earshot, requested or otherwise. Arrives on site fully stocked with eye wash, purely as a precaution against pink eye - a sentence he flatly refuses to elaborate on. Pulls rope. Pulls focus. Pulls up before anyone asks a follow-up question.', t:["Free mustache rides","BYO eye wash","Never stops talking"], spec:[{l:"Words per minute",v:"MAX",p:100,hi:1},{l:"Silence output",v:"2%",p:2},{l:"Mustache rides",v:"FREE",p:100,hi:1},{l:"Eye wash stock",v:"FULL",p:95}], p:"assets/img/walker.jpg"},
];

/* ---- Card building ---- */
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function slug(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);}
function initialsFrom(name){var p=String(name||'').trim().split(/\s+/).map(function(w){return w[0]||'';});return (p.join('').slice(0,2).toUpperCase())||'??';}
function seeded(name){var t=0,n=String(name||'');for(var i=0;i<n.length;i++)t=(t*31+n.charCodeAt(i))>>>0;return function(){t=(t*1103515245+12345)>>>0;return t/4294967296;};}

/* Submitted units don't pick their own spec bars — they get assigned
   deterministic ones seeded from their name. Fair is fair. */
function genSpecs(name){
  var r=seeded(name);
  var pool=[['Torque','MAX'],['Uptime',''],['Emotional load',''],['Punctuality',''],['Load rating','RATED'],['Grip strength',''],['Signal strength',''],['Follow-through','']];
  var picks=[],used={};
  while(picks.length<4){var i=Math.floor(r()*pool.length);if(used[i])continue;used[i]=1;var p=Math.floor(20+r()*80);var v=pool[i][1]||(p+'%');picks.push({l:pool[i][0],v:v,p:p,hi:picks.length===0?1:0});}
  return picks;
}

/* Normalize a hardcoded crew entry OR a Supabase row into one shape. */
function fieldset(m){
  var name=m.n||m.name||'';
  return {
    name:name,
    role:m.r||m.title||'Unspecified unit',
    bio:m.b||m.bio||'',
    tags:Array.isArray(m.t)?m.t:(Array.isArray(m.tags)?m.tags:String(m.tags||'').split(',').map(function(sv){return sv.trim();}).filter(Boolean)),
    photo:m.p||m.photo||'',
    spec:(m.spec&&m.spec.length)?m.spec:genSpecs(name),
    key:m.id?('u-'+m.id):slug(name),
    submitted:!!m.id
  };
}

function buildCard(f){
  UNITS[f.key]={name:f.name,photo:f.photo,role:f.role,bio:f.bio};
  var el=document.createElement('div'); el.className='featured';
  var meta=[f.role].concat(f.tags).filter(Boolean).join(' · ');
  var photo=f.photo
    ? '<div class="photo"><img src="'+esc(f.photo)+'" alt="'+esc(f.name)+'" loading="lazy"><div class="cornerstripe"></div></div>'
    : '<div class="photo photo-none"><span>'+esc(initialsFrom(f.name))+'</span><div class="cornerstripe"></div></div>';
  var specs='<div class="specs">'+f.spec.slice(0,4).map(function(x){
    return '<div class="spec"><label>'+esc(x.l)+' <span>'+esc(x.v)+'</span></label><div class="bar"><i class="'+(x.hi?'hi':'')+'" style="width:'+Math.max(0,Math.min(100,+x.p||0))+'%"></i></div></div>';
  }).join('')+'</div>';
  el.innerHTML=
    '<div class="cardno">00</div>'+
    (f.submitted?'<div class="membernum">TEAM SUBMITTED</div>':'')+
    photo+
    '<div class="fbody">'+
      '<div class="fname">'+esc(f.name)+'</div>'+
      '<div class="fmeta">'+esc(meta)+'</div>'+
      '<p class="fquote">“'+esc(f.bio)+'”</p>'+
      specs+
      '<div class="votebox" data-votekey="'+esc(f.key)+'"></div>'+
    '</div>';
  return el;
}

/* Johnny is card 01 in the static HTML; everyone in the stack counts up
   from 02. Re-run whenever cards are added so numbers stay sequential. */
function renumber(){
  grid.querySelectorAll('.cardno').forEach(function(elno,i){
    elno.textContent=('0'+(i+2)).slice(-2);
  });
}

/* ---- Render: founding crew now, submitted units when they arrive ---- */
const grid = document.getElementById('crew');
crew.forEach(function(m){ grid.appendChild(buildCard(fieldset(m))); });
renumber();
initVoteboxes(document);
initLoadMatch();

async function loadMembers(){
  try{
    const res=await fetch(REST+'/industrial_dating_members?select=id,name,title,bio,photo,tags,spec&order=created_at.desc',{headers:API_HEADERS});
    if(!res.ok) throw new Error('status '+res.status);
    const rows=await res.json();
    if(!Array.isArray(rows)||!rows.length) return;
    const frag=document.createDocumentFragment();
    rows.forEach(function(m){frag.appendChild(buildCard(fieldset(m)));});
    initVoteboxes(frag);
    grid.insertBefore(frag, grid.firstChild);   // newest team additions lead the roster
    renumber();
    initLoadMatch();                            // refresh dropdowns with new units
    refreshVoteCounts();
  }catch(e){ console.warn('Roster load skipped:', e.message); }
}
loadMembers();

/* =====================================================================
   VOTING — toggleable: click to vote, click again to retract, click the
   other button to switch. One vote per unit per browser (anonymous
   voter_id; the server only lets you change your own).
   ===================================================================== */
function myVotes(){ try{return JSON.parse(localStorage.getItem('id_votes'))||{};}catch(e){return {};} }
function setVote(key,vote){
  var v=myVotes();
  if(vote) v[key]=vote; else delete v[key];
  localStorage.setItem('id_votes',JSON.stringify(v));
}
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
  fetch(FN+'/vote',{
    method:'POST',
    headers:Object.assign({'Content-Type':'application/json'},API_HEADERS),
    body:JSON.stringify({member_key:key,vote:vote,voter_id:voterId()})
  }).catch(function(e){ console.warn('Vote not recorded:',e.message); });
}

function initVoteboxes(root){
  root.querySelectorAll('[data-votekey]').forEach(function(box){
    if(box.dataset.ready) return;
    box.dataset.ready='1';
    box.innerHTML=
      '<button type="button" class="vbtn vbtn-cert" data-vote="certify">✔ Certify <span class="n">0</span></button>'+
      '<button type="button" class="vbtn vbtn-tag" data-vote="redtag">⚠ Red-tag <span class="n">0</span></button>'+
      '<span class="votenote"></span>';
    markVote(box,myVotes()[box.dataset.votekey]||null,'');
    box.querySelectorAll('.vbtn').forEach(function(btn){
      btn.addEventListener('click',function(){ toggleVote(box,btn.dataset.vote); });
    });
  });
}

function markVote(box,vote,note){
  box.querySelectorAll('.vbtn').forEach(function(b){
    b.classList.toggle('voted',b.dataset.vote===vote);
  });
  box.querySelector('.votenote').textContent=note;
}

function bump(box,vote,delta){
  var n=box.querySelector('.vbtn-'+(vote==='certify'?'cert':'tag')+' .n');
  n.textContent=Math.max(0,(parseInt(n.textContent,10)||0)+delta);
}

function toggleVote(box,vote){
  var key=box.dataset.votekey, cur=myVotes()[key];
  if(cur===vote){                      // clicked again → retract
    setVote(key,null); bump(box,vote,-1);
    markVote(box,null,vote==='certify'?'Certification revoked.':'Red-tag rescinded.');
    sendVote(key,'retract');
  }else{                               // new vote, or switching sides
    if(cur) bump(box,cur,-1);
    setVote(key,vote); bump(box,vote,1);
    markVote(box,vote,vote==='certify'?'Certification filed.':'Red-tag logged with the safety committee.');
    sendVote(key,vote);
  }
}

async function refreshVoteCounts(){
  try{
    const res=await fetch(REST+'/industrial_dating_vote_counts?select=member_key,vote,n',{headers:API_HEADERS});
    if(!res.ok) throw new Error('status '+res.status);
    const rows=await res.json();
    const counts={};
    rows.forEach(function(r){ (counts[r.member_key]=counts[r.member_key]||{})[r.vote]=r.n; });
    document.querySelectorAll('[data-votekey]').forEach(function(box){
      var c=counts[box.dataset.votekey]||{};
      box.querySelector('.vbtn-cert .n').textContent=c.certify||0;
      box.querySelector('.vbtn-tag .n').textContent=c.redtag||0;
    });
    renderLeaderboard(counts);
  }catch(e){ console.warn('Vote counts skipped:',e.message); }
}
refreshVoteCounts();

/* =====================================================================
   PERFORMANCE REVIEW — leaderboard from live vote counts
   ===================================================================== */
function renderLeaderboard(counts){
  var rows=Object.keys(counts).filter(function(k){return UNITS[k];}).map(function(k){
    return {name:UNITS[k].name,certify:counts[k].certify||0,redtag:counts[k].redtag||0};
  });
  fillBoard('lb-cert',rows.filter(function(r){return r.certify>0;})
    .sort(function(a,b){return b.certify-a.certify;}).slice(0,3),'certify','No units cleared yet. Concerning.');
  fillBoard('lb-tag',rows.filter(function(r){return r.redtag>0;})
    .sort(function(a,b){return b.redtag-a.redtag;}).slice(0,3),'redtag','No red tags on file. The committee is suspicious.');
}
function fillBoard(id,rows,field,emptyMsg){
  var el=document.getElementById(id);
  if(!el) return;
  if(!rows.length){ el.innerHTML='<div class="lbempty">// '+emptyMsg+'</div>'; return; }
  el.innerHTML=rows.map(function(r){
    return '<li><span class="lbname">'+esc(r.name)+'</span><span class="lbn">'+r[field]+(field==='certify'?' ✔':' ⚠')+'</span></li>';
  }).join('');
}

/* =====================================================================
   LOAD MATCH — deterministic compatibility assessment for any two units
   ===================================================================== */
const LM_VERDICTS=[
  'DO NOT OPERATE SIMULTANEOUSLY.',
  'APPROVED FOR SUPERVISED OPERATION ONLY.',
  'COMPATIBLE UNDER STATIC LOAD. DO NOT INTRODUCE DYNAMIC FORCES.',
  'PAIRING EXCEEDS RATED CAPACITY. ENGINEERING REVIEW REQUIRED.',
  'CERTIFIED LOAD-BEARING COUPLE. PROCEED.',
  'COMPATIBLE ONLY AT ELEVATION. DO NOT ATTEMPT AT SEA LEVEL.',
  'TAG OUT. BOTH OF THEM.',
  'SPARK HAZARD. KEEP AWAY FROM OPEN FLAME AND EACH OTHER.',
  'PAIRING VOID WHERE PROHIBITED. PROHIBITED EVERYWHERE.',
  'REQUIRES DAILY PRE-USE INSPECTION AND COUPLES COUNSELLING.'
];
function initLoadMatch(){
  var a=document.getElementById('lm-a'),b=document.getElementById('lm-b'),run=document.getElementById('lm-run');
  if(!a) return;
  var keepA=a.value,keepB=b.value;
  var opts=Object.keys(UNITS).map(function(k){return '<option value="'+esc(k)+'">'+esc(UNITS[k].name)+'</option>';}).join('');
  a.innerHTML=opts; b.innerHTML=opts;
  if(keepA) a.value=keepA;
  if(keepB) b.value=keepB; else b.selectedIndex=Math.min(1,b.options.length-1);
  if(!run.dataset.ready){ run.dataset.ready='1'; run.addEventListener('click',runLoadMatch); }
}
function runLoadMatch(){
  var ka=document.getElementById('lm-a').value, kb=document.getElementById('lm-b').value;
  var out=document.getElementById('lm-result'), specs=document.getElementById('lm-specs'), verdict=document.getElementById('lm-verdict');
  out.hidden=false;
  if(ka===kb){
    specs.innerHTML='';
    verdict.textContent='UNIT CANNOT BE PAIRED WITH ITSELF. THAT IS CALLED A MIRROR. SEE HR.';
    return;
  }
  var r=seeded([ka,kb].sort().join('::'));   // same pair → same result, forever
  var metrics=[['Torque alignment'],['Combined emotional load'],['Spark risk'],['Paperwork required']];
  specs.innerHTML=metrics.map(function(m,i){
    var p=Math.floor(r()*101);
    var v=p>90?'MAX':p<8?'NIL':p+'%';
    return '<div class="spec"><label>'+m[0]+' <span>'+v+'</span></label><div class="bar"><i class="'+(i%2?'':'hi')+'" style="width:'+p+'%"></i></div></div>';
  }).join('');
  verdict.textContent='VERDICT: '+LM_VERDICTS[Math.floor(r()*LM_VERDICTS.length)];
}

/* =====================================================================
   TOOLBOX TALK — the daily safety briefing
   ===================================================================== */
const TIPS=[
  'Never date anyone who owns more clamps than you. That is not commitment, that is inventory.',
  'If they say they will call you after the shift, confirm which shift. And which year.',
  'A shared harness is not a relationship milestone. It is a rescue situation.',
  'Do not flirt over the two-way radio. Channel 3 is for lifting plans and heartbreak only.',
  'If your date brings their own eye wash station, do not ask the follow-up question.',
  'Matching hi-viz is not a couples costume. It is a Tuesday.',
  'Love is like a load chart: exceed the rated capacity and everybody gets hurt.',
  'Never trust anyone who says "trust me bro" before a load calculation or a second date.',
  'If he shows you his certification wallet on the first date, there is nothing else in the wallet.',
  'Rope access is not a metaphor. Stop making it a metaphor.',
  'Date someone who looks at you the way Dave looks at a full rope bag.',
  'An air horn is not an appropriate way to express affection. It is, however, effective.',
  'If the first gift is a torque wrench, marry them. That wrench is worth $400.',
  'Emotional baggage must be tagged, weighed, and rigged by a competent person.',
  'Kissing under the mistletoe is seasonal. Kissing under a suspended load is a violation.',
  '"It is not you, it is my swing shift" is the oldest excuse in the book. The book is the OH&S manual.'
];
(function(){
  var el=document.getElementById('talkline');
  if(!el) return;
  var day=Math.floor(Date.now()/86400000);
  document.getElementById('talkno').textContent='// TOOLBOX TALK #'+((day%899)+101)+' · DAILY SAFETY BRIEFING';
  el.textContent=TIPS[day%TIPS.length];
})();

/* =====================================================================
   CTA — the joke enrollment box (purely theatrical, as tradition demands)
   ===================================================================== */
const btn=document.getElementById('enrollBtn');
const msg=document.getElementById('finemsg');
const lines=[
  "Application received. You are unit #4,383. Still no women. We checked again.",
  "Processing… you have been matched with a 1997 excavator. Strong start.",
  "Welcome aboard. Your emotional load rating is under review. It's not looking great.",
  "Enrolled. A foreman named Johnny would like to remind you: safety first, feelings never."
];
let idx=0;
btn.addEventListener('click',()=>{
  const v=document.getElementById('email').value.trim();
  msg.textContent = v ? lines[idx++%lines.length] : "Enter a callsign, operator.";
});
document.getElementById('email').addEventListener('keydown',e=>{if(e.key==='Enter')btn.click();});
