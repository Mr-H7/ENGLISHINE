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
- Process supervisor (systemd, PM2, or the host's process manager)
- Off-host backups for PostgreSQL **and** media (R2 bucket or local upload volume)
- Cloudflare R2 bucket `englishine-media` when `STORAGE_DRIVER=r2` (private, no public access)

Recommended topology (preserves the proven local cookie/auth behavior):

1. Serve the SPA and API on **one HTTPS origin**.
2. Reverse-proxy `/api/` to Fastify on `127.0.0.1:3001` **without rewriting the path**.
3. Leave `VITE_API_URL` unset when building the frontend so the SPA calls same-origin `/api/v1`.
4. Set `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`, `TRUST_PROXY=true`.

Do not put this API on a serverless host. Video Range streaming and large multipart uploads need a long-running Fastify process.

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

Local `./storage/uploads` is gitignored and is **not** production R2 storage.

## Environment variables

Copy `backend/.env.production.example` into the host secret store. Never commit real values.

| Variable | Production |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `127.0.0.1` when the proxy is on the same machine |
| `PORT` | `3001` (or the port the proxy targets) |
| `TRUST_PROXY` | `true` behind nginx/Caddy |
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

- Leave `VITE_API_URL` unset for same-origin `/api/v1`.
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

On the API host, in `backend/`:

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start
```

`npm start` runs `node dist/server.js`. `npm run build` runs `prisma generate` then `tsc`.

Do not start with `npm run dev` or `tsx watch` in production.

Point the process manager at `backend/` with the production environment and `Restart=on-failure`. Fastify listens on `HOST:PORT` and shuts down on `SIGINT`/`SIGTERM`.

## Frontend deployment procedure

On a CI job or the same host, in `frontend/`:

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
