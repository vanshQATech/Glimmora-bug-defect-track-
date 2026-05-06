# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repository root unless noted.

- `npm run install-all` — install root + client dependencies (run once after clone)
- `npm run dev` — run Express API (port 3001) and Vite client concurrently
- `npm run server` — API only (`node server/index.js`)
- `npm run client` — Vite dev server only (`cd client && npm run dev`)
- `npm run build` — production build of the React client into `client/dist`
- `npm start` — production server (serves API + built client from `client/dist`)

There is no test suite, linter, or formatter configured.

## Architecture

Monorepo with two apps in one process in production: an Express API under `server/` and a React/Vite SPA under `client/`. In production (`npm start`), Express serves the built SPA from `client/dist` and falls through to `index.html` for non-`/api/*` GETs so deep links from emails (e.g. `/bugs/:id`) work.

### Persistence — sql.js + Postgres snapshot

The data layer (`server/database.js`) is unusual and load-bearing:

- The runtime DB is **sql.js** (SQLite compiled to WASM) held in memory, exposed through a `DbWrapper` that mimics the better-sqlite3 API (`prepare().run/get/all`, `exec`, `pragma`).
- Every write calls `_save()`, which (a) writes the full DB to `server/bugtracker.db` on local disk and (b) schedules a debounced (3s) snapshot of the entire DB blob to a Postgres `db_snapshot` table (single row, `id = 1`, BYTEA).
- On boot, the DB is loaded from the Postgres snapshot first, then local file, then created fresh. `SIGTERM`/`SIGINT` flush a final snapshot before exit.
- This pattern exists because the deployment target (Render) has an ephemeral filesystem — Postgres is the only durable store. `DATABASE_URL` enables snapshotting; without it, only local file persistence is used.
- File uploads (bug + test case attachments) are stored as **BLOBs in the DB** for the same reason. `GET /api/uploads/:filename` reads from `bug_attachments.data` / `test_case_attachments.data`, falling back to `server/uploads/` for legacy files.

Schema is defined inline in `initializeDatabase()` via `CREATE TABLE IF NOT EXISTS`. Schema changes for existing deployments are done as **inline lightweight migrations** in the same function — read `PRAGMA table_info(...)` and conditionally `ALTER TABLE ADD COLUMN`. Add new migrations there in the same style; don't introduce a separate migration framework.

### API layout

`server/index.js` mounts route modules under `/api/*`:

- `auth` (login/register, password reset, Google Sign-In with domain allowlist)
- `users`, `projects`, `bugs`, `tasks`, `testcases` — core entities
- `workspace` (work_tasks + daily_updates), `activity` (activity_updates) — separate work-tracking surface from the bug/task system
- `notifications`, `dashboard`, `search`, `admin`, `ai`

`server/middleware/auth.js` provides `authenticate` (JWT bearer → loads user, rejects inactive accounts), `authorize(...roles)`, and `isProjectMember` (Admin bypass + `project_members` lookup).

A startup job in `server/index.js` sends bug due-date reminder emails on boot and every 24h via `utils/mailer.js` (Brevo SMTP).

### AI assistant

`server/routes/ai.js` powers the in-app assistant. It uses Anthropic's SDK with tool use (up to 6 iterations) and applies a **role-based visibility filter**: non-lead users (anyone outside `Admin` / `Project Manager` / `Team Lead`) only see projects they are members of. When adding new AI tools, route any project-scoped query through `projectFilter()` so this restriction is preserved. `routes/testcases.js` also calls Gemini as a free fallback for AI-fill of test cases.

### Client

React 19 + Vite 6 + Tailwind, React Router 7. State is local + `AuthContext`. The API client (`client/src/utils/api.js`) reads `VITE_API_URL` at build time — when unset, the SPA calls relative `/api/*` (production: same origin as the Express server). A 401 response globally clears localStorage and redirects to `/login`. Status/priority/severity/role enums are centralized in `client/src/utils/constants.js`; bug status names like `Approved by PM` and `Not a Bug` are referenced by the server (e.g. due-date reminder filtering) — keep them in sync if renaming.

### Deployment

- Server: Render (ephemeral disk → Postgres snapshot is mandatory for persistence).
- Client: Vercel (`vercel.json` rewrites all paths to `/`, builds from `client/`). Production client points at the Render API via `VITE_API_URL`.
- Single-process deployments work too via `npm start` (Express serves both API and SPA).

### Seeding

`initializeDatabase()` always upserts two seed users (`vanshqalead@glimmora.com` Admin, `vanshqapm@glimmora.com` Project Manager) and runs `scripts/seed-glimmora.js` to populate the Glimmora demo project + test scenarios/cases idempotently. Seeding runs on every boot — make seed logic safe to re-run.
