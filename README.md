# Industrial Dating

> Love rated for heavy loads. A joke dating site for the crew — every member load-tested, torque-verified, and cleared for emotional operation. Mostly.

Live site: **https://industrial-dating.ca** (Cloudflare Pages)
Mirror: `https://aurorabackcountry.github.io/industrial-d/` (GitHub Pages)

## How it works

This is a **static site** (plain HTML/CSS/JS, no build step) hosted on GitHub Pages,
with **Supabase** as the backend. The browser talks straight to Supabase's REST API —
there is no server of our own.

```
Browser ──▶ GitHub Pages   (serves the HTML/CSS/JS files)
   │
   └──────▶ Supabase       (database + photo storage)
              ├─ industrial_dating_members   team-submitted profiles
              ├─ industrial_dating_votes     certify / red-tag votes
              └─ storage: industrial-dating  uploaded photos
```

The key in `js/config.js` is a **publishable** key — safe to commit. It can only do
what the database's Row Level Security (RLS) policies allow:

| Action                              | Allowed for anyone? |
|-------------------------------------|---------------------|
| Read **approved** members           | ✅ |
| Read unapproved members             | ❌ (invisible until you approve) |
| Submit a member (as unapproved)     | ✅ |
| Approve / edit / delete members     | ❌ (dashboard or SQL only) |
| Cast a vote, read vote counts       | ✅ |
| Upload a photo (≤5 MB, images only) | ✅ |

## File map

```
index.html        the main page (roster, voting, joke CTA)
submit.html       "Enroll a unit" — the submission form
css/style.css     all styling, one industrial theme
js/config.js      Supabase URL + publishable key
js/app.js         renders the roster, loads submitted units, voting
js/submit.js      photo upload + member insert
assets/img/       the founding crew's photos
.github/workflows/deploy.yml   auto-deploys main branch to GitHub Pages
```

## Features

- **Founding roster** — the original crew, hardcoded in `js/app.js`.
- **Submit a unit** — anyone can nominate a coworker (name, role, bio, tags, photo).
  Submissions land in the database **unapproved and invisible**.
- **Moderation** — new units appear only after you approve them (see below).
  Submitted units get spec bars auto-generated from their name — deterministic,
  so the same name always gets the same specs. No appeals.
- **Voting** — visitors can ✔ Certify or ⚠ Red-tag any unit. One vote per unit
  per browser (localStorage — honor-system, on brand).

## Moderating submissions

New submissions are hidden until approved. Two ways to review the queue:

**Supabase dashboard** (easiest): open the project → Table Editor →
`industrial_dating_members` → set `approved` to `true` on the good ones,
delete the bad ones.

**SQL** (Supabase dashboard → SQL Editor):

```sql
-- See the queue
select id, name, title, bio, created_at
from industrial_dating_members where not approved;

-- Approve one
update industrial_dating_members set approved = true where id = '<uuid>';

-- Reject one
delete from industrial_dating_members where id = '<uuid>';
```

## Running locally

No build step — just serve the folder (opening `index.html` directly also works,
but a local server matches how Pages serves it):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying

Every push to `main` deploys automatically to **both** hosts:

- **Cloudflare Workers** → https://industrial-dating.ca (primary; git-connected
  static assets, config in `wrangler.jsonc`, non-site files excluded via
  `.assetsignore`)
- **GitHub Pages** → aurorabackcountry.github.io/industrial-d (mirror; via
  `.github/workflows/deploy.yml`)
