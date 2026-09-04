"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveTicket } from "@/app/actions/tickets";
import { swal } from "@/app/lib/swal";

// The individual assignee's way to hand an ASSIGNED ticket back to the owner
// for closure — records what the problem was and how it was fixed first.
// Unlike CloseTicketButton's rating modal, submission needs an async
// SweetAlert confirm gate before the server action fires, so this can't use
// plain `<form action={formAction}>` (which submits immediately) — it
// manually builds FormData and calls the action inside a transition, same
// pattern as assign-modal.tsx's submit().
export function MarkResolvedButton({
  ticketId,
  redirectOnSuccessTo,
}: {
  ticketId: string;
  /** When set, success shows an OK-button confirmation instead of the
   * default auto-dismissing toast, and OK navigates here (the Assigned
   * Ticket table, for the assignee's own resolve flow). */
  redirectOnSuccessTo?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <i className="bi bi-check-circle-fill me-1" aria-hidden="true"></i>
        Mark Resolved
      </button>
      {open && (
        <MarkResolvedModal ticketId={ticketId} onClose={() => setOpen(false)} redirectOnSuccessTo={redirectOnSuccessTo} />
      )}
    </>
  );
}

function MarkResolvedModal({
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
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  async function handleResolve() {
    const { isConfirmed } = await swal.fire({
      title: "Confirm",
      text: "Mark this ticket as resolved?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, resolve",
      cancelButtonText: "Cancel",
    });
    if (!isConfirmed) return;

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
      onClose();
      if (redirectOnSuccessTo) {
        await swal.fire({ title: "Done", text: "Ticket marked as resolved.", icon: "success" });
        router.push(redirectOnSuccessTo);
        return;
      }
      router.refresh();
      await swal.fire({
        title: "Done",
        text: "Ticket marked as resolved.",
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
