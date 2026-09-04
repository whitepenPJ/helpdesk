"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAssignment } from "@/app/actions/tickets";
import { swal } from "@/app/lib/swal";

// The individual assignee's way to back out of a ticket they believe was
// wrongly assigned to them — requires a reason (kept in TicketHistory for
// whoever reassigns it next). Same manual-FormData-inside-a-transition
// pattern as MarkResolvedButton, needed because of the async SweetAlert
// confirm gate before the server action fires.
export function CancelAssignmentButton({
  ticketId,
  redirectOnSuccessTo,
}: {
  ticketId: string;
  /** When set, success shows an OK-button confirmation instead of the
   * default auto-dismissing toast, and OK navigates here (the Assigned
   * Ticket table, for the assignee's own cancel flow). */
  redirectOnSuccessTo?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
        <i className="bi bi-x-octagon me-1" aria-hidden="true"></i>
        Cancel Assignment
      </button>
      {open && (
        <CancelAssignmentModal
          ticketId={ticketId}
          onClose={() => setOpen(false)}
          redirectOnSuccessTo={redirectOnSuccessTo}
        />
      )}
    </>
  );
}

function CancelAssignmentModal({
  ticketId,
  onClose,
  redirectOnSuccessTo,
}: {
  ticketId: string;
  onClose: () => void;
  redirectOnSuccessTo?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  async function handleCancel() {
    const { isConfirmed } = await swal.fire({
      title: "Confirm",
      text: "Cancel your assignment on this ticket?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, cancel it",
      cancelButtonText: "Back",
    });
    if (!isConfirmed) return;

    const formData = new FormData();
    formData.set("reason", reason);
    setError(null);
    startTransition(async () => {
      const result = await cancelAssignment(ticketId, undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onClose();
      if (redirectOnSuccessTo) {
        await swal.fire({ title: "Done", text: "Assignment cancelled.", icon: "success" });
        router.push(redirectOnSuccessTo);
        return;
      }
      router.refresh();
      await swal.fire({
        title: "Done",
        text: "Assignment cancelled.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    });
  }

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Cancel Assignment</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body text-start">
              <p className="text-secondary">Tell us why this ticket was wrongly assigned to you.</p>
              <label htmlFor="cancel-assignment-reason" className="form-label">
                Reason
              </label>
              <textarea
                id="cancel-assignment-reason"
                className="form-control"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
                required
              />
              {error && <div className="text-danger small mt-2">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
                <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                Back
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancel}
                disabled={isPending || !reason.trim()}
              >
                <i className="bi bi-x-octagon me-1" aria-hidden="true"></i>
                {isPending ? "Saving…" : "Cancel Assignment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
