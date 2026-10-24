# Deployment guide

This guide covers the production Netlify deployment (the primary target) and a
self-hosted Node/Docker alternative. The application is a standard Next.js 16
App Router build with a PostgreSQL database, private attachments and Auth.js
sessions.

## Architecture on Netlify

```
Browser ──HTTPS──▶ Netlify edge / Next.js runtime
                        │
                        ├── Server Components, Route Handlers (Functions)
                        │        │
                        │        ├── Supabase transaction pooler (IPv4, 6543)
                        │        └── PostgreSQL (attachments when
                        │            ATTACHMENT_STORAGE=database)
                        └── Static assets / optimized images
```

Two platform constraints drive the configuration:

1. **Netlify Functions are IPv4-only.** New Supabase projects expose the
   direct database host over IPv6 only. Use the Supabase **transaction
   pooler** (port `6543`) for `DATABASE_URL`.
2. **Netlify's filesystem is ephemeral and read-only.** Local attachment
   storage cannot survive a deploy or a cold start. Set
   `ATTACHMENT_STORAGE=database`, which stores attachment bytes in PostgreSQL.
   See [Attachments](#attachments).

## 1. Prepare the database

Use the pooler hostname for your project's region. For this project it is
`aws-0-ap-northeast-1.pooler.supabase.com` (Tokyo). The pooler username is
`postgres.<project-ref>`, not plain `postgres`.

| Purpose | Host / port | User |
| --- | --- | --- |
| Runtime (`DATABASE_URL`) | `aws-0-ap-northeast-1.pooler.supabase.com:6543` | `postgres.<project-ref>` |
| Migrations (`DIRECT_URL`) | same pooler on `:5432`, or the direct host on `:5432` | same |

Migrations must run from a machine that can reach `DIRECT_URL`. Netlify's build
does **not** run migrations.

```bash
# From the repository root, with DIRECT_URL pointing at the session pooler or
# the direct database host:
npx prisma migrate deploy
```

Use the session pooler (port `5432`) for migrations if your CI runner has no
IPv6 connectivity. Do not run `prisma db seed` against production unless you
intentionally want demo users and records.

### TLS

The runtime verifies the Supabase certificate chain. Locally and in Docker the
connection strings use:

```
?sslmode=verify-full&sslrootcert=./certs/supabase-ca-chain.crt
```

On Netlify the certificate file is not guaranteed to be on disk, so set
`DATABASE_SSL_CA` to the PEM contents of `certs/supabase-ca-chain.crt`. When
that variable is present, `lib/db.ts` removes `sslmode`/`sslrootcert` from the
URL and builds an explicit `ssl: { ca, rejectUnauthorized: true }` config.

```bash
netlify env:set DATABASE_URL \
  'postgresql://postgres.YOUR_PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres' \
  --context production

netlify env:set DATABASE_SSL_CA "$(cat certs/supabase-ca-chain.crt)" \
  --context production

netlify env:set DIRECT_URL \
  'postgresql://postgres.YOUR_PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=./certs/supabase-ca-chain.crt' \
  --context production
```

`DIRECT_URL` is needed at build time because `prisma generate` loads
`prisma.config.ts`. It is not used by the running application.

> URL-encode special characters in the password (`@` → `%40`, `#` → `%23`,
> `:` → `%3A`).

## 2. Configure environment variables

Set these for the **production** context (and for deploy previews if you use
them):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler URL, port 6543 |
| `DATABASE_SSL_CA` | PEM contents of `certs/supabase-ca-chain.crt` |
| `DATABASE_POOL_MAX` | `2` or `3` per function instance |
| `DIRECT_URL` | Session pooler/direct URL used by Prisma CLI |
| `AUTH_SECRET` | `openssl rand -base64 32` (different per environment) |
| `AUTH_URL` | `https://<site-name>.netlify.app` or the custom domain |
| `AUTH_TRUST_HOST` | `true` |
| `ATTACHMENT_STORAGE` | `database` |
| `MAX_UPLOAD_MB` | `4` (Netlify Functions cap request bodies at ~6 MB) |
| `COMPANY_TIMEZONE` | e.g. `Asia/Kolkata`, `America/Detroit` or `UTC` |
| `NEXT_TELEMETRY_DISABLED` | `1` (already set in `netlify.toml`) |

Do not set `UPLOAD_DIR` on Netlify; it is ignored by the database driver.

```bash
netlify env:set AUTH_SECRET "$(openssl rand -base64 32)" --context production
netlify env:set AUTH_URL "https://dana-operations.netlify.app" --context production
netlify env:set AUTH_TRUST_HOST "true" --context production
netlify env:set ATTACHMENT_STORAGE "database" --context production
netlify env:set MAX_UPLOAD_MB "4" --context production
netlify env:set DATABASE_POOL_MAX "3" --context production
```

List and inspect values with `netlify env:list --context production`.

## 3. Deploy with the Netlify CLI

The repository includes `netlify.toml` and `.nvmrc` (Node 22). The build command
is `npx prisma generate && npm run build`; Netlify's Next.js runtime produces
the server functions automatically.

```bash
# One-time: create and link the site.
netlify sites:create --name dana-operations
netlify link --name dana-operations

# Deploy a draft URL first.
netlify deploy --build

# Promote to production.
netlify deploy --build --prod --context production
```

> **Non-git checkouts:** the CLI resolves the workspace root from the nearest
> `.git` directory. If you deploy a plain directory that is not a git
> repository, a parent `package.json` can be mistaken for the workspace root;
> the CLI then looks for functions in the wrong `.netlify` folder and deploys
> the site without them (all routes return 404). Run `git init` in the project
> root before deploying. Verify the deploy output says `… 1 function` and that
> `/api/health` responds after the deploy.

Or connect the repository in the Netlify UI and let every push to the
production branch deploy. `netlify.toml` pins the Next.js runtime and Node 22.

First-deploy checklist:

```bash
npx prisma migrate deploy          # from CI or a workstation
netlify deploy --build --prod
curl -fsS https://<site>/api/health
```

> **Local `.env` and the function bundle.** When you deploy with the CLI from a
> workstation that has a `.env` file, Netlify's inline-env step copies those
> values into the function bundle. The linked site's environment variables
> still win at runtime (verify `/api/health` and sign-in), but for a clean
> artifact deploy from CI, or move `.env` aside for the deploy command. Do not
> commit `.env`.

`/api/health` returns `{"status":"ok","database":"up"}` and HTTP 200, or 503
when the database is unreachable. Point an uptime monitor at it.

## 4. Attachments

`ATTACHMENT_STORAGE=database` writes attachment bytes to the `Attachment.data`
column (`bytea`). This keeps the feature working on Netlify without an external
object store:

- Uploads are validated by MIME allowlist, per-file size limit and a random
  storage key.
- Downloads always go through `/api/attachments/[id]`, which checks record
  scope, sets `Content-Disposition: attachment`, `X-Content-Type-Options:
  nosniff` and a restrictive CSP.
- Deleting an attachment deletes the row (and therefore the bytes).
- Database backups include attachments. Retain the same backup window for the
  database and storage.

Limits and scaling:

- Netlify Functions limit request/response bodies to about 6 MB. Keep
  `MAX_UPLOAD_MB` at 4 or lower.
- PostgreSQL is not an object store. For large volumes, move attachments to
  Supabase Storage or S3 using a private bucket and signed URLs, and keep the
  same scope check before issuing a signed URL. The storage boundary is
  intentionally isolated in `lib/storage.ts`.

Local development and Docker keep using the filesystem driver
(`ATTACHMENT_STORAGE=filesystem`, `UPLOAD_DIR=./storage/attachments`).

## 5. Self-hosted Node deployment

For a VM/container platform with a persistent disk:

```bash
npm ci
npx prisma generate
npm run build

# Runtime environment
export DATABASE_URL='postgresql://...'
export DIRECT_URL='postgresql://...'
export AUTH_SECRET='...'
export AUTH_URL='https://ops.example.com'
export AUTH_TRUST_HOST='true'
export UPLOAD_DIR='./storage/attachments'

npx prisma migrate deploy
npm start
```

The build uses Next.js standalone output:

```
.next/standalone/server.js   # server entrypoint
.next/static/                # copy next to the server
public/                      # copy next to the server
certs/                       # required for verify-full TLS
```

Run `node .next/standalone/server.js` (or copy the standalone tree to the
runtime image) with `PORT`/`HOSTNAME` set. The included `Dockerfile` already
does this as a non-root user.

### Docker

```bash
docker build -t dana-operations .
docker run -d --name dana \
  --env-file .env.production \
  -p 3000:3000 \
  -v dana-storage:/app/storage \
  dana-operations
```

The image runs as UID/GID `1001` (`nextjs`). Make sure the mounted volume is
writable by that user. The image has a `HEALTHCHECK` against `/api/health`.

Behind a reverse proxy, forward `Host`, `X-Forwarded-Host` and
`X-Forwarded-Proto`, and set `AUTH_TRUST_HOST=true`. TLS terminates at the
proxy; the app also sends HSTS in production.

### Connection sizing

`node-postgres` creates a pool per application process. The default is 10
connections; override it with `DATABASE_POOL_MAX`. Keep:

```
instances × DATABASE_POOL_MAX < pooler connection limit
```

Supabase pool limits depend on compute size. On serverless platforms use 2–3.

## 6. Backups and restore

- Enable Supabase automated backups/PITR for the production project.
- For an independent logical backup:

  ```bash
  pg_dump "$DIRECT_URL" --format=custom --file=dana-$(date +%F).dump
  pg_restore --clean --if-exists --no-owner --dbname="$DIRECT_URL" dana-YYYY-MM-DD.dump
  ```

- With the database attachment driver, the database dump contains attachment
  bytes. With the filesystem driver, back up `UPLOAD_DIR` in the same job and
  restore it before the app serves traffic.
- Test a restore into a staging project at least once per quarter. A backup
  that has never been restored is not a backup.

## 7. Upgrades and rollbacks

1. Take a backup/snapshot.
2. Review the migration SQL. Prefer backward-compatible, two-phase changes
   (add nullable column → backfill → switch reads → drop later).
3. Run `npx prisma migrate deploy`.
4. Deploy the new build (`netlify deploy --prod` or rolling container
   restart).
5. Verify `/api/health`, sign-in, dashboard, one record transition and one
   export.

Netlify keeps immutable deploys, so the application can be rolled back from the
Deploys tab. Database migrations are forward-only in Prisma; a rollback of the
app must therefore remain compatible with the migrated schema. If a migration
is destructive, deploy it only after the old app version is no longer serving
traffic.

## 8. Production checklist

- [ ] `AUTH_SECRET` is unique and at least 32 random bytes.
- [ ] `AUTH_URL` matches the canonical HTTPS URL; HTTP redirects to HTTPS.
- [ ] `DATABASE_URL` uses the IPv4 pooler; `DIRECT_URL` works for migrations.
- [ ] `DATABASE_SSL_CA` is set and TLS verification succeeds.
- [ ] `ATTACHMENT_STORAGE=database`, `MAX_UPLOAD_MB` ≤ 4 on Netlify.
- [ ] Migrations applied; `/api/health` returns 200.
- [ ] Demo accounts removed or their passwords rotated; demo seed not run.
- [ ] Supabase backups/PITR enabled and a restore has been tested.
- [ ] Uptime monitor on `/api/health`.
- [ ] Audit log retention and access reviewed.
- [ ] Custom domain and DNS configured; Netlify HTTPS certificate issued.
