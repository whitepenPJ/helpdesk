import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/dal";
import { getHomePathForRole } from "@/app/lib/roles";
import { getAdminDashboardData } from "@/app/lib/dashboard-data";
import { OPEN_STATUSES, AWAITING_CLOSE_STATUSES } from "@/app/lib/ticket-status-groups";
import { STATUS_BADGE, PRIORITY_BADGE } from "../tickets/ticket-badges";
import { DashboardCharts } from "./dashboard-charts";

type LinkHref = React.ComponentProps<typeof Link>["href"];

function ticketManagementHref(query: Record<string, string>): LinkHref {
  return { pathname: "/transaction/ticket-management", query };
}

export const metadata: Metadata = {
  title: "Dashboard",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function InfoBox({
  icon,
  color,
  label,
  value,
  href,
}: {
  icon: string;
  color: string;
  label: string;
  value: number;
  href: LinkHref;
}) {
  return (
    <div className="col-12 col-sm-6 col-md-3">
      <Link href={href} className="text-decoration-none">
        <div className="info-box">
          <span className={`info-box-icon text-bg-${color} shadow-sm`}>
            <i className={`bi ${icon}`} aria-hidden="true"></i>
          </span>
          <div className="info-box-content">
            <span className="info-box-text">{label}</span>
            <span className="info-box-number">{value}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireUser();
  if (session.user.role !== "ADMIN") {
    redirect(getHomePathForRole(session.user.role));
  }

  const data = await getAdminDashboardData();
  const { recap } = data;

  return (
    <>
      <DashboardCharts
        trend={data.trend}
        statusBreakdown={data.statusBreakdown}
        priorityBreakdown={data.priorityBreakdown}
      />

      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Dashboard</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Dashboard
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          {/* KPI boxes */}
          <div className="row g-3 mb-1">
            <InfoBox
              icon="bi-hourglass-split"
              color="primary"
              label="Open Tickets"
              value={data.openCount}
              href={ticketManagementHref({ status: OPEN_STATUSES.join(",") })}
            />
            <InfoBox
              icon="bi-person-x-fill"
              color="warning"
              label="Unassigned"
              value={data.unassignedCount}
              href={ticketManagementHref({ unassigned: "1" })}
            />
            <InfoBox
              icon="bi-hourglass-top"
              color="danger"
              label="Pending Approval"
              value={data.pendingApprovalCount}
              href={ticketManagementHref({ status: "WAITING" })}
            />
            <InfoBox
              icon="bi-emoji-smile"
              color="success"
              label="Awaiting Customer Close"
              value={data.awaitingCloseCount}
              href={ticketManagementHref({ status: AWAITING_CLOSE_STATUSES.join(",") })}
            />
          </div>

          {/* Trend */}
          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Ticket Volume — Last 14 Days</h5>
                </div>
                <div className="card-body">
                  <div id="ticket-trend-chart"></div>
                </div>
                <div className="card-footer">
                  <div className="row">
                    <div className="col-md-3 col-6">
                      <div className="text-center border-end">
                        <h5 className="fw-bold mb-0">{recap.totalCreated}</h5>
                        <span className="text-uppercase fs-8">Created (30d)</span>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="text-center border-end">
                        <h5 className="fw-bold mb-0">{recap.totalClosed}</h5>
                        <span className="text-uppercase fs-8">Closed (30d)</span>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="text-center border-end">
                        <h5 className="fw-bold mb-0">
                          {recap.avgResolutionHours !== null ? `${recap.avgResolutionHours.toFixed(1)}h` : "—"}
                        </h5>
                        <span className="text-uppercase fs-8">Avg Resolution Time</span>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="text-center">
                        <h5 className="fw-bold mb-0">
                          {recap.avgCsat !== null ? `${recap.avgCsat.toFixed(1)} / 5` : "—"}
                        </h5>
                        <span className="text-uppercase fs-8">Avg CSAT (30d)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status / Priority breakdown */}
          <div className="row">
            <div className="col-md-6">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Tickets by Status</h5>
                </div>
                <div className="card-body">
                  <div id="status-donut-chart"></div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title">Open Tickets by Priority</h5>
                </div>
                <div className="card-body">
                  <div id="priority-bar-chart"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Needs attention / Agent workload */}
          <div className="row">
            <div className="col-md-6">
              <div className="card mb-4">
                <div className="card-header">
                  <h3 className="card-title">Needs Attention</h3>
                </div>
                <div className="card-body p-0">
                  {data.needsAttention.length === 0 ? (
                    <p className="text-secondary text-center mb-0 py-4">Nothing unassigned — nice work.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table m-0">
                        <thead>
                          <tr>
                            <th>Ticket</th>
                            <th>Priority</th>
                            <th>Company</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.needsAttention.map((t) => (
                            <tr key={t.id}>
                              <td>
                                <Link href={`/tickets/${t.id}`} className="link-primary text-truncate d-inline-block" style={{ maxWidth: "14rem" }}>
                                  {t.ticketNumber} — {t.title}
                                </Link>
                              </td>
                              <td>
                                <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                              </td>
                              <td>{t.companyName}</td>
                              <td>{formatDate(t.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="card-footer text-center">
                  <Link href="/transaction/ticket-management">View Ticket Management</Link>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card mb-4">
                <div className="card-header">
                  <h3 className="card-title">Agent Workload</h3>
                </div>
                <div className="card-body p-0">
                  {data.agentWorkload.length === 0 ? (
                    <p className="text-secondary text-center mb-0 py-4">No tickets assigned yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table m-0">
                        <thead>
                          <tr>
                            <th>Agent</th>
                            <th>Active</th>
                            <th>Resolved (30d)</th>
                            <th>Avg Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.agentWorkload.map((a) => (
                            <tr key={a.userId}>
                              <td>{a.name}</td>
                              <td>{a.active}</td>
                              <td>{a.resolved30d}</td>
                              <td>{a.avgRating !== null ? `${a.avgRating.toFixed(1)} / 5` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent tickets */}
          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <h3 className="card-title">Recent Tickets</h3>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table m-0">
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Company</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Assignee</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentTickets.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <Link href={`/tickets/${t.id}`} className="link-primary">
                                {t.ticketNumber}
                              </Link>{" "}
                              {t.title}
                            </td>
                            <td>{t.companyName}</td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                            </td>
                            <td>
                              <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                            </td>
                            <td>{t.assigneeName ?? <span className="text-secondary">Unassigned</span>}</td>
                            <td>{formatDate(t.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer text-center">
                  <Link href="/transaction/ticket-management">View All Tickets</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
