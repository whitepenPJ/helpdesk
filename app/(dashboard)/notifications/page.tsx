import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/app/lib/dal";
import { getTicketActivityPage } from "@/app/lib/notifications";
import { formatDateTime } from "@/app/lib/date-format";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 20;

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const session = await requireUser();

  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const { items, total } = await getTicketActivityPage(session.user.id, session.user.role, {
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Notifications</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Notifications
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

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
                          <Link href={`/tickets/${item.ticketId}`} className="d-flex justify-content-between gap-3">
                            <span>
                              <i className="bi bi-ticket-perforated me-2" aria-hidden="true"></i>
                              <span className="fw-medium">{item.ticketNumber}</span> {item.action}
                              {item.previousState && item.newState && (
                                <span className="text-secondary">
                                  {" "}
                                  ({item.previousState} → {item.newState})
                                </span>
                              )}
                            </span>
                            <span className="text-secondary fs-7 text-nowrap">{formatDateTime(item.timestamp)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="card-footer clearfix">
                  <div className="float-start pt-1 fs-7 text-body-secondary">
                    Showing {items.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                    {(currentPage - 1) * PAGE_SIZE + items.length} of {total} notifications
                  </div>
                  {totalPages > 1 && (
                    <ul className="pagination pagination-sm m-0 float-end">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                          <Link className="page-link" href={{ pathname: "/notifications", query: { page: p } }}>
                            {p}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
