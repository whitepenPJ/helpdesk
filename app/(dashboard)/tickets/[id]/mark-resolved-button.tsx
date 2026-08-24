"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { resolveTicket } from "@/app/actions/tickets";

// Loose shim — just the bits of SweetAlert2's API this component calls. Same
// CDN-loaded, per-component pattern as DeleteButton/RemoveButton/AssignModal;
// next/script dedupes by src so this doesn't double-load it alongside those.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

// The individual assignee's way to hand an ASSIGNED ticket back to the owner
// for closure — records what the problem was and how it was fixed first.
// Unlike CloseTicketButton's rating modal, submission needs an async
// SweetAlert confirm gate before the server action fires, so this can't use
// plain `<form action={formAction}>` (which submits immediately) — it
// manually builds FormData and calls the action inside a transition, same
// pattern as assign-modal.tsx's submit().
export function MarkResolvedButton({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <i className="bi bi-check-circle-fill me-1" aria-hidden="true"></i>
        Mark Resolved
      </button>
      {open && <MarkResolvedModal ticketId={ticketId} onClose={() => setOpen(false)} />}
    </>
  );
}

function MarkResolvedModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  async function handleResolve() {
    const swal = window.Swal;
    if (swal) {
      const { isConfirmed } = await swal.fire({
        title: "Confirm",
        text: "Mark this ticket as resolved?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, resolve",
        cancelButtonText: "Cancel",
      });
      if (!isConfirmed) return;
    }

    const formData = new FormData();
    formData.set("problem", problem);
    formData.set("solution", solution);
    setError(null);
    startTransition(async () => {
      const result = await resolveTicket(ticketId, undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      await window.Swal?.fire({
        title: "Done",
        text: "Ticket marked as resolved.",
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
              <h5 className="modal-title">Mark Resolved</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body text-start">
              <label htmlFor="resolve-problem" className="form-label">
                Problem
              </label>
              <textarea
                id="resolve-problem"
                className="form-control mb-3"
                rows={3}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                disabled={isPending}
                required
              />
              <label htmlFor="resolve-solution" className="form-label">
                Solution
              </label>
              <textarea
                id="resolve-solution"
                className="form-control"
                rows={3}
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
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
                className="btn btn-primary"
                onClick={handleResolve}
                disabled={isPending || !problem.trim() || !solution.trim()}
              >
                <i className="bi bi-check-circle-fill me-1" aria-hidden="true"></i>
                {isPending ? "Saving…" : "Resolve"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
