import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { STATUS_BADGE, PRIORITY_BADGE } from "../ticket-badges";
import { AddCommentForm } from "../add-comment-form";
import { TicketAssignmentEditor } from "./ticket-assignment-editor";
import { CloseTicketButton } from "./close-ticket-modal";
import { formatDateTime } from "@/app/lib/date-format";
import { RATING_SCALE } from "@/app/lib/rating";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketDetailPage({ params, searchParams }: PageProps<"/tickets/[id]">) {
  const session = await requireUser();
  const isAdmin = session.user.role === "ADMIN";

  const { id } = await params;
  const { edit, back } = await searchParams;
  const editMode = isAdmin && edit === "1";
  // Only ever a same-origin path — never trust the query string as a raw
  // redirect target.
  const backHref = typeof back === "string" && back.startsWith("/") ? back : "/tickets";

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      Category: true,
      Company: true,
      Department: { include: { User_Department_supervisorIdToUser: { select: { name: true, email: true } } } },
      User_Ticket_createdByIdToUser: { select: { name: true, email: true } },
      User_Ticket_assigneeIdToUser: { select: { name: true, email: true } },
    },
  });

  if (!ticket) {
    notFound();
  }

  const isOwner = ticket.createdById === session.user.id;

  // Non-admins can view tickets they filed, are individually assigned, are
  // assigned to their group, or are the reviewing supervisor for.
  if (!isAdmin) {
    const isAssignee = ticket.assigneeId === session.user.id;
    let isVisible = isOwner || isAssignee;

    if (!isVisible) {
      const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { userGroupId: true } });
      isVisible = Boolean(me?.userGroupId) && me?.userGroupId === ticket.assignedGroupId;
    }

    if (!isVisible) {
      const approval = await prisma.ticketApproval.findUnique({
        where: { ticketId: id },
        select: { supervisorId: true },
      });
      isVisible = approval?.supervisorId === session.user.id;
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
    editMode
      ? prisma.user.findMany({
          where: { role: { in: ["ADMIN", "SUPERVISOR"] }, status: "ACTIVE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    editMode
      ? prisma.userGroup.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Ticket {ticket.ticketNumber}</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link href="/tickets">Tickets</Link>
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
              {editMode && (
                <TicketAssignmentEditor
                  ticketId={ticket.id}
                  status={ticket.status}
                  priority={ticket.priority}
                  assigneeId={ticket.assigneeId}
                  assignedGroupId={ticket.assignedGroupId}
                  assignees={assignees}
                  groups={groups}
                  supervisor={ticket.Department.User_Department_supervisorIdToUser}
                  problem={ticket.problem}
                  solution={ticket.solution}
                />
              )}
              <div className="card card-primary card-outline mb-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <div className="card-title">{ticket.title}</div>
                  <div className="d-flex gap-2 align-items-center">
                    <span className={`badge ${PRIORITY_BADGE[ticket.priority]}`}>{ticket.priority}</span>
                    <span className={`badge ${STATUS_BADGE[ticket.status]}`}>{ticket.status}</span>
                    {isOwner && ticket.status === "RESOLVED" && <CloseTicketButton ticketId={ticket.id} />}
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
                        Histories
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
                          <div>
                            {ticket.User_Ticket_assigneeIdToUser?.name ?? (
                              <span className="text-secondary">Unassigned</span>
                            )}
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-label text-secondary mb-1">Created at</div>
                          <div>{formatDateTime(ticket.createdAt)}</div>
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
                                    {attachment.split("/").pop()}
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
                                        {attachment.split("/").pop()}
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
                        <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                          {history.map((entry) => (
                            <li key={entry.id} className="border-bottom pb-2">
                              <div className="d-flex justify-content-between align-items-baseline">
                                <span>
                                  <span className="fw-medium">{entry.action}</span>
                                  {entry.previousState && entry.newState && (
                                    <span className="text-secondary">
                                      {" "}
                                      ({entry.previousState} → {entry.newState})
                                    </span>
                                  )}
                                  {!entry.previousState && entry.newState && (
                                    <span className="text-secondary"> ({entry.newState})</span>
                                  )}
                                </span>
                                <span className="fs-7 text-secondary">{formatDateTime(entry.timestamp)}</span>
                              </div>
                              <div className="fs-7 text-secondary">by {entry.User?.name ?? "System"}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card-footer">
                  <Link href={backHref} className="btn btn-secondary">
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
