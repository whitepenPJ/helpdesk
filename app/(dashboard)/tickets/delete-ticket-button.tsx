"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { deleteTicket } from "@/app/actions/tickets";

// Loose shim — just the bits of SweetAlert2's API this component calls. Same
// CDN-loaded, per-component pattern as MarkResolvedButton/CancelAssignmentButton;
// next/script dedupes by src so this doesn't double-load it alongside them.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

// Ticket delete is soft (see deleteTicket in app/actions/tickets.ts) and
// needs a reason, so it can't reuse the generic DeleteButton (plain
// SweetAlert confirm, no text field) — this is its own modal, matching the
// confirm-gate-before-submit pattern already used by MarkResolvedButton and
// CancelAssignmentButton.
export function DeleteTicketButton({
  ticketId,
  ticketNumber,
  variant = "icon",
}: {
  ticketId: string;
  ticketNumber: string;
  variant?: "icon" | "dropdown-item";
}) {
  const [open, setOpen] = useState(false);

  if (variant === "dropdown-item") {
    return (
      <>
        <button type="button" className="dropdown-item text-danger" onClick={() => setOpen(true)}>
          <i className="bi bi-trash me-2" aria-hidden="true"></i>
          Delete
        </button>
        {open && <DeleteTicketModal ticketId={ticketId} ticketNumber={ticketNumber} onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-outline-secondary"
        title="Delete"
        aria-label={`Delete ${ticketNumber}`}
        onClick={() => setOpen(true)}
      >
        <i className="bi bi-trash" aria-hidden="true"></i>
      </button>
      {open && <DeleteTicketModal ticketId={ticketId} ticketNumber={ticketNumber} onClose={() => setOpen(false)} />}
    </>
  );
}

function DeleteTicketModal({
  ticketId,
  ticketNumber,
  onClose,
}: {
  ticketId: string;
  ticketNumber: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  async function handleDelete() {
    const swal = window.Swal;
    if (swal) {
      const { isConfirmed } = await swal.fire({
        title: "Confirm",
        text: `Delete ticket "${ticketNumber}"? This cannot be undone.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete it",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc3545",
      });
      if (!isConfirmed) return;
    }

    const formData = new FormData();
    formData.set("reason", reason);
    setError(null);
    startTransition(async () => {
      const result = await deleteTicket(ticketId, undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
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
              <h5 className="modal-title">Delete Ticket — {ticketNumber}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body text-start">
              <p className="text-secondary">
                This won&apos;t remove the ticket&apos;s data — it&apos;ll be hidden and marked as deleted.
              </p>
              <label htmlFor="delete-ticket-reason" className="form-label">
                Reason
              </label>
              <textarea
                id="delete-ticket-reason"
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
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={isPending || !reason.trim()}
              >
                <i className="bi bi-trash me-1" aria-hidden="true"></i>
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
