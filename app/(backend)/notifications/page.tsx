import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/app/lib/dal";
import { getTicketActivityPage } from "@/app/lib/notifications";
import { formatDateTime } from "@/app/lib/date-format";
import { Pagination } from "../_components/pagination";
import { PageSizeSelect } from "../_components/page-size-select";
import { parsePageSize } from "@/app/lib/page-size";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const session = await requireUser();

  const { page, pageSize: pageSizeParam } = await searchParams;
  const pageSize = parsePageSize(typeof pageSizeParam === "string" ? pageSizeParam : undefined);
  const currentPage = Math.max(1, Number(page) || 1);

  const { items, total } = await getTicketActivityPage(session.user.id, {
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader title="Notifications" role={session.user.role} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-body p-0">
                  {items.length === 0 ? (
                    <p className="text-secondary p-3 mb-0">No notifications yet.</p>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {items.map((item) => (
                        <li key={item.id} className="list-group-item">
                          <Link href={item.href} className="d-flex justify-content-between gap-3">
                            <span>
                              <i className="bi bi-ticket-perforated me-2" aria-hidden="true"></i>
                              {item.message}
                            </span>
                            <span className="text-secondary fs-7 text-nowrap">{formatDateTime(item.timestamp)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="card-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex flex-wrap align-items-center gap-3">
                    <div className="fs-7 text-body-secondary">
                      Showing {items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                      {(currentPage - 1) * pageSize + items.length} of {total} notifications
                    </div>
                    <PageSizeSelect pageSize={pageSize} />
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    className="pagination pagination-sm m-0"
                    makeHref={(p) => ({ pathname: "/notifications", query: { page: p, pageSize: String(pageSize) } })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
