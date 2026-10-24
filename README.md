# Dana Operations

Multi-branch operations data management for Dana Company. Branches record
structured operational data, managers review and approve it, and leadership
gets scoped dashboards, reports and exports — all backed by PostgreSQL with
server-enforced role and branch isolation.

## Features

- **Branch and region management** — create, edit and deactivate branches,
  assign managers, and group branches into regions.
- **Structured records** — configurable record categories with typed custom
  fields (text, number, decimal, date, boolean, select).
- **Approval workflow** — draft, submit, approve, reject, return, resubmit,
  archive and restore with a full approval timeline and comments.
- **Role-based access control** — four roles, branch and region scoping
  enforced on the server for every page, action and export.
- **Dashboards** — scoped KPIs, status/category/branch breakdowns, pending
  approvals, recent activity and per-branch summaries. Every number comes from
  the database.
- **Reports and exports** — filterable, server-paginated reports with CSV,
  XLSX and PDF export.
- **User administration** — create and edit users, assign branches/regions,
  activate or deactivate accounts, change your own profile and password.
- **Notifications** — in-app notifications for submissions, review decisions
  and assignments, with read/unread state.
- **Audit logs** — append-only trail of mutations and sign-ins, visible to
  super admins.
- **Private attachments** — MIME/size-validated uploads stored outside
  `public/`, streamed only to users who can see the record.
- **Security** — bcrypt password hashing, httpOnly Auth.js sessions, rate
  limiting, same-origin checks for mutations, RLS on all tables, CSP and
  security headers.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16.4 (App Router, React 19) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4, shadcn/ui (Base UI primitives), Lucide |
| Charts | Recharts |
| Forms | React Hook Form + Zod 4 |
| Auth | Auth.js v5 (Credentials, JWT sessions), bcryptjs |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | Supabase PostgreSQL (PostgreSQL 15+) |
| Exports | ExcelJS (XLSX), pdf-lib (PDF), RFC 4180 CSV |
| Tests | Vitest |

## Getting started

### Prerequisites

- Node.js 22 (Next.js 16 requires Node 20.9+; the Docker image uses Node 22)
- npm
- A PostgreSQL 15+ database (Supabase project recommended)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` and `DIRECT_URL` for your database, then generate an
auth secret:

```bash
openssl rand -base64 32
```

See [Environment variables](#environment-variables) for every option.

### 3. Apply migrations

```bash
npx prisma migrate deploy
```

For local schema iteration use `npx prisma migrate dev` instead.

### 4. Seed demo data (optional)

Set a password for the seeded accounts, then seed. The value is never committed:

```bash
SEED_PASSWORD='choose-a-strong-password' npx prisma db seed
```

The seed is idempotent: re-running it adds missing demo data and never deletes
records. Re-running also resets every seeded account to `SEED_PASSWORD`.

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with a demo account.

## Demo accounts

Every seeded account uses the value you supplied as `SEED_PASSWORD`; it is not
stored in the repository. The accounts exist only after running the seed.

| Email | Role | Scope |
| --- | --- | --- |
| `superadmin@dana.com` | Super Admin | All branches, users, settings, audit |
| `regional.na@dana.com` | Regional Manager | North America (DET, TOR) |
| `regional.eu@dana.com` | Regional Manager | Europe (MUC, LON) |
| `branch.manager@dana.com` | Branch Manager | Detroit (DET) |
| `employee@dana.com` | Branch Employee | Detroit (DET) |
| `munich.manager@dana.com` | Branch Manager | Munich (MUC) |
| `munich.employee@dana.com` | Branch Employee | Munich (MUC) |
| `chennai.manager@dana.com` | Branch Manager | Chennai (CHN) |
| `chennai.employee@dana.com` | Branch Employee | Chennai (CHN) |

> These credentials are demo-only. Change or remove seeded accounts before
> exposing an environment to real users. Use a unique `SEED_PASSWORD` for any
> shared environment, and never reuse a production password locally.

Seeded branches: DET, TOR, MUC, LON, CHN, SIN, SYD, grouped into NA, EU and
APAC regions. Seeded categories: Daily Operations, Quality and Logistics.

## Roles and permissions

| Capability | Super Admin | Regional Manager | Branch Manager | Branch Employee |
| --- | :---: | :---: | :---: | :---: |
| View scoped branches/records | ✅ | ✅ | ✅ | ✅ |
| Create/edit own drafts | ✅ | — | ✅ | ✅ |
| Submit for approval | ✅ | — | ✅ | ✅ |
| Approve / reject / return | ✅ | ✅ | ✅ | — |
| Archive / restore records | ✅ | — | ✅ | — |
| View reports | ✅ | ✅ | ✅ | ✅ |
| Export CSV/XLSX/PDF | ✅ | ✅ | ✅ | — |
| Manage branches | ✅ | — | — | — |
| Manage users | ✅ | — | — | — |
| Manage settings/categories/regions | ✅ | — | — | — |
| View audit logs | ✅ | — | — | — |

**Data scoping**

- Super admins see everything.
- Regional managers see branches in their assigned regions.
- Branch managers and employees see their assigned branches.
- Regional managers may review records only inside their regions; branch staff
  only inside their branches.
- Records remain invisible (404, not 403) outside a user's scope to avoid
  leaking existence.

Capabilities are defined in `lib/permissions.ts`. Scoping filters are built in
`lib/access.ts` and always applied as the first `AND` term, so user-supplied
filters can only narrow a result set, never widen it.

## Workflow

```
            submit                 approve
  DRAFT ───────────▶ SUBMITTED ───────────▶ APPROVED
    ▲                   │  │                  │
    │      return       │  │ reject           │ archive
    ├───────────────────┘  └──────────▶ REJECTED
    │                                      │
    └──────────── resubmit ◀───────────────┘
  RETURNED ── submit ──▶ SUBMITTED

  APPROVED / REJECTED / RETURNED / DRAFT ── archive ──▶ ARCHIVED
  ARCHIVED ── restore ──▶ APPROVED (super admin / branch manager)
```

- Only `DRAFT` and `RETURNED` records are editable.
- Only `DRAFT` and `RETURNED` records can be submitted.
- `SUBMITTED` records cannot be archived and must be reviewed first.
- Self-approval is blocked by default (`workflow.allowSelfApproval` in
  Settings). The approval queue also excludes records you submitted while the
  setting is off.
- Every transition writes an `ApprovalHistory` row, an `AuditLog` row and
  notifications for the relevant users.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build (standalone output) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run format` | Prettier |

Useful Prisma commands:

```bash
npx prisma migrate dev --name change_name   # create + apply a migration
npx prisma migrate deploy                   # apply pending migrations
npx prisma db seed                          # idempotent demo data
npx prisma studio                           # browse the database
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Runtime PostgreSQL connection string. Used by Prisma via `@prisma/adapter-pg`. |
| `DIRECT_URL` | Yes | Migration/seed connection string. Used by `prisma.config.ts` and the seed. |
| `AUTH_SECRET` | Yes | Auth.js signing/encryption secret. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | Production | Canonical app URL, e.g. `https://ops.example.com`. |
| `AUTH_TRUST_HOST` | Behind proxy | Set `true` when the app runs behind a trusted reverse proxy/load balancer. |
| `COMPANY_TIMEZONE` | No | Fallback IANA timezone until settings are saved. Defaults to `Asia/Kolkata`. |
| `UPLOAD_DIR` | No | Private attachment directory, relative to the project root. Defaults to `./storage/attachments`. Must be writable and persisted. |
| `MAX_UPLOAD_MB` | No | Per-attachment size limit. Defaults to `10`. |

TLS: the example URLs use `sslmode=verify-full` with
`sslrootcert=./certs/supabase-ca-chain.crt`. The committed bundle contains the
Supabase root and intermediate certificates. Keep the `certs/` directory next
to the deployed app, or point `sslrootcert` at your provider's CA bundle.

## Project structure

```
app/
  (app)/                 Authenticated pages (dashboard, records, reports, …)
  api/                   Route handlers (records, users, exports, health, …)
  login/                 Sign-in page
components/
  ui/                    shadcn/ui primitives
  shared/                PageHeader, TableShell, Pagination, StatusBadge, …
  records/ branches/ users/ settings/ account/ charts/ layout/
lib/
  services/              Server-side business logic (the source of truth)
  exports/               CSV, XLSX and PDF generation
  records/               Dynamic field validation and serialization
  auth.ts session.ts access.ts permissions.ts
  storage.ts rate-limit.ts audit.ts notifications.ts settings.ts
prisma/
  schema.prisma          Models, enums and indexes
  migrations/            SQL migrations (including RLS hardening)
  seed.ts                Idempotent demo data
tests/                   Vitest unit tests
certs/                   Supabase CA chain for verify-full TLS
docs/                    Deployment and security guides
```

**Architecture rule:** pages and route handlers contain no business rules.
They load a session scope, call a service in `lib/services/`, and render or
serialize the result. Services call `assert*` helpers and scoped Prisma
queries, then write audit entries.

## Testing

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The unit suite covers permission decisions (including self-approval and
archive rules), formatting, workflow field validation, CSV escaping and export
filenames, and user validation. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
for the pre-deployment checklist.

## Documentation

- [Deployment guide](docs/DEPLOYMENT.md) — Node and Docker, Supabase
  connections, migrations, storage, backups and upgrades.
- [Security guide](docs/SECURITY.md) — authentication, authorization, RLS,
  uploads, headers, secrets and the production checklist.

## License

Proprietary — Dana Company. All rights reserved.
