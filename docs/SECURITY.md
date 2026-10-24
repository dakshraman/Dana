# Security guide

This document describes the security controls in Dana Operations, their
boundaries, and the checks required before exposing an environment to real
users.

## Authentication

- **Credentials provider only.** Users sign in with email and password through
  Auth.js v5. There are no public sign-up endpoints; accounts are created by
  an administrator or the seed.
- **Password hashing.** Passwords are hashed with bcrypt at cost 12 in
  `lib/services/users.ts` and `prisma/seed.ts`. Plaintext passwords are never
  stored, logged or returned by an API.
- **Timing-resistant failures.** A failed sign-in for an unknown email still
  runs a bcrypt comparison against a fixed dummy hash, reducing the timing
  difference between "unknown user" and "wrong password".
- **Session cookies.** Auth.js issues an encrypted JWT in an `httpOnly`,
  `SameSite=Lax` cookie; the `Secure` flag is applied on HTTPS deployments.
  Sessions expire after 8 hours and are refreshed at most hourly.
- **Fresh authorization data.** The JWT carries only the user id and role hint.
  `requireApiUser` / `requirePageUser` reload the user and their branch/region
  assignments from the database on every request. A deactivated user or a
  changed role takes effect on the next request, not when the token expires.
- **Login throttling.** Failed attempts are persisted in `LoginAttempt`.
  Ten failures within 15 minutes block further attempts for that email/IP
  window. Successful sign-ins are audited.

### Not implemented

- Multi-factor authentication.
- Self-service password reset and email verification (no mail provider is
  configured).
- External identity providers (OIDC/SAML).

If these are required, add them deliberately rather than weakening the current
credentials flow.

## Authorization

Authorization is enforced on the server; the UI only hides actions that the
server would reject.

- **Capabilities.** `lib/permissions.ts` maps the four roles to capabilities
  (`canApproveRecords`, `canManageUsers`, `canExport`, …). Pure functions make
  the rules unit-testable.
- **Route protection.** Protected pages live under the `(app)` route group.
  Its server layout calls `requirePageUser` / `requirePageScope`, which reload
  the user from the database and redirect unauthenticated requests to
  `/login?callbackUrl=…`. There is no edge middleware doing an optimistic
  cookie check; the server layout runs on the Node runtime and is the
  authoritative gate.
- **Scope.** `lib/access.ts` builds Prisma `where` fragments for the user's
  branches and regions. Scope is always the first `AND` term in a query, so a
  user-supplied filter can only narrow results.
- **Record access.** Every record query includes the scope filter. An
  out-of-scope record returns **404**, not 403, so its existence is not
  disclosed. The same check guards downloads and attachments.
- **Mutation checks.** Submit, review, archive and restore re-load the record
  and call `canSubmitRecord` / `canReviewRecord` / `canArchiveRecord`. The
  service layer, not the route handler, is the enforcement point.
- **Self-approval.** `workflow.allowSelfApproval` (default off) blocks a
  reviewer from approving a record they submitted. The approval queue also
  excludes those records while the setting is off.
- **Administration.** User, branch, region and settings mutations call
  `assertCanManage*`; the corresponding GET endpoints for users and settings
  also require the matching capability.
- **Last-admin protection.** Deactivating or demoting the last active super
  admin is rejected, and users cannot deactivate themselves.

## Database and RLS

- All 17 public tables have **Row Level Security enabled** and no policies.
  `anon`, `authenticated` and `service_role` have all table, sequence and
  function grants revoked, including default privileges for future objects.
- The application connects as the `postgres` table owner, which bypasses RLS.
  This is intentional: authorization is enforced in the service layer, and RLS
  is a second barrier that blocks accidental exposure through Supabase's
  public REST/GraphQL APIs or a leaked anon key.
- Never expose the database password or a `service_role` key to the browser.
  The app does not use Supabase client-side SDKs or Supabase Auth.
- Prisma uses parameterized queries. Dynamic SQL is limited to controlled
  identifiers; user input is never interpolated into SQL.
- TLS uses `verify-full` with the Supabase CA chain. On Netlify the CA is
  supplied through `DATABASE_SSL_CA` (see the deployment guide).

## API protections

- **Same-origin checks.** `assertSameOrigin` rejects state-changing requests
  whose `Origin` host does not match the request host. Combined with
  `SameSite=Lax` session cookies, this blocks cross-site form/fetch attacks.
- **Schema validation.** Every request body and query string is parsed with
  Zod. Unknown fields are rejected, numbers are range-checked, dates are real
  calendar dates and select values must be in the configured option list.
- **Rate limiting.** In-process fixed-window limits apply to:

  | Operation | Limit |
  | --- | --- |
  | Create record | 60/min |
  | Upload attachment | 30/min per user |
  | Create user / branch | 20/min |
  | Report export | 12/min |
  | Change password | 5 / 15 min per user |

  Login is additionally protected by the persistent `LoginAttempt` check.
- **Errors.** `errorResponse` returns a stable `{ error: { code, message } }`
  shape. Database errors and stack traces are not returned to clients.
- **Exports** are generated server-side from scoped queries. Export requests
  are rate-limited and audited.

### Rate limiter limitation

The limiter in `lib/rate-limit.ts` is per process. Netlify may run several
function instances, so limits are approximate under horizontal scale. For hard
guarantees, replace the bucket store with Redis/Upstash or enforce limits at
the edge. The login throttle is database-backed and is not affected by this
limitation.

## Uploads

- Only PDF, PNG, JPEG, WebP, plain text, CSV, XLS and XLSX are accepted, by
  MIME type. File names are sanitized and storage keys are random UUIDs.
- Size is capped by `MAX_UPLOAD_MB` (default 10; use ≤ 4 on Netlify because of
  the function payload limit).
- Files are stored privately. The filesystem driver writes under
  `UPLOAD_DIR` with mode `0600` and rejects path traversal. The database driver
  stores bytes in `Attachment.data`.
- Downloads are scoped by record access, streamed through a route handler and
  sent with:

  ```
  Content-Disposition: attachment
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'none'; sandbox
  Cache-Control: private, no-store
  ```

  Browser rendering of uploaded HTML/SVG is not possible because those types
  are not accepted.
- Uploads and deletes are audited.

## Audit logging

`AuditLog` records sign-ins, record creation/updates, workflow transitions,
user/branch/settings changes, exports and attachment operations. Entries
include actor, action, entity, summary, optional metadata and timestamp.
Regular users cannot read audit logs; only super admins can. Treat the table as
append-only and include it in backups and retention policy.

## HTTP security headers

`next.config.ts` applies to every route:

- `Content-Security-Policy`: `default-src 'self'`; no framing, objects or
  external script/style origins. `'unsafe-inline'` is required for Next.js
  bootstrap scripts until a nonce-based policy is implemented. Development adds
  `'unsafe-eval'` and WebSocket origins.
- `Strict-Transport-Security` in production.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: camera, microphone, geolocation and payment disabled.
- `Cross-Origin-Opener-Policy: same-origin`
- `X-Powered-By` is disabled.

## Secrets

- `.env` is git-ignored; only `.env.example` is committed.
- Keep `AUTH_SECRET`, the database password and any future object-storage keys
  in the platform secret store (Netlify environment variables, a vault, or
  CI secrets). Never put them in `NEXT_PUBLIC_*` variables.
- The Supabase CA bundle is public material and may be committed.
- Rotate `AUTH_SECRET` to invalidate all sessions. Rotate the database password
  in Supabase and update `DATABASE_URL`/`DIRECT_URL` together.
- Do not run `prisma db seed` against production; it creates demo accounts with
  the password you pass in `SEED_PASSWORD`. Use a unique value and rotate it
  before sharing the environment.

## Production checklist

**Identity**

- [ ] Rotate or delete every seeded demo account; remove `superadmin@dana.com`
      or change its password to a unique, strong value.
- [ ] Create named administrator accounts; do not share credentials.
- [ ] Confirm `AUTH_SECRET` is unique per environment and at least 32 bytes.
- [ ] Confirm `AUTH_URL` is the canonical HTTPS origin and HTTP redirects.

**Data**

- [ ] RLS still enabled on all public tables; Supabase security advisors show
      no new errors.
- [ ] `anon`/`authenticated` still have no table grants.
- [ ] Backups/PITR enabled; restore tested.
- [ ] Attachment storage configured (`database` on Netlify) and upload limit
      set below the platform body limit.

**Runtime**

- [ ] `/api/health` monitored.
- [ ] TLS verification enabled (`DATABASE_SSL_CA` or `sslrootcert`).
- [ ] Rate limits reviewed for expected traffic; move to a shared store if
      running multiple instances.
- [ ] Audit log access and retention reviewed.
- [ ] Dependency alerts (Dependabot/Renovate) enabled; `npm audit` reviewed.

**Operational**

- [ ] Error monitoring/alerting configured (no stack traces in responses).
- [ ] Log retention configured; logs contain no passwords or session tokens.
- [ ] Incident contact and rollback procedure documented.
