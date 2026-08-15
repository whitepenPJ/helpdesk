@AGENTS.md

# Helpdesk App

A support ticketing system: customers file tickets, agents/admins triage and resolve them.

## Stack

- **Next.js 16** (App Router, TypeScript) — see `AGENTS.md` above; this version has breaking changes from training data (e.g. `proxy.ts` replaces `middleware.ts` and defaults to the **Node.js runtime** — not Edge — as of v16, `use cache`/Cache Components is opt-in). Check `node_modules/next/dist/docs/` before assuming an API.
- **Supabase** — used only as a hosted **Postgres** database (via its connection pooler). Not using Supabase Auth, Storage, Realtime, or the JS client — application code talks to Postgres exclusively through Prisma. See "Database & Prisma" below, since Prisma 7's connection model doesn't work the way older Prisma versions (or generic Supabase+Prisma guides) describe.
- **Prisma 7** — ORM for all application queries. Significantly different from Prisma 5/6: custom generator output path, mandatory driver adapters, `prisma.config.ts`. See "Database & Prisma" below before touching `prisma/schema.prisma` or writing a query — do not assume pre-v7 conventions.
- **Auth.js / NextAuth v5** (`next-auth@beta`) — Credentials (email + bcrypt password) and Microsoft Entra ID (Azure AD) OAuth. See "Auth & authorization" below.
- **AdminLTE 4** (Bootstrap 5) — the UI theme. No Tailwind. Compiled CSS/JS is copied from the vendored `AdminLTE-master/` source into `public/adminlte/` (`css/adminlte.min.css`, `js/adminlte.min.js`) and linked with plain `<link>`/`next/script` tags — not installed as an npm/SCSS dependency. `AdminLTE-master/` itself is git-ignored; treat it as a reference for markup/assets to copy from, not something the app imports at runtime. Bootstrap Icons and the Source Sans 3 font load from CDN, matching the theme's own example pages (`AdminLTE-master/dist/examples/`).

## Next.js route structure for this theme

AdminLTE's auth pages (login/register/forgot-password) and its dashboard shell (sidebar + navbar) need different `<html>`/`<body>` markup and different vendor scripts (dashboard needs Bootstrap JS, Popper, OverlayScrollbars, and `adminlte.js` for the sidebar; auth pages don't). Use Next's **multiple root layouts** pattern (route groups, each with its own root layout defining `<html>`/`<body>`) rather than one shared root layout with conditional logic:

- `app/(auth)/layout.tsx` — root layout for `/login`, `/register`, `/forgot-password`. Loads only what those pages need (AdminLTE CSS, Bootstrap Icons, fonts, the no-flash theme-init script).
- `app/(dashboard)/layout.tsx` — root layout for the authenticated admin/agent/customer app, once it exists. Add sidebar/navbar chrome and the additional vendor scripts there, not to the auth layout.

Each root layout is self-contained (own `<html>`, `<body>`, `<head>` tags); don't reintroduce a single top-level `app/layout.tsx` alongside these groups.

## Database & Prisma

The Supabase Postgres database already has a full, populated schema and real
data (Company/Department/User/Category/Ticket/TicketComment/TicketApproval/
TicketHistory/UserGroup/PushSubscription/SystemSetting/AuditLog) — it was not
created by this app's early scaffolding and predates the frontend work in
this repo. **Never run `prisma migrate reset` or otherwise drop/recreate the
schema.** `prisma/schema.prisma` was built by introspecting (`prisma db
pull`) that live database, then adding only the Auth.js tables (`Account`,
`Session`, `VerificationToken`) and a `User.emailVerified` column, additively.
Treat the existing models as fixed unless the user explicitly asks to change
them — extend, don't rewrite.

Prisma 7 breaking changes vs. what older docs/training data assume:
- Generator is `provider = "prisma-client"` (not `prisma-client-js`) with a
  **required custom `output`** — this project generates to
  `app/generated/prisma`, imported as `@/app/generated/prisma/client`. It is
  git-ignored and regenerated via `npx prisma generate` (also runs
  automatically on `npm install` via the `postinstall` script).
- Config lives in `prisma.config.ts` (datasource URL, migrations path), not
  solely in `schema.prisma`/`.env`. `.env` is still loaded (via `dotenv`) and
  still holds `DATABASE_URL`.
- **Driver adapters are mandatory** for SQL providers — `@prisma/adapter-pg`
  + `pg`. Every `PrismaClient` instantiation (`app/lib/db.ts`, `auth.ts`,
  `prisma/seed.ts`) constructs a `PrismaPg` adapter from `DATABASE_URL` and
  passes it as `{ adapter }`; there's no plain `new PrismaClient()`.
- `DATABASE_URL` points at Supabase's pooler in **session mode** (port 5432,
  not 6543/pgbouncer transaction mode), which is why one URL works for both
  `prisma migrate` and normal app queries — no separate `directUrl` needed.
- Before assuming any other v7 API, check `.claude/skills/prisma-*/` —
  `prisma init` installed Prisma's own current-version reference skills
  (client API, CLI, v6→v7 upgrade/breaking-changes, driver adapters) into
  this repo; they're authoritative for this exact installed version and
  should be treated as more current than training data.

## Auth & authorization

- **Auth.js v5** (`next-auth@beta`), configured in root-level `auth.ts`, exporting `{ handlers, auth, signIn, signOut }`. Route handler at `app/api/auth/[...nextauth]/route.ts` just re-exports `handlers`.
- Two providers: **Credentials** (email + password, checked against `User.passwordHash` with bcrypt, blocks non-`ACTIVE` `status`) and **Microsoft Entra ID / Azure AD** (`AZURE_AD_CLIENT_ID`/`SECRET`/`TENANT_ID`). `PrismaAdapter(prisma)` persists OAuth accounts; a brand-new Azure AD sign-in defaults to `role: USER` — promote manually if needed.
- **Session strategy is `jwt`**, not `database` — required because a Credentials provider is present (Auth.js constraint, not a choice). `role` and `id` are copied onto the token in the `jwt` callback and onto `session.user` in the `session` callback; the shape is declared via module augmentation in `next-auth.d.ts` (note: `@auth/core`'s own callback types import `JWT` from `@auth/core/jwt` directly, not through the `next-auth/jwt` re-export — augment **both** modules or the `session` callback's `token` param types as `unknown`).
- **Route protection lives in `proxy.ts`** at the project root. Because this Next.js version runs Proxy on the **Node.js runtime by default** (not Edge), it can import the full `auth.ts` — including Prisma — directly; no need for the Edge-safe split-config pattern common in older Auth.js/Next.js guides. It redirects unauthenticated requests to `/login?callbackUrl=<path>`, and redirects already-authenticated users away from `/login`. Since the session is JWT-based, this check never actually hits the database (decodes the session cookie only) even though the full config is in scope.
- Real authorization (role checks, ticket ownership) still happens server-side, close to the data — in Server Actions, calling `auth()` directly (App Router server-side helper) rather than trusting client state. Proxy is a UX redirect, not the security boundary.
- Roles: `Role` enum — `ADMIN`, `SUPERVISOR`, `USER` (see the real schema, not an invented one). Gate admin/supervisor views and actions on `session.user.role`, checked server-side.
- Demo accounts (`admin@demo.com`, `supervisor@demo.com`, `user1@demo.com`, `user2@demo.com`, all password `P@ssw0rd`) already exist in the database; `prisma/seed.ts` upserts them idempotently (creates with a faker-generated name only if missing — never overwrites an existing user).

## Data mutations

- Mutate through **Server Actions** (`'use server'`), not client-side fetch to hand-rolled API routes, unless building a webhook or external-facing endpoint (then use a Route Handler under `app/api/`).
- Every Server Action re-verifies the session and role — it's a public endpoint reachable directly via POST, not just from the UI it's wired to.
- After a mutation, `revalidatePath`/`revalidateTag` the affected ticket list/detail views, or call `refresh()` from `next/cache` to refresh the current view.

## Caching

- Cache Components (`cacheComponents: true`, the `use cache` directive) is **not enabled** (see `next.config.ts`) — the app uses the default caching model. Don't add `"use cache"` directives unless Cache Components is explicitly turned on.
- Ticket/comment data is per-user and mutates often — default to dynamic rendering (reading `cookies()`/session) for ticket views rather than fetch-caching them.

## Data model (Prisma)

The real, already-live schema (`prisma/schema.prisma` — read it directly for exact fields; this is a summary, not the source of truth):

- `User` — name, email, `passwordHash` (nullable — null for OAuth-only accounts), `role` (`ADMIN`/`SUPERVISOR`/`USER`), `status` (`ACTIVE`/`INACTIVE`/`SUSPENDED`), `isAssignee`, `image`, `telephone`, optional `companyId`/`departmentId`/`userGroupId`. Plus Auth.js's `Account`/`Session` relations and `emailVerified`.
- `Company` → `Department` (with an optional `supervisorId` → `User`) → `Ticket`.
- `Ticket` — `ticketNumber`, `title`, `description`, `status` (`NEW`/`ASSIGNED`/`RESOLVED`/`VERIFIED`/`REOPENED`/`CLOSED`), `priority` (`LOW`/`MEDIUM`/`HIGH`/`URGENT`), `category`, `company`/`department`, `createdBy`/`assignee`/`assignedGroup` (`User`/`UserGroup`), `rating` (post-resolution CSAT), `attachments` (string array), SLA-ish timestamps (`closedAt`/`resolvedAt`/`autoCloseDueDate`).
- `TicketComment`, `TicketHistory` (audit trail of ticket state changes), `TicketApproval` (supervisor approve/reject workflow, one-to-one with `Ticket`).
- `Category`, `CategoryAdmin` (which admins own which category), `UserGroup` (ticket assignment pools).
- `PushSubscription`, `SystemSetting`, `AuditLog` — supporting infrastructure.

Don't invent parallel models for things this schema already covers (e.g. don't add a new `Comment` model — it's `TicketComment`).

## Environment variables

- `DATABASE_URL` — Supabase Postgres, pooler host in **session mode** (port 5432). Used directly by Prisma via the `@prisma/adapter-pg` driver adapter for both migrations and runtime queries; see "Database & Prisma" above.
- `AUTH_SECRET` — Auth.js JWT signing secret.
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` — Microsoft Entra ID OAuth app registration, consumed by the `microsoft-entra-id` provider in `auth.ts` (issuer built as `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/v2.0`).
- `EMAIL_PROVIDER`, `EMAIL_FROM`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `SMTP_*` — present in `.env` for transactional email (e.g. ticket notifications) but **not yet wired to any code** — no email-sending module exists yet.

## Project structure

- `app/` — routes only (App Router file conventions: `page`, `layout`, `loading`, `error`, route groups like `(auth)`/`(dashboard)`).
- `app/actions/` — Server Actions (`'use server'` files), grouped by domain (`tickets.ts`, `comments.ts`, `auth.ts`).
- `app/lib/` — `db.ts` (Prisma client singleton, built with the `pg` driver adapter). Add `dal.ts`/`dto.ts` here as ticket-domain data access grows.
- `auth.ts` (project root) — Auth.js config; `next-auth.d.ts` (project root) — Session/JWT type augmentation.
- `prisma/schema.prisma` — single source of truth for the data model; run `npx prisma generate` after edits (also runs automatically post-`npm install`). Generated client output (`app/generated/prisma/`) is git-ignored.
- Colocate route-specific UI as private folders (`_components/`) inside the relevant `app/` segment; put genuinely shared UI in a top-level `components/` or `app/components/`.

## Styling

- Use Bootstrap 5 utility/component classes and AdminLTE's own classes (`.login-page`, `.card`, `.input-group`, etc.), matching the markup in `AdminLTE-master/dist/examples/`. Convert the theme's static HTML to JSX (e.g. `class` → `className`, `for` → `htmlFor`, self-close void elements) rather than redesigning from scratch.
- Theme (light/dark) is controlled by `data-bs-theme` on `<html>`, set by the inline no-flash script in each root layout and persisted to `localStorage` under `lte-theme` — the same mechanism AdminLTE's own pages use.
- Don't add Tailwind back; if a one-off style is needed beyond Bootstrap/AdminLTE, use a scoped CSS file or inline `style`, not a new utility framework.
