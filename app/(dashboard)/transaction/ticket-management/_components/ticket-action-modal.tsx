"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTicket } from "@/app/actions/tickets";
import type { TicketStatus, Priority } from "@/app/generated/prisma/client";
import { STATUS_BADGE, PRIORITIES } from "../../../tickets/ticket-badges";
import { formatDateTime } from "@/app/lib/date-format";
import { RequestApprovalButton } from "../../../_components/request-approval-modal";
import { RichTextEditor } from "../../../_components/rich-text-editor";

type Option = { id: string; name: string };
type Supervisor = { name: string; email: string } | null;

export type ModalTicket = {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  priority: Priority;
  description: string;
  createdAt: Date;
  creatorName: string;
  creatorEmail: string;
  assigneeId: string | null;
  assignedGroupId: string | null;
  supervisor: Supervisor;
  problem: string | null;
  solution: string | null;
};

// Hand-rolled modal (React state, not Bootstrap JS) — same approach as
// add-user-modal.tsx elsewhere in this app. Opened from the "More" (⋮)
// action; "Edit" instead goes to the ticket detail page's own edit mode.
export function TicketActionModal({
  ticket,
  assignees,
  groups,
  onClose,
}: {
  ticket: ModalTicket;
  assignees: Option[];
  groups: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"save" | TicketStatus | null>(null);
  const [assigneeValue, setAssigneeValue] = useState(ticket.assigneeId ?? "");
  const [groupValue, setGroupValue] = useState(ticket.assignedGroupId ?? "");
  const [priorityValue, setPriorityValue] = useState<Priority>(ticket.priority);
  const [problemValue, setProblemValue] = useState(ticket.problem ?? "");
  const [solutionValue, setSolutionValue] = useState(ticket.solution ?? "");
  // Verified/Re-Open are only meaningful once someone has already marked the
  // ticket Resolved — this admin screen doesn't itself have a way to set
  // RESOLVED, that happens elsewhere in the ticket's own workflow.
  const canReviewResolution = ticket.status === "RESOLVED";

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  function submit(action: "save" | TicketStatus) {
    const formData = new FormData();
    if (action !== "save") formData.set("status", action);
    formData.set("assigneeId", assigneeValue);
    formData.set("assignedGroupId", groupValue);
    formData.set("priority", priorityValue);
    formData.set("problem", problemValue);
    formData.set("solution", solutionValue);
    setPendingAction(action);
    startTransition(async () => {
      await updateTicket(ticket.id, formData);
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Ticket {ticket.ticketNumber}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body text-start">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="form-label text-secondary mb-1">Status</div>
                  <div>
                    <span className={`badge ${STATUS_BADGE[ticket.status]}`}>{ticket.status}</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-label text-secondary mb-1">Created</div>
                  <div>{formatDateTime(ticket.createdAt)}</div>
                </div>
                <div className="col-12">
                  <div className="form-label text-secondary mb-1">Creator</div>
                  <div>
                    {ticket.creatorName} <span className="text-secondary">({ticket.creatorEmail})</span>
                  </div>
                </div>
                <div className="col-12">
                  <div className="form-label text-secondary mb-1">Description</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</div>
                </div>
                <div className="col-12">
                  <label className="form-label">Problem</label>
                  <RichTextEditor name="problem" defaultValue={ticket.problem ?? ""} onChange={setProblemValue} />
                </div>
                <div className="col-12">
                  <label className="form-label">Solution</label>
                  <RichTextEditor name="solution" defaultValue={ticket.solution ?? ""} onChange={setSolutionValue} />
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="modal-assignee">
                    Assign to user
                  </label>
                  <select
                    id="modal-assignee"
                    className="form-select"
                    value={assigneeValue}
                    onChange={(e) => setAssigneeValue(e.target.value)}
                    disabled={isPending}
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="modal-group">
                    Assign to group
                  </label>
                  <select
                    id="modal-group"
                    className="form-select"
                    value={groupValue}
                    onChange={(e) => setGroupValue(e.target.value)}
                    disabled={isPending}
                  >
                    <option value="">No group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="modal-priority">
                    Priority
                  </label>
                  <select
                    id="modal-priority"
                    className="form-select"
                    value={priorityValue}
                    onChange={(e) => setPriorityValue(e.target.value as Priority)}
                    disabled={isPending}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {ticket.status === "WAITING" ? (
                <span className="text-secondary fs-7 me-auto">Awaiting supervisor approval</span>
              ) : (
                <div className="me-auto">
                  <RequestApprovalButton ticketId={ticket.id} supervisor={ticket.supervisor} />
                </div>
              )}
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => submit("save")} disabled={isPending}>
                {isPending && pendingAction === "save" ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => submit("VERIFIED")}
                disabled={isPending || !canReviewResolution}
              >
                {isPending && pendingAction === "VERIFIED" ? "Saving…" : "Verified"}
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => submit("REOPENED")}
                disabled={isPending || !canReviewResolution}
              >
                {isPending && pendingAction === "REOPENED" ? "Saving…" : "Re-Open"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
