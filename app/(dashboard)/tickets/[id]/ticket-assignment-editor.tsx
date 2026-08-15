"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTicket } from "@/app/actions/tickets";
import type { TicketStatus, Priority } from "@/app/generated/prisma/client";
import { PRIORITIES } from "../ticket-badges";
import { RequestApprovalButton } from "../../_components/request-approval-modal";
import { RichTextEditor } from "../../_components/rich-text-editor";

type Option = { id: string; name: string };
type Supervisor = { name: string; email: string } | null;

// Admin-only editor embedded on the ticket detail page (entered via
// Ticket Management's Edit/More links, ?edit=1) — same assignment +
// status-transition logic the Ticket Management modal used to have,
// just inline instead of a popup.
export function TicketAssignmentEditor({
  ticketId,
  status,
  priority,
  assigneeId,
  assignedGroupId,
  assignees,
  groups,
  supervisor,
  problem,
  solution,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: Priority;
  assigneeId: string | null;
  assignedGroupId: string | null;
  assignees: Option[];
  groups: Option[];
  supervisor: Supervisor;
  problem: string | null;
  solution: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"save" | TicketStatus | null>(null);
  const [assigneeValue, setAssigneeValue] = useState(assigneeId ?? "");
  const [groupValue, setGroupValue] = useState(assignedGroupId ?? "");
  const [priorityValue, setPriorityValue] = useState<Priority>(priority);
  const [problemValue, setProblemValue] = useState(problem ?? "");
  const [solutionValue, setSolutionValue] = useState(solution ?? "");
  // Verified/Re-Open are only meaningful once someone has already marked the
  // ticket Resolved elsewhere in its workflow.
  const canReviewResolution = status === "RESOLVED";

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
      await updateTicket(ticketId, formData);
      router.refresh();
    });
  }

  return (
    <div className="card card-outline card-primary mb-4">
      <div className="card-header">
        <div className="card-title">Assign &amp; Status</div>
      </div>
      <div className="card-body">
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="edit-assignee">
              Assign to user
            </label>
            <select
              id="edit-assignee"
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
            <label className="form-label" htmlFor="edit-group">
              Assign to group
            </label>
            <select
              id="edit-group"
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
            <label className="form-label" htmlFor="edit-priority">
              Priority
            </label>
            <select
              id="edit-priority"
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
          <div className="col-12">
            <label className="form-label">Problem</label>
            <RichTextEditor name="problem" defaultValue={problem ?? ""} onChange={setProblemValue} />
          </div>
          <div className="col-12">
            <label className="form-label">Solution</label>
            <RichTextEditor name="solution" defaultValue={solution ?? ""} onChange={setSolutionValue} />
          </div>
        </div>
      </div>
      <div className="card-footer d-flex gap-2 justify-content-end align-items-center flex-wrap">
        {status === "WAITING" ? (
          <span className="text-secondary fs-7 me-auto">Awaiting supervisor approval</span>
        ) : (
          <div className="me-auto">
            <RequestApprovalButton ticketId={ticketId} supervisor={supervisor} />
          </div>
        )}
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
  );
}
