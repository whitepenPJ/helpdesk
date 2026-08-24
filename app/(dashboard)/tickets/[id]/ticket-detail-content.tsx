import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { STATUS_BADGE, PRIORITY_BADGE } from "../ticket-badges";
import { formatAssignment } from "@/app/lib/ticket-format";
import { AddCommentForm } from "../add-comment-form";
import { AssignButton } from "../../_components/assign-modal";
import { ApprovalDecisionButton } from "../../_components/approval-decision-modal";
import { FormVendorScripts } from "../../_components/form-vendor-scripts";
import { RequestApprovalButton } from "../../_components/request-approval-modal";
import { CloseTicketButton } from "./close-ticket-modal";
import { MarkResolvedButton } from "./mark-resolved-button";
import { CancelAssignmentButton } from "./cancel-assignment-button";
import { formatDate, formatDateTime, formatTime } from "@/app/lib/date-format";
import { RATING_SCALE } from "@/app/lib/rating";
import { getAttachmentName } from "@/app/lib/attachments";

type HistoryEntry = {
  id: string;
  action: string;
  previousState: string | null;
  newState: string | null;
  timestamp: Date;
  User: { name: string } | null;
};

// Newest day first (a timeline reads top-down as "most recent activity"),
// consecutive same-day entries folded under one date divider — matches
// AdminLTE's own timeline example (`AdminLTE-master/dist/UI/timeline.html`).
function groupHistoryByDay(entries: HistoryEntry[]): { dayLabel: string; entries: HistoryEntry[] }[] {
  const groups: { dayLabel: string; entries: HistoryEntry[] }[] = [];
  for (const entry of [...entries].reverse()) {
    const dayLabel = formatDate(entry.timestamp);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayLabel === dayLabel) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ dayLabel, entries: [entry] });
    }
  }
  return groups;
}

function historyIcon(action: string): { icon: string; color: string } {
  if (action.startsWith("Approved by ")) return { icon: "bi-check-circle-fill", color: "success" };
  if (action.startsWith("Closed by ")) return { icon: "bi-x-circle-fill", color: "dark" };
  switch (action) {
    case "Ticket created":
      return { icon: "bi-plus-circle-fill", color: "primary" };
    case "Status changed":
      return { icon: "bi-arrow-repeat", color: "info" };
    case "Ticket assigned":
      return { icon: "bi-person-check-fill", color: "warning" };
    case "Priority changed":
      return { icon: "bi-flag-fill", color: "danger" };
    case "Problem updated":
    case "Solution updated":
    case "Ticket edited":
      return { icon: "bi-pencil-fill", color: "secondary" };
    default:
      return { icon: "bi-clock-history", color: "secondary" };
  }
}

// Shared by both entry points that show a single ticket in full —
// `/tickets/[id]` (the general-purpose view every role lands on) and
// `/transaction/ticket-management/[id]` (the admin Ticket Management list's
// own View/Edit destination) — so the two never drift apart. Each route's
// `page.tsx` just supplies where "Back" (and the breadcrumb's parent crumb)
// should point by default; an explicit `?back=` query param (e.g. from a
// notification link) still overrides that per-visit.
export async function TicketDetailContent({
  id,
  edit,
  back,
  defaultBackHref,
  defaultBackLabel,
}: {
  id: string;
  edit?: string;
  back?: string;
  defaultBackHref: string;
  defaultBackLabel: string;
}) {
  const session = await requireUser();
  const isAdmin = session.user.role === "ADMIN";

  // Retained for legacy notification links, but the assign modal is now
  // opened explicitly from the button instead of appearing immediately.
  void edit;
  // Only ever a same-origin path — never trust the query string as a raw
  // redirect target.
  const backHref = back && back.startsWith("/") ? back : defaultBackHref;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      Category: true,
      Company: true,
      Department: { include: { User_Department_supervisorIdToUser: { select: { name: true, email: true } } } },
      User_Ticket_createdByIdToUser: { select: { name: true, email: true } },
      TicketAssignee: { select: { userId: true, User: { select: { name: true, email: true } } } },
      TicketAssignedGroup: { select: { userGroupId: true } },
    },
  });

  if (!ticket) {
    notFound();
  }

  const isOwner = ticket.createdById === session.user.id;

  // Non-admins can view tickets they filed, are individually assigned, are
  // assigned to their group, or are the reviewing supervisor for.
  const isAssignee = ticket.TicketAssignee.some((a) => a.userId === session.user.id);

  const approval = await prisma.ticketApproval.findUnique({
    where: { ticketId: id },
    select: {
      id: true,
      supervisorId: true,
      status: true,
      comments: true,
      decidedAt: true,
      requestMessage: true,
      createdAt: true,
      User: { select: { name: true } },
    },
  });
  const isSupervisor = approval?.supervisorId === session.user.id;

  if (!isAdmin) {
    let isVisible = isOwner || isAssignee;

    if (!isVisible) {
      const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { userGroupId: true } });
      isVisible =
        Boolean(me?.userGroupId) && ticket.TicketAssignedGroup.some((g) => g.userGroupId === me?.userGroupId);
    }

    if (!isVisible) {
      isVisible = isSupervisor;
    }

    if (!isVisible) {
      notFound();
    }
  }

  const [comments, history, assignees, groups] = await Promise.all([
    prisma.ticketComment.findMany({
      where: { ticketId: id },
      include: { User: { select: { name: true, role: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.ticketHistory.findMany({
      where: { ticketId: id },
      include: { User: { select: { name: true } } },
      orderBy: { timestamp: "asc" },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.userGroup.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <FormVendorScripts />
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="h3 mb-0">Ticket No: {ticket.ticketNumber}</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link href={defaultBackHref}>{defaultBackLabel}</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    {ticket.ticketNumber}
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
              {approval?.status === "APPROVED" && approval.decidedAt && (
                <div className="alert alert-success d-flex align-items-start gap-2" role="alert">
                  <i className="bi bi-check-circle-fill mt-1" aria-hidden="true"></i>
                  <div>
                    <div>
                      Approved by <strong>{approval.User.name}</strong> (Supervisor) at{" "}
                      {formatDateTime(approval.decidedAt)}
                    </div>
                    {approval.comments && <div className="text-secondary mt-1">{approval.comments}</div>}
                  </div>
                </div>
              )}
              <div className="card card-primary card-outline mb-4">
                <div className="card-header">
                  <div className="d-flex justify-content-between align-items-end">
                    <h2 className="card-title">{ticket.title}</h2>
                    <div className="d-flex gap-2 align-items-center">
                      <span className={`badge ${PRIORITY_BADGE[ticket.priority]}`}>{ticket.priority}</span>
                      <span className={`badge ${STATUS_BADGE[ticket.status]}`}>{ticket.status}</span>
                      {isOwner && ticket.status === "RESOLVED" && (
                        <CloseTicketButton ticketId={ticket.id} />
                      )}
                    </div>
                  </div>
                </div>
                <div className="card-header p-0 border-bottom-0">
                  <ul className="nav nav-tabs" role="tablist">
                    <li className="nav-item" role="presentation">
                      <button
                        className="nav-link active"
                        id="info-tab"
                        data-bs-toggle="tab"
                        data-bs-target="#info-pane"
                        type="button"
                        role="tab"
                        aria-controls="info-pane"
                        aria-selected="true"
                      >
                        Info
                      </button>
                    </li>
                    <li className="nav-item" role="presentation">
                      <button
                        className="nav-link"
                        id="comment-tab"
                        data-bs-toggle="tab"
                        data-bs-target="#comment-pane"
                        type="button"
                        role="tab"
                        aria-controls="comment-pane"
                        aria-selected="false"
                      >
                        Comment ({comments.length})
                      </button>
                    </li>
                    <li className="nav-item" role="presentation">
                      <button
                        className="nav-link"
                        id="history-tab"
                        data-bs-toggle="tab"
                        data-bs-target="#history-pane"
                        type="button"
                        role="tab"
                        aria-controls="history-pane"
                        aria-selected="false"
                      >
                        Timeline
                      </button>
                    </li>
                  </ul>
                </div>

                <div className="tab-content">
                  <div className="tab-pane fade show active" id="info-pane" role="tabpanel" aria-labelledby="info-tab">
                    <div className="card-body">
                      <div className="row g-3">
                        <div className="col-12">
                          <div className="form-label text-secondary mb-1">Description</div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</div>
                        </div>
                        {ticket.problem && (
                          <div className="col-12">
                            <div className="form-label text-secondary mb-1">Problem</div>
                            {/* Always Tiptap-generated by an admin through this app's own
                                editor (never raw external/pasted HTML) — safe to render. */}
                            <div dangerouslySetInnerHTML={{ __html: ticket.problem }} />
                          </div>
                        )}
                        {ticket.solution && (
                          <div className="col-12">
                            <div className="form-label text-secondary mb-1">Solution</div>
                            <div dangerouslySetInnerHTML={{ __html: ticket.solution }} />
                          </div>
                        )}
                        <div className="col-md-6">
                          <div className="form-label text-secondary mb-1">Category</div>
                          <div>{ticket.Category.name}</div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-label text-secondary mb-1">Telephone</div>
                          <div>{ticket.telephone ?? <span className="text-secondary">—</span>}</div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-label text-secondary mb-1">Company</div>
                          <div>{ticket.Company.name}</div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-label text-secondary mb-1">Department</div>
                          <div>{ticket.Department.name}</div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-label text-secondary mb-1">Created by</div>
                          <div>
                            {ticket.User_Ticket_createdByIdToUser.name}{" "}
                            <span className="text-secondary">({ticket.User_Ticket_createdByIdToUser.email})</span>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-label text-secondary mb-1">Assignee</div>
                          <div>{formatAssignment(ticket.TicketAssignee.map((a) => a.User.name), [])}</div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-label text-secondary mb-1">Transaction Date</div>
                          <div>{formatDateTime(ticket.transactionDate)}</div>
                        </div>
                        {ticket.ratingScore && (
                          <div className="col-12">
                            <div className="form-label text-secondary mb-1">Rating</div>
                            <div className="d-flex align-items-center gap-2">
                              <i
                                className={`bi ${RATING_SCALE.find((r) => r.score === ticket.ratingScore)?.icon} fs-4`}
                                aria-hidden="true"
                              ></i>
                              <span>{RATING_SCALE.find((r) => r.score === ticket.ratingScore)?.label}</span>
                            </div>
                            {ticket.ratingComment && (
                              <div className="text-secondary mt-1" style={{ whiteSpace: "pre-wrap" }}>
                                {ticket.ratingComment}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="col-12">
                          <div className="form-label text-secondary mb-1">Attachments</div>
                          {ticket.attachments.length === 0 ? (
                            <div className="text-secondary">No attachments.</div>
                          ) : (
                            <ul className="list-unstyled mb-0">
                              {ticket.attachments.map((attachment) => (
                                <li key={attachment}>
                                  <a href={attachment} target="_blank" rel="noopener noreferrer">
                                    <i className="bi bi-paperclip me-1" aria-hidden="true"></i>
                                    {getAttachmentName(attachment)}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="tab-pane fade" id="comment-pane" role="tabpanel" aria-labelledby="comment-tab">
                    <div className="card-body">
                      {comments.length === 0 ? (
                        <p className="text-secondary mb-0">No comments yet.</p>
                      ) : (
                        <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                          {comments.map((comment) => (
                            <li key={comment.id} className="border rounded p-3">
                              <div className="d-flex justify-content-between align-items-baseline mb-1">
                                <span className="fw-medium">
                                  {comment.User.name}{" "}
                                  {comment.User.role === "ADMIN" && (
                                    <span className="badge text-bg-danger ms-1">Admin</span>
                                  )}
                                </span>
                                <span className="fs-7 text-secondary">{formatDateTime(comment.createdAt)}</span>
                              </div>
                              <div style={{ whiteSpace: "pre-wrap" }}>{comment.message}</div>
                              {comment.attachments.length > 0 && (
                                <ul className="list-unstyled mb-0 mt-2">
                                  {comment.attachments.map((attachment) => (
                                    <li key={attachment}>
                                      <a href={attachment} target="_blank" rel="noopener noreferrer">
                                        <i className="bi bi-paperclip me-1" aria-hidden="true"></i>
                                        {getAttachmentName(attachment)}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <AddCommentForm ticketId={ticket.id} />
                    </div>
                  </div>

                  <div className="tab-pane fade" id="history-pane" role="tabpanel" aria-labelledby="history-tab">
                    <div className="card-body">
                      {history.length === 0 ? (
                        <p className="text-secondary mb-0">No history yet.</p>
                      ) : (
                        <div className="timeline">
                          {groupHistoryByDay(history).map((group) => (
                            // Every entry (and the time-label) must be a direct
                            // child of `.timeline` — AdminLTE's CSS positions
                            // `.timeline-icon` relative to `.timeline>div`
                            // specifically, so a nested wrapper here would stack
                            // every icon in the group on top of each other.
                            <Fragment key={group.dayLabel}>
                              <div className="time-label">
                                <span className="text-bg-secondary">{group.dayLabel}</span>
                              </div>
                              {group.entries.map((entry) => {
                                const { icon, color } = historyIcon(entry.action);
                                const hasBody = Boolean(entry.previousState || entry.newState);
                                // "Closed by X (Supervisor): ..." / "Approved by X
                                // (Supervisor)" already name the actor — prefixing
                                // "X — " too would just repeat the name.
                                const actionNamesActor =
                                  entry.action.startsWith("Closed by ") || entry.action.startsWith("Approved by ");
                                return (
                                  <div key={entry.id}>
                                    <i className={`timeline-icon bi ${icon} text-bg-${color}`}> </i>
                                    <div className="timeline-item">
                                      <span className="time">
                                        <i className="bi bi-clock-fill" aria-hidden="true"></i>{" "}
                                        {formatTime(entry.timestamp)}
                                      </span>
                                      <h3 className={`timeline-header ${hasBody ? "" : "no-border"}`}>
                                        {!actionNamesActor && (
                                          <>
                                            <span className="fw-medium">{entry.User?.name ?? "System"}</span> —{" "}
                                          </>
                                        )}
                                        {entry.action}
                                      </h3>
                                      {hasBody && (
                                        <div className="timeline-body">
                                          {entry.previousState && entry.newState
                                            ? `${entry.previousState} → ${entry.newState}`
                                            : entry.newState}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </Fragment>
                          ))}
                          <div>
                            <i className="timeline-icon bi bi-clock-fill text-bg-secondary"> </i>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card-footer d-flex gap-2 justify-content-end align-items-center">
                  {isAdmin && ticket.status !== "CLOSED" && (
                    <AssignButton
                      ticketId={ticket.id}
                      status={ticket.status}
                      priority={ticket.priority}
                      assigneeIds={ticket.TicketAssignee.map((a) => a.userId)}
                      assignedGroupIds={ticket.TicketAssignedGroup.map((g) => g.userGroupId)}
                      assignees={assignees}
                      groups={groups}
                    />
                  )}
                  {(isAdmin || isAssignee) &&
                    ticket.status !== "CLOSED" &&
                    (ticket.status === "WAITING" ? (
                      <span className="text-secondary fs-7">Awaiting supervisor approval</span>
                    ) : (
                      <RequestApprovalButton
                        ticketId={ticket.id}
                        companyId={ticket.companyId}
                        supervisor={ticket.Department.User_Department_supervisorIdToUser}
                      />
                    ))}
                  {isAssignee && ticket.status === "ASSIGNED" && (
                    <>
                      <MarkResolvedButton ticketId={ticket.id} />
                      <CancelAssignmentButton ticketId={ticket.id} />
                    </>
                  )}
                  {isSupervisor && approval?.status === "PENDING" && (
                    <ApprovalDecisionButton
                      approvalId={approval.id}
                      trigger="buttons"
                      info={{
                        ticketNumber: ticket.ticketNumber,
                        title: ticket.title,
                        categoryName: ticket.Category.name,
                        companyName: ticket.Company.name,
                        departmentName: ticket.Department.name,
                        priority: ticket.priority,
                        status: ticket.status,
                        requestedByName: ticket.User_Ticket_createdByIdToUser.name,
                        requestMessage: approval.requestMessage,
                        requestedAt: approval.createdAt,
                      }}
                    />
                  )}
                  {isAdmin && (
                    <Link href={`/master/lesson-learned/new?ticketId=${ticket.id}`} className="btn btn-outline-primary">
                      <i className="bi bi-journal-plus me-1" aria-hidden="true"></i>
                      Convert to Lesson Learned
                    </Link>
                  )}
                  <Link href={backHref} className="btn btn-secondary">
                    <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>
                    Back
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
