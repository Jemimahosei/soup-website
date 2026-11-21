# SOUP Website

## 🔗 Live site: https://soup-website.onrender.com

The website for SOUP (Students for Outdoor Unsupervised Playtime), the outdoors club at Cornell — rebuilt as a dynamic app. Events, resources (tradition stories, poems, guides), and announcements are stored in PostgreSQL and served through a REST API, with an admin panel for managing content without code changes. All content is the club's real content, copied from the original static site.

## Architecture

```
Browser ──▶ Svelte (Vite SPA, hash-routed)
              │  /api/*
              ▼
           Express API (Node.js, pg)
              │  reads / writes
              ▼
           PostgreSQL (soup-db)
```

- **Frontend** (Svelte 4 + Vite): home with photo carousel and announcements, past and upcoming events, traditions and poems, join-us page, event detail, admin panel. Hash-routed, so the built site needs no server rewrites.
- **Backend** (Express): public reads (`/api/events`, `/api/resources`, `/api/announcements`, `/api/health`) and admin CRUD (`/api/admin/events`, `/api/admin/resources`, `/api/admin/announcements`) behind a bearer token from `POST /api/admin/login`.
- **Database** (PostgreSQL): migrations and seeding run on startup and are idempotent — seed only inserts into empty tables.
- **Deploy**: one Node service on Render (`render.yaml`, health check `/api/health`) plus a free PostgreSQL database (`soup-db`); the API serves the built frontend, so the whole site runs on one host and URL.

## Stack

Svelte 4 · Vite · Express · PostgreSQL · Docker · Render

## Run it locally

```bash
docker compose up --build
```

Then open http://localhost:4173 (API at http://localhost:3001/api/health, Postgres on localhost:5432). Without Docker (needs a PostgreSQL server): `cd backend && npm install && npm run migrate && npm run seed && npm start`, then `cd ../frontend && npm install && npm run dev` → http://localhost:5173.

## Tests

Backend test suite (`cd backend && npm test`) boots the real migrate, seed, and server code against in-memory Postgres (pg-mem) and exercises every endpoint, including auth, validation, and edge cases; it exits non-zero on any failure.

## Notes

- The live site is on Render's free tier, so the first load can take about a minute while it wakes up.
- Admin login: username `admin`, password set by the `ADMIN_PASSWORD` environment variable (generated on Render; local default is `soup-admin`).
- The upcoming-events list is honestly empty until the club posts new dates — the only dated events in the source site are from 2024. Event sign-ups happen through the club's GroupMe/email, not the site.
