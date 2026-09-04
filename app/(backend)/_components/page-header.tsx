import Link from "next/link";
import type { Role } from "@/app/generated/prisma/client";
import { getHomePathForRole } from "@/app/lib/roles";

export type Crumb = { label: string; href?: string };

// Shared `app-content-header` block (title + breadcrumb) every page in this
// route group renders — was duplicated by hand across ~40 files. "Home"
// routes to whatever this role's own landing page is (same mapping used for
// the post-login/no-access redirect — see getHomePathForRole): Dashboard for
// admins, the Approval queue for approvers, Tickets for everyone else.
export function PageHeader({
  title,
  breadcrumbs = [],
  role,
}: {
  title: string;
  /** Trail after Home, in order — the last entry renders as the current
   * (non-link) page; earlier entries need an `href` to be a link, or render
   * as plain text if omitted (e.g. a submenu label like "Master"/"Report"
   * that isn't its own page). Omit entirely for a page one level under Home. */
  breadcrumbs?: Crumb[];
  role: Role;
}) {
  const homeHref = getHomePathForRole(role);

  return (
    <div className="app-content-header">
      <div className="container-fluid">
        <div className="row">
          <div className="col-sm-6">
            <h1 className="mb-0 fs-3">{title}</h1>
          </div>
          <div className="col-sm-6">
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb float-sm-end">
                <li className="breadcrumb-item">
                  <Link href={homeHref}>Home</Link>
                </li>
                {breadcrumbs.map((crumb, i) =>
                  i === breadcrumbs.length - 1 ? (
                    <li key={i} className="breadcrumb-item active" aria-current="page">
                      {crumb.label}
                    </li>
                  ) : crumb.href ? (
                    <li key={i} className="breadcrumb-item">
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </li>
                  ) : (
                    <li key={i} className="breadcrumb-item">
                      {crumb.label}
                    </li>
                  )
                )}
              </ol>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
