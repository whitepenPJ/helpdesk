# Helpdesk — Project Specification

## 1. Overview

Helpdesk is an internal support ticketing system. Customers file tickets against a
company/department/category; support staff triage, assign, and resolve them; a
supervisor sign-off gate can be inserted into a ticket's lifecycle when needed.

Three roles:

| Role | Who | Summary |
|---|---|---|
| `USER` | Customer / ticket requester | Files tickets, tracks their own and their group's tickets, closes and rates resolved tickets |
| `SUPERVISOR` | Approval authority for a department | Same ticket visibility as a `USER`, plus approves/rejects tickets routed to them |
| `ADMIN` | Support staff / operators | Full visibility, owns Ticket Management (assign, prioritize, status, route for approval) and all Master data |

Stack, at a glance: Next.js 16 (App Router) + TypeScript, Auth.js v5, Prisma 7 against
a Supabase-hosted Postgres database, AdminLTE 4 (Bootstrap 5) for UI. Full technical
detail is in [§4](#4-for-developers).

---

## 2. For Customers (`USER`)

### Getting started
Sign in with email/password or Microsoft (Entra ID). You land on **Ticket** — there is
no dashboard for this role.

### Sidebar
- **Ticket** *(count badge = your open tickets)* — tickets you filed
- **Assigned Ticket** *(count badge)* — tickets assigned to your user group, if you
  belong to one

### What you can do
- **File a new ticket**: title, description, category, telephone, company/department,
  and optional file attachments.
- **Track your tickets**: search/filter your ticket list by status; open any ticket to
  see its full detail — description, category, company/department, assignee, creation
  date, attachments.
- **Comment**: add comments to your own tickets, with optional file attachments.
- **Close & rate a resolved ticket**: once a ticket you filed reaches **RESOLVED**, a
  *Close Ticket* button appears on its detail page. Closing it asks you to rate your
  satisfaction on a 5-point face-icon scale (Very Dissatisfied → Very Satisfied) with an
  optional comment, then moves the ticket to **CLOSED**.
- **Notifications**: the bell in the top bar shows recent activity on your tickets
  (assignments, status changes) — not things you did yourself. Opening it marks
  everything read and clears the badge; "See All Notifications" opens the full,
  paginated history. You can also opt in to browser push notifications from the same
  dropdown.

### What you can't do
Access the Dashboard, Master data, or Transaction/Ticket Management — those routes
redirect you back to your own ticket list if visited directly.

---

## 3. For Staff (`SUPERVISOR` / `ADMIN`)

### 3.1 Supervisor

Lands on **Approval Ticket** after login — also no dashboard for this role. Sidebar:
**Approval Ticket** *(badge = pending decisions)*, **Ticket**, **Assigned Ticket** (same
as a customer's, for any tickets the supervisor personally filed or that are assigned
to their group).

**Approval Ticket** page lists every ticket an admin has routed to this supervisor for
sign-off (status **WAITING**), including the admin's message. For each:
- **Approve** — optional reason.
- **Reject** — reason required.

Either decision returns the ticket to whatever status it had right before it entered
WAITING, and the decision (with reason) is recorded in the ticket's history — which
surfaces automatically in the requesting admin's notification bell.

### 3.2 Admin

Full dashboard access, plus two admin-only sidebar sections:

**Master** — reference data management:
- **User**: create/edit/view users — name, email, role, status, company, department,
  user group, telephone.
- **Company**: companies and their departments (each department can have one
  supervisor, which is what routes approval requests).
- **User Group**: named pools tickets can be assigned to as a group (e.g. "IT Support").
- **Category**: ticket categories, each with one or more admins responsible for it.

**Transaction → Ticket Management** — the main working queue: *every* ticket
regardless of who filed it, grouped by status in a fixed priority order (NEW, WAITING,
REOPENED, RESOLVED, ASSIGNED, VERIFIED, CLOSED) and then by creation date. Each row has
three actions:
- **View** — read-only ticket detail.
- **Edit** — opens the ticket detail page in an inline edit panel.
- **More** (⋮) — the same editing capability in a popup instead of navigating away.

Both edit surfaces let you change: **assignee** (an ADMIN or SUPERVISOR user),
**assigned group**, **priority** (LOW/MEDIUM/HIGH/URGENT), and **status** — either
*Save* (keeps status, auto-promotes a freshly-assigned NEW/REOPENED ticket to
ASSIGNED), or one-click **Verified**/**Re-Open** (only enabled once the ticket is
RESOLVED).

**Request Approve** routes the ticket to its department's supervisor: pick a message,
send — the ticket moves to **WAITING** until the supervisor decides (§3.1).

Admins also see the same notification bell/`/notifications` page as everyone else, and
can view/comment on any ticket.

---

## 4. For Developers

### 4.1 Architecture

- **Next.js 16**, App Router, TypeScript. Route protection middleware is `proxy.ts`
  (Next 16 renamed `middleware.ts`), running on the **Node.js runtime by default** — it
  imports the full Auth.js config directly.
- **Auth.js v5** (`next-auth@beta`) — Credentials (bcrypt) + Microsoft Entra ID OAuth.
  JWT session strategy (required because a Credentials provider is present).
- **Prisma 7** against **Supabase Postgres** (session-mode pooler, port 5432) via the
  mandatory `@prisma/adapter-pg` driver adapter. Custom generator output:
  `app/generated/prisma` (git-ignored, regenerated on `npm install` and after every
  migration).
- **AdminLTE 4 / Bootstrap 5** UI — vendored, compiled assets copied into
  `public/adminlte/`, no Tailwind. Multiple Next.js **root layouts** (route groups):
  `app/(auth)/layout.tsx` for login, `app/(backend)/layout.tsx` for everything else.
- **Notification channels**: email (Mailgun HTTP API), browser Web Push (VAPID), and a
  Microsoft Teams incoming-webhook stub — see §4.6.

### 4.2 Project structure

```
app/
  (auth)/login/              Login page + form (own root layout)
  (backend)/                Authenticated app (own root layout: sidebar + header)
    dashboard/                 Admin-only demo dashboard
    tickets/                   /tickets (own/all), /tickets/new, /tickets/[id],
                                /tickets/assigned, /tickets/approval
    transaction/ticket-management/   Admin ticket work queue
    master/                    user / company / user-group / category CRUD
    notifications/             Full paginated notification history
    _components/                Shared dashboard chrome (header, sidebar, modals)
  actions/                     Server Actions ("use server"), grouped by domain
  lib/                         Server-side helpers (db, dal, notifications, etc.)
  generated/prisma/            Generated Prisma client (git-ignored)
auth.ts                        Auth.js config (root)
next-auth.d.ts                 Session/JWT type augmentation
proxy.ts                       Route-protection middleware
prisma/schema.prisma           Data model (source of truth)
prisma/migrations/             Migration history
public/uploads/{tickets,comments}/{id}/   Uploaded attachments
public/sw.js                   Service worker (Web Push)
```

### 4.3 Data model

All models below are additive on top of a pre-existing, populated production schema —
`prisma migrate dev` only ever adds columns/tables/enum values, never drops or
restructures existing ones.

**User** — `id, name, email, passwordHash?, role, status, isAssignee, image?, companyId?,
departmentId?, userGroupId?, telephone?, emailVerified?, notificationsSeenAt?,
createdAt, updatedAt`. Roles: `USER / SUPERVISOR / ADMIN`. Status:
`ACTIVE / INACTIVE / SUSPENDED` (non-ACTIVE blocks Credentials login).

**Company** → **Department** (`supervisorId?` unique — one supervisor per department,
who receives that department's approval requests) → **Ticket**.

**Category** ← **CategoryAdmin** (join table: which admins own a category).

**UserGroup** — named ticket-assignment pool; `User.userGroupId` and
`Ticket.assignedGroupId` both point at it.

**Ticket** — the core entity:
| Field | Notes |
|---|---|
| `ticketNumber` | Unique, generated `TKT-YYYYMMDD-XXXXX` |
| `status` | `TicketStatus` — see §4.5 |
| `priority` | `LOW / MEDIUM / HIGH / URGENT` |
| `createdById`, `assigneeId?`, `assignedGroupId?` | Only `ADMIN`/`SUPERVISOR` users are ever picked as an individual assignee |
| `rating?`, `ratingComment?`, `ratingScore?` (1–5) | Set once, by `closeTicket`; `rating` (3-tier legacy enum) is a derived mapping of `ratingScore`, kept for anything that might still read it |
| `preApprovalStatus?` | Snapshot of `status` right before entering `WAITING`, restored when a supervisor decides |
| `attachments` | `String[]` of `/uploads/tickets/{id}/...` paths |
| `closedAt`, `resolvedAt`, `autoCloseDueDate` | `autoCloseDueDate` exists in the schema but nothing currently sets/consumes it |

**TicketComment** — `message`, `attachments: String[]` (`/uploads/comments/{id}/...`).

**TicketHistory** — append-only audit trail (`action`, `previousState?`, `newState?`,
`actorId?`, `timestamp`). This is also the *data source* for the notification bell —
there is no dedicated notification table.

**TicketApproval** — one-to-one with `Ticket` (`ticketId` unique). `supervisorId`,
`status: ApprovalStatus` (`PENDING/APPROVED/REJECTED`), `requestMessage?` (the admin's
message when requesting), `comments?` (the supervisor's decision reason — same field,
repurposed once a decision is made), `decidedAt?`.

**PushSubscription** — one row per browser subscription (`endpoint` unique), keyed to a
`User`.

**SystemSetting**, **AuditLog** — present in the schema, not yet used by any app code.

**Account / Session / VerificationToken** — standard Auth.js Prisma-adapter tables
(OAuth linking only; Credentials sessions are JWT and never touch `Session`).

Enums: `Role`, `UserStatus`, `Priority`, `Rating` (legacy 3-tier), `ApprovalStatus`,
`TicketStatus`.

### 4.4 Auth & authorization

- `auth.ts` (root) exports `{ handlers, auth, signIn, signOut }`; route handler at
  `app/api/auth/[...nextauth]/route.ts` re-exports `handlers`.
- `proxy.ts` only checks *is there a session* — redirects unauthenticated requests to
  `/login`, and bounces an already-logged-in visit to `/` or `/login` to
  `getHomePathForRole(role)` (`app/lib/roles.ts`): ADMIN → `/dashboard`, SUPERVISOR →
  `/tickets/approval`, USER → `/tickets`.
- **Real authorization is never proxy-level** — every page and every Server Action
  re-verifies via `requireUser()` / `requireAdmin()` (`app/lib/dal.ts`), or bespoke
  checks (e.g. a ticket's owner/assignee/group/reviewing-supervisor visibility check in
  `tickets/[id]/page.tsx`; a supervisor's own-approval check in `decideTicketApproval`).
  A page or button being hidden is a UX nicety, not the security boundary.

### 4.5 Ticket status lifecycle

```
NEW ──(assignee/group set)──▶ ASSIGNED ──▶ RESOLVED ──▶ VERIFIED
 ▲                                             │            
 └───────────── REOPENED ◀─────────────────────┘  (Re-Open button)
                                                
any non-CLOSED, non-WAITING status ──(Request Approve)──▶ WAITING
        ▲                                                    │
        └──────────────── restored on Approve/Reject ────────┘

RESOLVED ──(owner closes + rates)──▶ CLOSED
```

`updateTicket` (`app/actions/tickets.ts`) is the single mutation point for
status/assignee/group/priority changes from the two admin edit surfaces; it writes one
`TicketHistory` row per changed field and only calls `notifyTicketAssigned` when the
assignment actually changed.

### 4.6 Notifications

Three outbound channels, all best-effort and independently caught so one failing
doesn't block the others (`app/lib/notifications.ts` → `notifyTicketAssigned`):

| Channel | Module | Behavior when unconfigured |
|---|---|---|
| Email | `app/lib/email.ts` (Mailgun HTTP API) | Logs and skips if Mailgun env vars are missing |
| Web Push | `app/lib/push.ts` (`web-push` + VAPID) | Skips if VAPID keys are missing; auto-deletes a subscription on a 404/410 send response |
| MS Teams | `app/lib/msteams.ts` (Incoming Webhook) | No-op stub until `MS_TEAMS_WEBHOOK_URL` is set |

The **in-app notification bell** is unrelated to the above — it's a derived read of
`TicketHistory` (`getRecentTicketActivity` / `getTicketActivityPage`), scoped to
tickets the viewer created, is assigned, or their group is assigned, excluding events
the viewer caused themselves. "Unread" = newer than `User.notificationsSeenAt`, bumped
by `markNotificationsSeen` when the bell is opened.

### 4.7 Server Actions (by file, `app/actions/`)

| File | Exports |
|---|---|
| `tickets.ts` | `createTicket`, `updateTicket`, `closeTicket`, `requestTicketApproval` |
| `comments.ts` | `createComment` |
| `approvals.ts` | `decideTicketApproval` |
| `notifications.ts` | `savePushSubscription`, `deletePushSubscription`, `markNotificationsSeen` |
| `users.ts`, `companies.ts`, `user-groups.ts`, `categories.ts` | Master data CRUD |
| `auth.ts` | `login`, `loginWithMicrosoft`, `logout` |

### 4.8 Routes

| Path | Access | Purpose |
|---|---|---|
| `/login` | Public | Credentials + Microsoft sign-in |
| `/dashboard` | ADMIN only (others redirected) | Demo AdminLTE dashboard |
| `/tickets` | All | Own tickets (non-admin) / all tickets (admin) |
| `/tickets/new` | All | File a ticket |
| `/tickets/[id]` | Owner, assignee, group member, reviewing supervisor, or admin | Detail — info/comments/history; `?edit=1` for the admin inline editor; `?back=` for a custom Back target |
| `/tickets/assigned` | All | Tickets assigned to the viewer's `UserGroup` |
| `/tickets/approval` | All (meaningful for SUPERVISOR) | Pending `TicketApproval` rows for the viewer, with Approve/Reject |
| `/transaction/ticket-management` | ADMIN only | Full ticket queue with inline edit/modal |
| `/master/*` | ADMIN only | User / Company / User Group / Category CRUD |
| `/notifications` | All | Full paginated activity feed |

### 4.9 Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres, pooler, session mode |
| `AUTH_SECRET` | Auth.js JWT signing secret |
| `AZURE_AD_CLIENT_ID` / `_CLIENT_SECRET` / `_TENANT_ID` | Microsoft Entra ID OAuth |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` | Mailgun email |
| `SMTP_*` | Present, unused (Mailgun is the active provider) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push |
| `MS_TEAMS_WEBHOOK_URL` | MS Teams Incoming Webhook (empty = stub no-ops) |

### 4.10 Local development

```bash
npm install                 # also runs `prisma generate` (postinstall)
npm run dev                 # next dev — restart after any schema migration
npm run db:migrate           # prisma migrate dev (additive only — see §4.3 preamble)
npm run db:seed              # idempotent upsert of demo accounts (prisma/seed.ts)
npm run lint                 # eslint
npx tsc --noEmit              # typecheck
```

Demo accounts (password `P@ssw0rd` for all): `admin@demo.com` (ADMIN),
`supervisor@demo.com` (SUPERVISOR), `user1@demo.com` / `user2@demo.com` (USER).
