"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { updateTicket } from "@/app/actions/tickets";
import type { TicketStatus, Priority } from "@/app/generated/prisma/client";
import { PRIORITIES } from "../tickets/ticket-badges";
import { Select2Select } from "./select2-select";
import { useMounted } from "./use-mounted";

// Loose shim — just the bits of SweetAlert2's API this component calls. Same
// CDN-loaded, per-component pattern as DeleteButton/RemoveButton; next/script
// dedupes by src so this doesn't double-load it alongside those.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

type Option = { id: string; name: string };

// Shared "Assign & Status" surface — Assign to user/group, Priority, and the
// Resolved-ticket Re-Open review action. Used from both the ticket detail
// page (an "Assign" button) and Ticket Management's row actions (the ⋮
// dropdown's "Assign" entry), so the two never drift apart.
// Deliberately doesn't edit Problem/Solution — those aren't part of this
// flow anymore (see updateTicket in app/actions/tickets.ts, which treats
// absent problem/solution form fields as "leave unchanged").
export function AssignButton({
  ticketId,
  status,
  priority,
  assigneeIds,
  assignedGroupIds,
  assignees,
  groups,
  variant = "button",
  autoOpen = false,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: Priority;
  assigneeIds: string[];
  assignedGroupIds: string[];
  assignees: Option[];
  groups: Option[];
  variant?: "button" | "dropdown-item";
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);

  return (
    <>
      {variant === "dropdown-item" ? (
        <button type="button" className="dropdown-item" onClick={() => setOpen(true)}>
          <i className="bi bi-person-check me-2" aria-hidden="true"></i>
          Assign
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <i className="bi bi-person-check-fill me-1" aria-hidden="true"></i>
          Assign
        </button>
      )}
      {open && (
        <AssignModal
          ticketId={ticketId}
          status={status}
          priority={priority}
          assigneeIds={assigneeIds}
          assignedGroupIds={assignedGroupIds}
          assignees={assignees}
          groups={groups}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AssignModal({
  ticketId,
  status,
  priority,
  assigneeIds,
  assignedGroupIds,
  assignees,
  groups,
  onClose,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: Priority;
  assigneeIds: string[];
  assignedGroupIds: string[];
  assignees: Option[];
  groups: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"save" | TicketStatus | null>(null);
  const [assigneeValues, setAssigneeValues] = useState<string[]>(assigneeIds);
  const [groupValues, setGroupValues] = useState<string[]>(assignedGroupIds);
  const [priorityValue, setPriorityValue] = useState<Priority>(priority);
  // Re-Open is only meaningful once someone has already marked the ticket
  // Resolved elsewhere in its workflow.
  const canReviewResolution = status === "RESOLVED";
  // Portaled to <body> (below) rather than rendered in place, since this can
  // be triggered from inside a Bootstrap dropdown-menu (Ticket Management's
  // ⋮ actions) — Bootstrap hides that menu on item click, and a display:none
  // ancestor would take the modal down with it if it stayed nested inside.
  // Portals only resolve client-side, so `document.body` isn't available on
  // the very first (server) render — the mount flag defers until then.
  const mounted = useMounted();

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  async function submit(action: "save" | TicketStatus) {
    const swal = window.Swal;
    if (swal) {
      const { isConfirmed } = await swal.fire({
        title: "Confirm",
        text: "Save changes to this ticket?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, save",
        cancelButtonText: "Cancel",
      });
      if (!isConfirmed) return;
    }

    const formData = new FormData();
    if (action !== "save") formData.set("status", action);
    assigneeValues.forEach((id) => formData.append("assigneeId", id));
    groupValues.forEach((id) => formData.append("assignedGroupId", id));
    formData.set("priority", priorityValue);
    setPendingAction(action);
    startTransition(async () => {
      await updateTicket(ticketId, formData);
      router.refresh();
      await window.Swal?.fire({ title: "Done", icon: "success", timer: 1500, showConfirmButton: false });
      onClose();
    });
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" strategy="afterInteractive" />
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Assign &amp; Status</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body text-start">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label" htmlFor="assign-modal-assignee">
                    Assign to user
                  </label>
                  <Select2Select
                    name="assign-modal-assignee"
                    multiple
                    defaultValues={assigneeIds}
                    onChange={(value) => setAssigneeValues(value as string[])}
                    disabled={isPending}
                    placeholder="Unassigned"
                    options={assignees.map((a) => ({ value: a.id, label: a.name }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="assign-modal-group">
                    Assign to group
                  </label>
                  <Select2Select
                    name="assign-modal-group"
                    multiple
                    defaultValues={assignedGroupIds}
                    onChange={(value) => setGroupValues(value as string[])}
                    disabled={isPending}
                    placeholder="No group"
                    options={groups.map((g) => ({ value: g.id, label: g.name }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="assign-modal-priority">
                    Priority
                  </label>
                  <Select2Select
                    name="assign-modal-priority"
                    defaultValue={priorityValue}
                    required
                    onChange={(value) => setPriorityValue(value as Priority)}
                    disabled={isPending}
                    options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
                <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => submit("save")} disabled={isPending}>
                <i className="bi bi-check2 me-1" aria-hidden="true"></i>
                {isPending && pendingAction === "save" ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => submit("REOPENED")}
                disabled={isPending || !canReviewResolution}
              >
                <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>
                {isPending && pendingAction === "REOPENED" ? "Saving…" : "Re-Open"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
