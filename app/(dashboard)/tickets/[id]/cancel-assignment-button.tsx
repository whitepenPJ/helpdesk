"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { cancelAssignment } from "@/app/actions/tickets";

// Loose shim — just the bits of SweetAlert2's API this component calls. Same
// CDN-loaded, per-component pattern as MarkResolvedButton/AssignModal;
// next/script dedupes by src so this doesn't double-load it alongside those.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

// The individual assignee's way to back out of a ticket they believe was
// wrongly assigned to them — requires a reason (kept in TicketHistory for
// whoever reassigns it next). Same manual-FormData-inside-a-transition
// pattern as MarkResolvedButton, needed because of the async SweetAlert
// confirm gate before the server action fires.
export function CancelAssignmentButton({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-outline-danger" onClick={() => setOpen(true)}>
        <i className="bi bi-x-octagon me-1" aria-hidden="true"></i>
        Cancel Assignment
      </button>
      {open && <CancelAssignmentModal ticketId={ticketId} onClose={() => setOpen(false)} />}
    </>
  );
}

function CancelAssignmentModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  async function handleCancel() {
    const swal = window.Swal;
    if (swal) {
      const { isConfirmed } = await swal.fire({
        title: "Confirm",
        text: "Cancel your assignment on this ticket?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, cancel it",
        cancelButtonText: "Back",
      });
      if (!isConfirmed) return;
    }

    const formData = new FormData();
    formData.set("reason", reason);
    setError(null);
    startTransition(async () => {
      const result = await cancelAssignment(ticketId, undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      await window.Swal?.fire({
        title: "Done",
        text: "Assignment cancelled.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      onClose();
    });
  }

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" strategy="afterInteractive" />
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
