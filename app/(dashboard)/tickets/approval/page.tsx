import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { SortableTh } from "../../_components/sortable-th";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import type { Prisma } from "@/app/generated/prisma/client";
import { STATUS_BADGE, PRIORITY_BADGE } from "../ticket-badges";
import { formatDateTime } from "@/app/lib/date-format";
import { ApprovalRowActions } from "./_components/approval-row-actions";

export const metadata: Metadata = { title: "Approval Ticket" };

const PAGE_SIZE = 10;

const SORT_COLUMNS = ["ticketNumber", "title", "category", "company", "priority", "status", "requestedBy", "requestedAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.TicketApprovalOrderByWithRelationInput {
  switch (sortBy) {
    case "ticketNumber":
      return { Ticket: { ticketNumber: sortDir } };
    case "title":
      return { Ticket: { title: sortDir } };
    case "category":
      return { Ticket: { Category: { name: sortDir } } };
    case "company":
      return { Ticket: { Company: { name: sortDir } } };
    case "priority":
      return { Ticket: { priority: sortDir } };
    case "status":
      return { Ticket: { status: sortDir } };
    case "requestedBy":
      return { Ticket: { User_Ticket_createdByIdToUser: { name: sortDir } } };
    case "requestedAt":
      return { createdAt: sortDir };
  }
}

// Lists tickets awaiting this supervisor's decision on the TicketApproval
// workflow, with real Approve/Reject actions.
export default async function ApprovalTicketsPage({ searchParams }: PageProps<"/tickets/approval">) {
  const session = await requireUser();

  const { page, sort, dir } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const { sortBy, sortDir } = parseSort(
    typeof sort === "string" ? sort : undefined,
    typeof dir === "string" ? dir : undefined,
    SORT_COLUMNS,
    { column: "requestedAt", dir: "asc" }
  );

  const where: Prisma.TicketApprovalWhereInput = { supervisorId: session.user.id, status: "PENDING" };

  const [approvals, total] = await Promise.all([
    prisma.ticketApproval.findMany({
      where,
      include: {
        Ticket: {
          include: {
            Category: true,
            Company: true,
            Department: true,
            User_Ticket_createdByIdToUser: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: buildOrderBy(sortBy, sortDir),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ticketApproval.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Approval Ticket</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Approval Ticket
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
                  <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                      <thead>
                        <tr>
                          <SortableTh label="Ticket #" column="ticketNumber" pathname="/tickets/approval" query={{}} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Title" column="title" pathname="/tickets/approval" query={{}} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Category" column="category" pathname="/tickets/approval" query={{}} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Company / Department" column="company" pathname="/tickets/approval" query={{}} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Priority" column="priority" pathname="/tickets/approval" query={{}} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="status" pathname="/tickets/approval" query={{}} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Requested by" column="requestedBy" pathname="/tickets/approval" query={{}} sortBy={sortBy} sortDir={sortDir} />
                          <th>Message</th>
                          <SortableTh label="Requested" column="requestedAt" pathname="/tickets/approval" query={{}} sortBy={sortBy} sortDir={sortDir} />
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvals.map((approval) => (
                          <tr key={approval.id}>
                            <td className="fw-medium">{approval.Ticket.ticketNumber}</td>
                            <td>{approval.Ticket.title}</td>
                            <td>{approval.Ticket.Category.name}</td>
                            <td>
                              {approval.Ticket.Company.name}
                              <div className="fs-7 text-secondary">{approval.Ticket.Department.name}</div>
                            </td>
                            <td>
                              <span className={`badge ${PRIORITY_BADGE[approval.Ticket.priority]}`}>
                                {approval.Ticket.priority}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[approval.Ticket.status]}`}>
                                {approval.Ticket.status}
                              </span>
                            </td>
                            <td>{approval.Ticket.User_Ticket_createdByIdToUser.name}</td>
                            <td className="text-secondary">{approval.requestMessage ?? "—"}</td>
                            <td>{formatDateTime(approval.createdAt)}</td>
                            <td className="text-end">
                              <ApprovalRowActions
                                approvalId={approval.id}
                                ticketId={approval.Ticket.id}
                                ticketNumber={approval.Ticket.ticketNumber}
                              />
                            </td>
                          </tr>
                        ))}
                        {approvals.length === 0 && (
                          <tr>
                            <td colSpan={10} className="text-center text-secondary py-4">
                              No tickets awaiting your approval.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer clearfix">
                  <div className="float-start pt-1 fs-7 text-body-secondary">
                    Showing {approvals.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                    {(currentPage - 1) * PAGE_SIZE + approvals.length} of {total} tickets
                  </div>
                  {totalPages > 1 && (
                    <ul className="pagination pagination-sm m-0 float-end">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                          <Link
                            className="page-link"
                            href={{ pathname: "/tickets/approval", query: { sort: sortBy, dir: sortDir, page: p } }}
                          >
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
