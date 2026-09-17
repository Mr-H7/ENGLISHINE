# Englishine production deployment

This repository ships two runtime pieces that must be deployed together:

- SPA: `frontend/` (Vite production build)
- API: `backend/` (Fastify on Node 22, Prisma, PostgreSQL)

Do not deploy the local QA database, the course **QA نشر محتوى**, or the student `qa.publish.student@englishine.test`. Those records exist only on the development machine.

Do not use `prisma migrate dev`, `prisma migrate reset`, or `prisma db push` on production.

## Required infrastructure

- Node.js 22.x and npm 10+ on the API host (`backend/.nvmrc`)
- PostgreSQL 14+ (Prisma migration lock is PostgreSQL-only)
- TLS-terminating reverse proxy (nginx, Caddy, or equivalent) on 443
- Persistent block storage for uploads **only when** `STORAGE_DRIVER=local`
- Vercel for the SPA (`frontend/` via repo-root `vercel.json`)
- Railway Node 22 for Fastify (`backend/` Root Directory, `backend/railway.toml`)
- Off-host backups for PostgreSQL **and** media (R2 bucket or local upload volume)
- Cloudflare R2 bucket `englishine-media` when `STORAGE_DRIVER=r2` (private, no public access)

Recommended topology (preserves cookie/auth once `/api` is proxied):

1. Serve the SPA from Vercel and the API from Railway.
2. Leave `VITE_API_URL` unset so the SPA calls same-origin `/api/v1`.
3. A later Vercel rewrite must forward `/api/` to Railway **without rewriting the path**. Fastify still listens for `/api/v1/...`. Until that rewrite exists, production `/api` requests will not reach Fastify.
4. Set `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`, `TRUST_PROXY=true`. Same-origin does **not** need `COOKIE_SAME_SITE=none`.

Local Vite still proxies `/api` to `127.0.0.1:3001`.

## Vercel (frontend only)

Repo-root `vercel.json` deploys the Vite SPA from `frontend/` with an `index.html` fallback. Do **not** set the Vercel project Root Directory to `backend`. Unset API secrets (`DATABASE_URL`, `JWT_SECRET`, `R2_*`, and the rest) from the Vercel project; they belong on Railway.

Leave `VITE_API_URL` unset at build time. Do not add a Fastify / Functions backend on Vercel.

## Railway (Fastify API, Node 22)

Create a Railway service with Root Directory `backend`. `backend/railway.toml` runs `npm run build` then `npm start` (`node dist/server.js`). Node 22 comes from `backend/.nvmrc` and `engines.node`. Railway injects `PORT`; bind `HOST=0.0.0.0`.

Health check: `GET /api/v1/health/ready`.

Do **not** put `prisma migrate deploy` or `prisma db seed` in the Railway start command. Migrations stay a one-time operator step (see PostgreSQL setup).

Required Railway env (same names as `.env.production.example`; never commit values): `NODE_ENV=production`, `HOST=0.0.0.0`, `TRUST_PROXY=true`, `DATABASE_URL`, `DIRECT_URL` (Prisma CLI / `prisma generate` via `prisma.config.ts`), `JWT_SECRET`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`, `CORS_ORIGINS` (the exact Vercel SPA origin, e.g. `https://englishine.vercel.app`), `STORAGE_DRIVER=r2`, and the `R2_*` keys.

When `STORAGE_DRIVER=r2`, admin MP4/PDF uploads use a short-lived presigned PUT to private R2, then Fastify `HeadObject` finalize. Multipart `/admin/lessons/:id/videos|resources` remains for `STORAGE_DRIVER=local`.

## Media storage (critical)

The API never exposes permanent public object URLs. Fastify remains the authorization authority for video and PDF delivery.

Set `STORAGE_DRIVER` explicitly (`local` or `r2`). Production does **not** switch to R2 merely because `NODE_ENV=production`.

### `STORAGE_DRIVER=local`

`StorageService` writes under `UPLOAD_DIR`:

- videos: `{UPLOAD_DIR}/videos/YYYY-MM/<uuid>.mp4` (also webm/mov)
- materials: `{UPLOAD_DIR}/materials/YYYY-MM/<uuid>.pdf`

`FileAsset.storageKey` in PostgreSQL is that relative key. Mount a persistent volume, set `UPLOAD_DIR` to an absolute path, and back it up with the database.

### `STORAGE_DRIVER=r2`

Objects are stored in the private Cloudflare R2 bucket (default name `englishine-media`) using the same key convention. Required secrets:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_ENDPOINT` (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

Keep the bucket private. Range video playback and PDF download go through `GET /api/v1/media/videos/:id` and `GET /api/v1/media/resources/:id` after authentication and enrollment checks. Back up the R2 bucket with PostgreSQL.

Direct browser PUT requires a **bucket CORS** rule on `englishine-media` (bucket stays private; this is not public access). Use the production SPA origin from `CORS_ORIGINS` (example `https://www.example.com`):

```json
[
  {
    "AllowedOrigins": ["https://www.example.com"],
    "AllowedMethods": ["PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 86400
  }
]
```

Do not add `*` as an origin. Do not enable public bucket access. R2 S3 credentials stay on Fastify only.

Local `./storage/uploads` is gitignored and is **not** production R2 storage.

## Environment variables

Copy `backend/.env.production.example` into the host secret store. Never commit real values.

| Variable | Production |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` on Railway |
| `PORT` | Injected by Railway (`process.env.PORT`). Local default `3001` |
| `TRUST_PROXY` | `true` behind Railway/nginx/Caddy |
| `DATABASE_URL` | Production PostgreSQL URL (app runtime) |
| `DIRECT_URL` | Production PostgreSQL URL (Prisma CLI / `migrate deploy`) |
| `JWT_SECRET` | Unique random string, ≥32 characters. Not the example placeholder. |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | `lax` for same-origin proxy; `none` only if the API is a different site |
| `CORS_ORIGINS` | Exact public SPA origin, e.g. `https://www.example.com`. Never `*` |
| `UPLOAD_DIR` | Absolute path on the persistent volume when `STORAGE_DRIVER=local` |
| `STORAGE_DRIVER` | `local` or `r2` (explicit; not inferred from `NODE_ENV`) |
| `R2_ACCOUNT_ID` | Required when `STORAGE_DRIVER=r2` |
| `R2_ACCESS_KEY_ID` | Required when `STORAGE_DRIVER=r2` |
| `R2_SECRET_ACCESS_KEY` | Required when `STORAGE_DRIVER=r2` |
| `R2_BUCKET` | Private bucket name, e.g. `englishine-media` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `BOOTSTRAP_ADMIN_*` | One-time secrets only. Never in frontend code |

Frontend build:

- Leave `VITE_API_URL` unset for same-origin `/api/v1` (Vercel rewrite to Railway comes later).
- Rebuild the SPA if you change `VITE_API_URL` (it is compiled in).

`backend/.env` and `frontend/.env` are gitignored.

## PostgreSQL setup

1. Create an empty production database and a dedicated user. Do not restore the local QA dump.
2. Set `DATABASE_URL` and `DIRECT_URL` in the API environment.
3. From `backend/`, with production `DIRECT_URL` loaded:

```bash
npx prisma migrate deploy
```

4. Apply the **system catalog seed once** (roles, public settings, academic stages, grades). This is not educational content:

```bash
npx prisma db seed
```

Do not re-run seed as a deploy hook unless you intend to upsert catalog rows. Do not copy local courses, students, enrollments, or upload files.

## Admin bootstrap (one-time)

`backend/scripts/bootstrap-admin.ts` is the only supported Super Admin creator. It reads `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (min 14 chars), and `BOOTSTRAP_ADMIN_NAME` from the environment. It does not change an existing user's password; it only grants `SUPER_ADMIN` if the email already exists.

After `migrate deploy` and the catalog seed:

```bash
cd backend
# Inject secrets in the shell or the host secret store. Do not write them into tracked files.
npx tsx scripts/bootstrap-admin.ts
```

Equivalent: `npm run bootstrap:admin`.

Then unset `BOOTSTRAP_ADMIN_PASSWORD`. Confirm login at `https://<origin>/login` and that staff land on `/admin/`.

## Backend deployment procedure

Railway (Root Directory `backend/`):

```bash
npm ci
npm run build
npm start
```

`npm start` runs `node dist/server.js`. `npm run build` runs `prisma generate` then `tsc`. Railway uses `backend/railway.toml` for those commands.

Do not start with `npm run dev` or `tsx watch` in production. Do not add `prisma migrate deploy` to the Railway start command.

Fastify listens on `HOST` (`0.0.0.0`) and `PORT` (Railway-injected) and shuts down on `SIGINT`/`SIGTERM`.

## Frontend deployment procedure

Vercel builds `frontend/` from repo-root `vercel.json`. On a CI job or locally:

```bash
npm ci
npm run build
```

Publish `frontend/dist/` as the document root. Configure SPA fallback to `index.html`.

Example nginx (same origin, path `/api` preserved):

```nginx
client_max_body_size 2048m;

location /api/ {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Request-Id $request_id;
  proxy_buffering off;
}

location / {
  root /var/www/englishine;
  try_files $uri $uri/ /index.html;
}
```

`proxy_pass` must **not** have a trailing URI that strips `/api`. Cookie paths are `/api/v1` and `/api/v1/auth`.

## HTTPS / proxy requirements

- Terminate TLS at the proxy. Redirect HTTP to HTTPS.
- Set `X-Forwarded-Proto` and `X-Forwarded-For`.
- Set `TRUST_PROXY=true` so rate limits and `request.ip` see the client, not the proxy.
- `COOKIE_SECURE=true` requires HTTPS on the browser origin.
- Allow `Range` requests through the proxy for `/api/v1/media/videos/*`.
- Upload limit at the proxy must be at least `UPLOAD_MAX_FILE_BYTES` (2 GiB videos, 25 MiB PDFs).

## Health endpoint

- Liveness: `GET /api/v1/health/live`
- Readiness (PostgreSQL): `GET /api/v1/health/ready`

Point the load balancer at `/api/v1/health/ready`.

## Backup requirement

Take consistent backups of:

1. PostgreSQL (`pg_dump` or the host's managed backup)
2. The entire `UPLOAD_DIR` tree

Restore order: database first, then files, then start the API. File keys in `FileAsset` must match files on disk.

## Rollback procedure

1. Keep the previous `frontend/dist` and `backend/dist` artifacts.
2. Stop the new process. Restore the previous artifacts and previous environment file.
3. **Do not** run `prisma migrate reset` or `prisma db push`.
4. If a new migration is incompatible, restore the last PostgreSQL dump **and** the matching `UPLOAD_DIR` snapshot, then start the previous API build.
5. Confirm `/api/v1/health/ready` and a staff login before changing DNS back, if DNS was switched.

## Post-deploy smoke test

1. `GET https://<origin>/api/v1/health/live` → `{ "status": "ok" }`
2. `GET https://<origin>/api/v1/health/ready` → `{ "status": "ready" }`
3. Open `/` over HTTPS (SPA).
4. Sign up a throwaway student on production (not the QA address).
5. Log in as Super Admin and create one unpublished draft course (no real curriculum required).
6. Upload one small MP4 and one small PDF, publish a free lesson, confirm student playback and PDF open.
7. Restart the API process and confirm the same files still stream (volume persistence).
8. Confirm a paid lesson stays locked until an admin enrollment.

If step 7 fails, the host disk is ephemeral — stop publishing real media until a persistent volume is attached.
