# Server Sizing Spec — Helpdesk App

## Scope and assumptions

This app is now deployed as a set of **Docker containers** (Docker Compose)
on a host you provision yourself — the Next.js app, **PostgreSQL**, and a
TLS-terminating reverse proxy, with optional PgBouncer / object-storage /
backup sidecars. Unlike the previous serverless target (Vercel + hosted
Supabase Postgres), "CPU / RAM / HD" now maps directly onto one host box (or
a small VM), so this spec sizes **that host and each container**.

Target load is unchanged: **1,000 transactions per hour**, where a
"transaction" = one write-touching action (create/update/delete a ticket,
comment, assignment, approval decision, etc.). Read-only page views are
cheaper and are not the bottleneck. If "1,000 transactions" was meant as
**per second**, see the note at the end — that's a different order of
magnitude and changes the recommendation substantially.

1,000 tx/hour ≈ 0.28 tx/sec sustained, with real-world bursts (start of
business day, end-of-day closeout) reasonably modeled at 5–10x that, i.e.
peak bursts of roughly **1.5–3 transactions/second**.

## Host machine

One Linux host running Docker Engine + Compose. Everything below fits
comfortably on a single box at this load; scale to multiple hosts only if
you need HA, not for capacity.

| Tier | Spec | When |
|---|---|---|
| Floor | **4 vCPU / 8 GB RAM / 80–100 GB SSD** | Steady 1,000 tx/hour with reports run off-hours. |
| Recommended | **8 vCPU / 16 GB RAM / 160 GB NVMe SSD** | Headroom for Excel/PDF report exports running during business hours alongside live traffic, plus 2–3 years of data growth and zero-downtime deploys (2 app replicas). |

Storage **must be SSD/NVMe** — Postgres random-I/O latency dominates
response time for this CRUD-heavy schema. Put Docker volumes on the fast
disk; keep backups on a separate mount/disk.

## Container sizing

Compose services and the resource limits to set on each (`deploy.resources.limits`
in compose v3, or `cpus` / `mem_limit`). Give each `restart: unless-stopped`
and a healthcheck.

| Service | CPU | RAM | Notes |
|---|---|---|---|
| `proxy` (Caddy / Traefik / nginx) | 0.5 vCPU | 128–256 MB | TLS termination, HTTP/2, static asset caching. Only public-facing port. |
| `web` (Next.js standalone) | 1–2 vCPU | 1–2 GB | Node heap. ExcelJS / PDFKit export is the memory spike — if capped at 2 GB, pass `NODE_OPTIONS=--max-old-space-size=1536`. Run 2 replicas behind `proxy` for rolling deploys; 1 is enough for load. |
| `postgres` (`postgres:17`, pinned) | 2 vCPU | **4 GB floor**, 8 GB if reports run during business hours | Report pages do large `findMany` scans (`TicketHistory`, `Ticket` joins) — the extra RAM keeps those off disk so an export doesn't starve transactional latency. Tuning below. |
| `pgbouncer` (optional) | 0.25 vCPU | 128 MB | Only if `web` scales past ~5 replicas, or the migrate/seed/worker containers open pools alongside it. Not needed for a single `web` container. |
| `minio` (optional) | 0.5 vCPU | 512 MB | S3-compatible attachment storage, as an alternative to a shared bind mount — see "Attachments". |
| `backup` (pgBackRest / cron `pg_dump`) | 0.5 vCPU burst | 256 MB | Nightly job; idle otherwise. |

Rough steady-state footprint: ~2 vCPU and ~5–6 GB RAM in use, leaving the
recommended 8/16 host mostly free for report bursts and OS page cache.

## PostgreSQL configuration

Official `postgres:17` image, **pin the major version** (never `latest`).
Set via `command:` flags or a mounted `postgresql.conf`.

| Setting | 4 GB container | 8 GB container |
|---|---|---|
| `shared_buffers` | 1 GB | 2 GB |
| `effective_cache_size` | 3 GB | 6 GB |
| `work_mem` | 16 MB | 32 MB |
| `maintenance_work_mem` | 256 MB | 512 MB |
| `max_connections` | 100 | 100 |
| `max_wal_size` | 4 GB | 4 GB |
| `wal_compression` | `on` | `on` |
| `checkpoint_timeout` | 15min | 15min |

- **Data volume**: 20 GB provisioned, plan ~1 GB/year growth. Ticket/comment/
  history rows are a few KB each; ~8.76M rows/year across all tables stays
  well under 10 GB/year of raw row data even generously estimated.
- `max_connections = 100` is ample: a single `web` container with the
  adapter's `max: 10` (see below) uses ~10 backend slots. Only raise it, or
  introduce PgBouncer, when scaling `web` replicas.
- Match the major version to what the current database actually runs
  (`SELECT version()`), or plan an explicit `pg_dump`/restore upgrade.

## Connections (app → Postgres)

The Supabase pooler is gone. The app connects **directly** to the `postgres`
service over the Docker network.

- `DATABASE_URL` becomes
  `postgresql://helpdesk:***@postgres:5432/helpdesk` (internal hostname =
  compose service name).
- `app/lib/db.ts` — `max: 10` still bounds **one container's** pool and is
  correct as-is; the comment there about Supabase's transaction-mode pooler
  / `EMAXCONNSESSION` / session mode is now stale and should be rewritten to
  describe a direct connection.
- `prisma.config.ts` — with self-hosted Postgres there is no
  session-vs-transaction pooler split, so **one URL works for both**
  `prisma migrate deploy` and runtime queries. `DIRECT_URL` can be collapsed
  into `DATABASE_URL`.
- Add PgBouncer (transaction mode, `default_pool_size` ~20) only when `web`
  runs multiple replicas or several pool-opening sidecars run concurrently.

## Attachments

Moving off Vercel **removes the read-only-filesystem blocker** that made
`app/lib/attachments.ts` (writes to `public/uploads/...` via `node:fs`)
unsafe in production. Two viable options:

1. **Bind-mounted volume (simplest, recommended at this load)** — mount a
   host SSD directory at the standalone image's `public/uploads` path.
   `saveAttachments` works unchanged. Constraint: a local volume is **not
   shared across `web` replicas**, so keep `web` single-replica, or put the
   volume on shared storage (NFS). Back this volume up on the same schedule
   as the database.
2. **MinIO / S3** — run the `minio` sidecar (or point at external S3) and
   rework `attachments.ts` to use an S3 client. Needed if you want multiple
   `web` replicas writing attachments. Budget ~5 MB average per
   ticket-with-attachments × expected attachment rate.

Either way, user uploads must live in a **mounted volume**, not baked into
the image — `output: "standalone"` copies `public/` at build time, so
anything written there at runtime is lost on the next image deploy.

## Build & deploy notes

- Add `output: "standalone"` to `next.config.ts`. Multi-stage Dockerfile:
  `deps` → `build` (`prisma generate` + `next build`) → `runner` (copy
  `.next/standalone`, `.next/static`, `public`, `app/generated/prisma`,
  and `node_modules/pdfkit`). Run as non-root; `ENV HOSTNAME=0.0.0.0 PORT=3000`.
- `serverExternalPackages: ["pdfkit"]` is already set and must stay — the
  runner image needs `pdfkit` present in `node_modules` (it's not bundled;
  it reads its `.afm` font metrics via `fs` at runtime).
- `experimental.serverActions.bodySizeLimit: "10mb"` is already set for
  attachment uploads — make sure the `proxy` `client_max_body_size` (nginx)
  / request-body limit matches or exceeds it.
- Run `prisma migrate deploy` as a one-shot `migrate` service
  (`depends_on: postgres` healthy) or a container entrypoint step before
  `node server.js`. **Never** `prisma migrate reset` — the schema and data
  are pre-existing.
- Env vars for the container: `DATABASE_URL` (internal), `AUTH_SECRET`,
  `AUTH_URL` / `NEXTAUTH_URL` = the public HTTPS URL, `AUTH_TRUST_HOST=true`
  (running behind `proxy`), `AZURE_AD_CLIENT_ID` / `_SECRET` / `_TENANT_ID`,
  and the `web-push` VAPID keys.
- Healthchecks: `postgres` → `pg_isready`; `web` → TCP/HTTP on `:3000`;
  `proxy` `depends_on` `web`.

## Backups

No managed point-in-time recovery anymore — provide it yourself.

- **Minimum**: nightly `pg_dump -Fc` to the backup mount, **7-day retention**,
  copied offsite (e.g. `rclone` to S3/B2). Snapshot the attachments volume on
  the same schedule.
- **For real PITR**: pgBackRest or Barman sidecar with continuous WAL
  archiving to object storage, 7-day retention floor. Required for a system
  of record handling approval/audit workflows (`TicketHistory`,
  `TicketApproval`).
- Test restores on a throwaway container regularly — an untested backup is
  not a backup.

## Summary table

| Component | Spec |
|---|---|
| Host | 4 vCPU / 8 GB / 80–100 GB SSD floor; **8 vCPU / 16 GB / 160 GB NVMe recommended** |
| `web` container | Next.js standalone, 1–2 vCPU, 1–2 GB, 1–2 replicas |
| `postgres` container | `postgres:17` pinned, 2 vCPU, 4–8 GB, tuned per table above |
| DB data volume | 20 GB provisioned, ~1 GB/year growth, on SSD/NVMe |
| Connections | Direct `postgres:5432`, adapter `max: 10` per container; PgBouncer only when scaling replicas |
| Attachments | Mounted volume at `public/uploads` (single `web` replica), or MinIO/S3 for multi-replica |
| `proxy` | Caddy/Traefik/nginx, TLS termination, 0.5 vCPU / 256 MB |
| Backups | Nightly `pg_dump` + offsite copy (7-day retention); pgBackRest WAL archiving for PITR |

## If "1,000 transactions" means per second, not per hour

That's ~3,600,000/hour — roughly 3,600x the load modeled above. A single
Postgres container on one host won't carry that: write throughput becomes
the hard limit well before that point on any single-primary instance. You'd
need a fundamentally different architecture — read replicas, a queue-backed
async write path, write-path batching, and likely a dedicated multi-node
database cluster (Patroni/Citus or a managed service) rather than a Compose
sidecar. Confirm which interpretation is intended before provisioning
against this number — the sizing above assumes **per hour**.
