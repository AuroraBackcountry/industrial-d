/* =====================================================================
   INDUSTRIAL DATING — unit intake
   1. (optional) upload the photo to Supabase Storage
   2. insert the member row (approved defaults to false — it sits in
      the moderation queue until the foreman flips the switch)
   ===================================================================== */

const REST = CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
const STORAGE = CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/storage/v1';
const API_HEADERS = {
  apikey: CONFIG.SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
};

const form = document.getElementById('unitform');
const msg = document.getElementById('formmsg');
const submitBtn = document.getElementById('f-submit');

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function uploadPhoto(file) {
  const ext = PHOTO_TYPES[file.type];
  if (!ext) throw new Error('Photo must be JPG, PNG, or WebP.');
  if (file.size > MAX_PHOTO_BYTES) throw new Error('Photo over 5 MB. This is a dating site, not a plotter scan.');
  // Random-ish unique filename so uploads never collide.
  const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const res = await fetch(STORAGE + '/object/industrial-dating/' + name, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': file.type }, API_HEADERS),
    body: file
  });
  if (!res.ok) throw new Error('Photo upload failed (status ' + res.status + ').');
  return CONFIG.SUPABASE_URL + '/storage/v1/object/public/industrial-dating/' + name;
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  msg.textContent = '';

  // Honeypot tripped → pretend success, store nothing.
  if (document.getElementById('f-website').value) { showSuccess(); return; }

  const name = document.getElementById('f-name').value.trim();
  if (name.length < 2) { msg.textContent = 'Unit name required, operator. Minimum two characters.'; return; }

  const tags = document.getElementById('f-tags').value
    .split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 6);

  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing…';

  try {
    let photoUrl = null;
    const file = document.getElementById('f-photo').files[0];
    if (file) photoUrl = await uploadPhoto(file);

    const payload = {
      name: name,
      title: document.getElementById('f-title').value.trim() || null,
      bio: document.getElementById('f-bio').value.trim() || null,
      tags: tags,
      photo: photoUrl
    };

    // Primary path: the enroll-unit Edge Function, which has Claude rewrite
    // the submission as an on-brand roast profile before it hits the queue.
    // Fallback: insert the raw submission directly if the function is down.
    let ok = false;
    try {
      const fnRes = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/enroll-unit', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, API_HEADERS),
        body: JSON.stringify(payload)
      });
      ok = fnRes.ok;
    } catch (e) { /* fall through to direct insert */ }

    if (!ok) {
      const res = await fetch(REST + '/industrial_dating_members', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, API_HEADERS),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Intake rejected (status ' + res.status + '). Try again.');
    }
    showSuccess();
  } catch (err) {
    msg.textContent = '⚠ ' + err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit for load testing';
  }
});

function showSuccess() {
  form.hidden = true;
  document.getElementById('submitok').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('another').addEventListener('click', function () {
  form.reset();
  form.hidden = false;
  document.getElementById('submitok').hidden = true;
});
