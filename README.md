# SOUP Dynamic Website 
**Live site:** https://soup-website.onrender.com

SOUP (Students for Outdoor Unsupervised Playtime) is an outdoors club at
Cornell. The old site (`Jemimahosei/CornellSOUP`) is a static HTML/CSS/JS
site; this is the dynamic rebuild from jem's upgrade spec: take the static
site and make it pull real data — events, resources, and announcements from
a PostgreSQL database, served through a REST API, with an admin panel for
managing content without code changes.

**All content is the club's real content**, copied verbatim from the
CornellSOUP repo (index.html, past-events.html, upcoming-events.html,
join-us.html, design-plan/text-content.md). Nothing is invented. See
`backend/src/seed.js` for the sources and the two judgment calls
(Manhunt has no date in the repo, so it is a resource, not a dated event;
the live site says founded 2020 / 400+ members, which wins over the
design doc's 2019).

## Stack

- **Frontend:** Svelte 4 + Vite (hash-routed single-page app, responsive,
  the club's own yellow/orange/blue theme: #FFE4A3 / #DC600B / #2596be,
  monospace type)
- **Backend:** Node.js + Express, `pg` for PostgreSQL
- **Database:** PostgreSQL 16 (via docker-compose for local dev)
- **No real secrets:** the seeded admin account is demo-only — change the
  credentials before any shared deployment.

## Project layout

```
soup-website/
  docker-compose.yml        # db + api + web, one command
  backend/
    src/
      db.js                 # pg connection pool (DATABASE_URL)
      migrate.js            # creates tables + seeded admin account
      seed.js               # the club's REAL content (verbatim from the repo)
      server.js             # Express API: public reads, admin CRUD
    Dockerfile
    .env.example
  frontend/
    src/
      lib/api.js            # API client, admin auth, date helpers
      App.svelte            # layout + hash router
      pages/                # Home, PastEvents, UpcomingEvents, JoinUs,
                            # EventDetail, Admin
    Dockerfile              # builds + serves vite preview
```

## Quick start (docker-compose)

```bash
docker compose up --build
```

- Site: http://localhost:4173
- API: http://localhost:3001/api/health
- Postgres: localhost:5432 (user `soup`, password `soup`, database `soup`)

The `api` service runs migrations and seeding automatically on startup.
Seeding is idempotent — it only inserts when a table is empty.

## Local dev without docker

You need a PostgreSQL server. Then:

```bash
cd backend
npm install
# DATABASE_URL defaults to postgres://soup:soup@localhost:5432/soup
npm run migrate
npm run seed
npm start        # API on http://localhost:3001

cd ../frontend
npm install
npm run dev      # site on http://localhost:5173
```

The frontend talks to `VITE_API_URL` (defaults to
`http://localhost:3001/api`).

## Demo credentials

- **Admin login:** username `admin`, password `soup-admin-2026-verify`
  (set via `ADMIN_USERNAME` / `ADMIN_PASSWORD`; the code default is
  `soup-admin`). Admin auth is a demo token scheme (random bearer token,
  24h expiry, SHA-256 password hash) — fine for a club site prototype,
  not production-grade.

## API reference

Public (no login):

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Liveness check |
| GET | `/api/events?filter=upcoming\|past\|all` | Ordered by date |
| GET | `/api/events/:id` | Single event |
| GET | `/api/resources?category=story\|poem\|guide\|link` | Ordered by title |
| GET | `/api/resources/:id` | Single resource |
| GET | `/api/announcements` | Pinned first, then newest |

Admin (header `Authorization: Bearer <token>` from `POST /api/admin/login`):

| Method | Path |
| --- | --- |
| POST | `/api/admin/login` — `{ username, password }` → `{ token }` |
| POST / PUT / DELETE | `/api/admin/events`, `/api/admin/events/:id` |
| POST / PUT / DELETE | `/api/admin/resources`, `/api/admin/resources/:id` |
| POST / PUT / DELETE | `/api/admin/announcements`, `/api/admin/announcements/:id` |

## Seed data (all real, from the CornellSOUP repo)

- **2 events** — the only two dated events in the repo, both 2024 and
  therefore past: 161 Things Competition (Apr 26, 2024) and Capture the
  Flag 2024 (Aug 31–Sep 1, 2024). The upcoming list is honestly empty
  until the club posts new dates via Admin. No spot counts: the real site
  signs people up via GroupMe/email, not the site.
- **13 resources** — 6 tradition stories (Big Leaf Pile, Burn Night,
  Snowball Fight, Camping, 24-Hour Capture the Flag, Manhunt), 2 member
  poems (Sydney Sill, Willem Van Osselaer), the club's own origin story
  ("How SOUP started", from the provided text), 2 pitch/leadership
  guides, and the real GroupMe + Instagram links. Stories and events
  carry their real photos (`image_url`, e.g. `/images/leaf-pile3-tt.jpg`).
- **3 announcements** — 2 pinned (welcome blurb, pitch-your-idea), plus a
  161 Things recap.

## Pages (mirror the real site's navigation)

- **Home** — welcome blurb, photo carousel (5 real slides from the
  club's gallery), history, member quotes, announcements, coming-up
  preview. The club logo sits in the header.
- **Past Events** — dated past events, our traditions (stories), poems
  inspired by our events.
- **Upcoming Events** — upcoming events, with an honest empty state
  pointing to the GroupMe when nothing is posted.
- **Join Us!** — how to pitch your own event, the SoupMe GroupMe, flyer
  sharing, contact (soup_cu@gmail.com, @cornell__soup).
- **Event detail** — full description, date/location, GroupMe/email CTA.
- **Admin** — login, then create/edit/delete for all three content types.

## Notes and limits

- **Photos:** the club's real photos ship with the frontend in
  `frontend/public/images/` (23 files: everything in the repo's
  `images/` plus the three photos the upcoming page uses from
  `design-plan/SOUP-provided-content/` — 161-things2, ctf3, manhunt2).
  Vite copies them into `dist/images/` on build. Every `<img>` has an
  error fallback so a missing file shows the text, never a broken image.
  The full original repo is kept at `reference-repo/` for provenance.
  The single-file demo inlines the 5 carousel photos; other photos show
  as text until deployed.
- **Hosting:** a dynamic app with a database cannot live on GitHub Pages
  (static hosting only). Shipping needs a host with PostgreSQL.
- Event "sign-ups" are informational only — there is no registration or
  payment flow; the real site signs people up via GroupMe/email.
- The frontend uses hash routing (`#/events/1`), so any static host can
  serve the built `dist/` folder with no server rewrites.
- No accounts, API keys, or third-party services are created by this
  project. The only credential is the seeded local admin login above.
- Content discrepancies in the source repo, resolved as noted in seed.js:
  the live site says founded 2020 / over 400 members (design doc says
  2019); the club's own provided text says 500+ members and the first
  client meeting says 450+ — the live published site (400+) is used;
  the footer in past-events.html carries an unresolved merge conflict
  (one side says `cu_soup@gmail.com`, the rest of the site says
  `soup_cu@gmail.com` — the latter is used); the 161 Things link in
  upcoming-events.html is missing a slash and is used corrected; two
  typos in the source are fixed ("jumping into is" → "jumping into it",
  "furthur" → "further").

## Deploy (Render blueprint)

**Live site:** https://soup-website.onrender.com

The app runs as a single service: the API serves the built frontend from
`frontend/dist`, so one host + one URL covers everything.

1. Push this folder to GitHub (text files only — the club photos are
   binary, so they are NOT in the repo; see Photos below).
2. Render dashboard → New → Blueprint → pick the repo. `render.yaml`
   creates the web service + a free PostgreSQL database; the service
   runs `migrate` + `seed` on startup (both idempotent), and serves
   `/api/health`. Build tools (vite, the Svelte plugin) live in the
   frontend's `dependencies`, not `devDependencies`, because Render's
   production install skips dev-only packages.
3. Set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in Render (the blueprint
   generates a password). Local dev default is admin / soup-admin — do
   not use it on a live site.

Local single-service run (same shape as production):
`npm --prefix frontend run build && npm --prefix backend start`
→ http://localhost:3001 serves the site + API. For API-only local dev
(frontend dev server on :5173), set `VITE_API_URL=http://localhost:3001/api`.

### Photos on the deployed site

The deployed repo has no `frontend/public/images` (binary files can't go
through the text-only push), so photo requests 404 on the app host —
and the frontend then falls back to the same files in the club's public
repo (`raw.githubusercontent.com/Jemimahosei/CornellSOUP`), including
the three photos that live under `design-plan/SOUP-provided-content/`.
If the photos are ever pushed to this repo, local files win and the
fallback never triggers.
