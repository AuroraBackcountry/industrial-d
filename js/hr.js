/* =====================================================================
   INDUSTRIAL DATING — HR portal
   Shared-password moderation queue. The password is verified server-side
   by the 'hr' Edge Function on every request; this page just remembers it
   locally after a successful login.
   ===================================================================== */

const FN = CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1';
const API_HEADERS = {
  apikey: CONFIG.SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function hr(action, extra){
  const res = await fetch(FN + '/hr', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, API_HEADERS),
    body: JSON.stringify(Object.assign({ password: localStorage.getItem('hr_pass') || '', action: action }, extra || {}))
  });
  const data = await res.json().catch(function(){ return {}; });
  if (res.status === 401) { logout(); throw new Error(data.error || 'ACCESS DENIED'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function logout(){
  localStorage.removeItem('hr_pass');
  document.getElementById('portal').hidden = true;
  document.getElementById('login').hidden = false;
}

async function enter(){
  document.getElementById('login').hidden = true;
  document.getElementById('portal').hidden = false;
  await loadQueue();
}

async function loadQueue(){
  const queue = document.getElementById('queue');
  queue.innerHTML = '<div class="lbempty">// PULLING PERSONNEL FILES…</div>';
  let members;
  try {
    members = (await hr('list')).members;
  } catch (e) {
    queue.innerHTML = '<div class="lbempty">// ' + esc(e.message) + '</div>';
    return;
  }
  if (!members.length) {
    queue.innerHTML =
      '<div class="submitok"><span class="bigstamp">Queue clear</span>' +
      '<p class="mono">// NO PENDING UNITS. NOBODY LOVES ANYONE NEW.<br>// GO DO SOME ACTUAL WORK.</p></div>';
    return;
  }
  queue.innerHTML = '';
  members.forEach(function(m){ queue.appendChild(buildReview(m)); });
}

function buildReview(m){
  const el = document.createElement('div');
  el.className = 'formcard hrcard';
  const photo = m.photo ? '<img class="hrphoto" src="' + esc(m.photo) + '" alt="">' : '';
  const specs = (m.spec && m.spec.length)
    ? '<div class="specs" style="margin-top:14px">' + m.spec.map(function(x){
        return '<div class="spec"><label>' + esc(x.l) + ' <span>' + esc(x.v) + '</span></label>' +
               '<div class="bar"><i class="' + (x.hi ? 'hi' : '') + '" style="width:' + Math.max(0, Math.min(100, +x.p || 0)) + '%"></i></div></div>';
      }).join('') + '</div>'
    : '<div class="hint" style="margin-top:12px">// no spec sheet — the algorithm will assign bars on the roster</div>';
  el.innerHTML =
    '<div class="membernum">PENDING</div>' +
    photo +
    '<div class="fname" style="font-size:24px">' + esc(m.name) + '</div>' +
    '<div class="fmeta">' + esc([m.title].concat(m.tags || []).filter(Boolean).join(' · ')) + '</div>' +
    '<p class="fquote" style="margin-top:12px">“' + esc(m.bio || '') + '”</p>' +
    specs +
    (m.raw_notes && m.raw_notes !== m.bio
      ? '<div class="rawnotes"><b>// WHAT THE SUBMITTER ACTUALLY WROTE:</b><br>' + esc(m.raw_notes) + '</div>'
      : '') +
    '<div class="hrbtns">' +
      '<button type="button" class="btn btn-y" data-act="approve">✔ Approve — weld onto roster</button>' +
      '<button type="button" class="btn hrreject" data-act="reject">⚠ Reject — never existed</button>' +
    '</div>' +
    '<div class="formmsg hrmsg"></div>';
  el.querySelectorAll('[data-act]').forEach(function(btn){
    btn.addEventListener('click', async function(){
      if (btn.dataset.act === 'reject' && !confirm('Reject ' + m.name + '? The row and photo are deleted. There is no shredder-recovery process.')) return;
      el.querySelectorAll('button').forEach(function(b){ b.disabled = true; });
      try {
        await hr(btn.dataset.act, { id: m.id });
        el.style.opacity = '.35';
        el.querySelector('.hrmsg').textContent = btn.dataset.act === 'approve'
          ? '✔ CERTIFIED. UNIT IS LIVE ON THE ROSTER.'
          : '⚠ REJECTED. THE COMMITTEE HAS NO MEMORY OF THIS UNIT.';
      } catch (e) {
        el.querySelectorAll('button').forEach(function(b){ b.disabled = false; });
        el.querySelector('.hrmsg').textContent = '⚠ ' + e.message;
      }
    });
  });
  return el;
}

document.getElementById('loginform').addEventListener('submit', async function(e){
  e.preventDefault();
  const msg = document.getElementById('loginmsg');
  msg.textContent = '';
  localStorage.setItem('hr_pass', document.getElementById('hr-pass').value);
  try {
    await hr('list');   // validates the password server-side
    enter();
  } catch (err) {
    msg.textContent = '⚠ ' + err.message;
  }
});

document.getElementById('hr-logout').addEventListener('click', logout);

// Already holding a badge? Walk straight in (server still re-checks every call).
if (localStorage.getItem('hr_pass')) enter();
