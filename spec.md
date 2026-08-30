# Server Sizing Spec — Helpdesk App

## Scope and assumptions

This app is deployed serverless (Next.js on Vercel + Supabase Postgres), not on
a single fixed machine — so "CPU / RAM / HD" doesn't map onto one box the way
it would for a traditional server. This spec translates that request into the
two places compute/memory/storage actually get provisioned in this stack:
Vercel's function runtime and Supabase's Postgres compute tier, sized for a
**target load of 1,000 transactions per hour** (a "transaction" here = one
write-touching action: create/update/delete a ticket, comment, assignment,
approval decision, etc. — read-only page views are cheaper and not the
bottleneck). If "1,000 transactions" was meant as **per second** instead,
see the note at the end — that's a different order of magnitude and changes
the recommendation substantially.

1,000 tx/hour ≈ 0.28 tx/sec sustained, with real-world bursts (start of
business day, end-of-day closeout) reasonably modeled at 5–10x that, i.e.
peak bursts of roughly **1.5–3 transactions/second**.

## Application layer — Vercel Functions

Each Server Action / API route runs as an isolated function invocation;
Vercel provisions CPU proportionally to configured memory, and scales
instance count automatically rather than needing manual capacity planning.

| Setting | Recommendation | Why |
|---|---|---|
| Memory per function | 1024 MB | Comfortably covers Prisma + the `pg` driver, ExcelJS/PDFKit report generation, and image/attachment handling without hitting default 1024 MB ceiling issues; bump to 2048 MB only if large XLSX exports start OOM-ing. |
| Max duration | 30s (default) for normal actions; 60s for `/api/report/export` and `/api/master/user/export` | Report/export generation (ExcelJS, PDFKit) is the slowest path in the app; everything else completes in well under a second at this load. |
| Concurrency | No manual cap needed — Fluid Compute reuses warm instances across concurrent requests | At 1.5–3 tx/sec peak, single-digit concurrent instances comfortably cover load; Vercel's autoscaling handles this without configuration. |
| Region | Single region colocated with the Supabase project (e.g. `sin1` for ap-southeast-1) | Round-trip latency to Postgres dominates response time for a CRUD-heavy app like this one — colocating app and DB region matters far more than multi-region spread at this traffic level. |

**Estimated cost driver**: invocation count and execution time, not raw
CPU/RAM — at 1,000 tx/hour plus proportional read traffic (assume 5–10 page
views per transaction), total monthly invocations land in the low millions,
comfortably within a Vercel Pro plan.

## Database layer — Supabase Postgres

This is where real CPU/RAM/storage provisioning happens.

| Resource | Recommendation | Why |
|---|---|---|
| Compute tier | Supabase **Small** (2 vCPU / 4 GB RAM) as the floor; **Medium** (2 vCPU / 8 GB RAM) if report queries (large `findMany` scans for Excel/PDF export) run during business hours alongside transactional traffic | 1,000 tx/hour is light OLTP load for Postgres — the real pressure on this schema comes from admin report pages doing full-table scans (`TicketHistory`, `Ticket` joins) concurrently with live traffic. Medium gives headroom so a report export doesn't starve transactional latency. |
| Connections | Use the **transaction-mode pooler** (already configured — `app/lib/db.ts`, port 6543), `max: 10` per function instance | Confirmed working config in this codebase; this is what avoids the `EMAXCONNSESSION` exhaustion this project hit earlier under session-mode pooling. Don't revert to session mode without also capping concurrent function instances. |
| Storage (DB) | Start at 20 GB, plan for ~1 GB/year at this transaction volume | Ticket/comment/history rows are small (a few KB each); at 1,000 tx/hour × 24 × 365 ≈ 8.76M rows/year across all tables combined, still well under 10 GB/year of raw row data even generously estimated. |
| Storage (attachments) | **Needs a real fix before sizing matters** — see flag below | `app/lib/attachments.ts` currently writes uploads to the local filesystem (`public/uploads/...` via `node:fs`). On Vercel, the deployed filesystem is read-only outside `/tmp`, and `/tmp` is ephemeral per invocation and not shared across instances — uploaded attachments will not reliably persist in production as currently coded. This needs to move to real object storage (Supabase Storage, S3, Vercel Blob) before "HD" sizing is a meaningful question; once moved, budget ~5 MB average per ticket-with-attachments × expected attachment rate. |
| Backups | Point-in-time recovery (PITR), 7-day minimum retention | Standard for a system of record handling approval/audit workflows (`TicketHistory`, `TicketApproval`). |

## Summary table

| Component | Spec |
|---|---|
| App compute | Vercel Functions, 1024 MB, auto-scaled, single region near DB |
| DB compute | 2 vCPU / 4–8 GB RAM (Supabase Small–Medium) |
| DB connections | Transaction-mode pooler, 10 per instance (already configured) |
| DB storage | 20 GB provisioned, ~1 GB/year growth (excluding attachments) |
| Object storage | Sized separately based on attachment volume — not covered by DB tier |
| Backups | PITR, 7-day retention minimum |

## If "1,000 transactions" means per second, not per hour

That's ~3,600,000/hour — roughly 3,600x the load modeled above, and would
require a fundamentally different architecture: connection pooling alone
won't carry that (Postgres write throughput becomes the hard limit well
before that point on any single-primary instance), meaning read replicas,
write-path batching/queueing, and likely sharding or a queue-backed async
write path (outside what this app's current architecture does) would be
needed. Confirm which interpretation is intended before provisioning against
this number — the sizing above assumes **per hour**.
