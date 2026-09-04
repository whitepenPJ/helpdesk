"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { closeTicket, type CloseTicketState } from "@/app/actions/tickets";
import { RATING_SCALE } from "@/app/lib/rating";

export function CloseTicketButton({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>
        <i className="bi bi-x-circle me-1" aria-hidden="true"></i>
        Close Ticket
      </button>
      {open && <CloseTicketModal ticketId={ticketId} onClose={() => setOpen(false)} />}
    </>
  );
}

function CloseTicketModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const router = useRouter();
  const action = closeTicket.bind(null, ticketId);
  const [state, formAction, pending] = useActionState<CloseTicketState, FormData>(action, undefined);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onClose();
    }
  }, [state, router, onClose]);

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <form action={formAction}>
              <div className="modal-header">
                <h5 className="modal-title">Rate &amp; close this ticket</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
              <div className="modal-body text-start">
                <input type="hidden" name="score" value={score ?? ""} />
                <div className="form-label text-secondary mb-2">How satisfied are you with the resolution?</div>
                <div className="d-flex justify-content-between mb-3">
                  {RATING_SCALE.map((option) => (
                    <button
                      key={option.score}
                      type="button"
                      className="btn btn-link text-decoration-none d-flex flex-column align-items-center p-1"
                      onClick={() => setScore(option.score)}
                      aria-pressed={score === option.score}
                    >
                      <i
                        className={`bi ${option.icon} fs-2 ${score === option.score ? "text-primary" : "text-secondary"}`}
                        aria-hidden="true"
                      ></i>
                      <span className={`fs-8 mt-1 ${score === option.score ? "text-primary fw-medium" : "text-secondary"}`}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
                <label htmlFor="close-comment" className="form-label">
                  Comment (optional)
                </label>
                <textarea id="close-comment" name="comment" className="form-control" rows={3} />
                {state?.error && <div className="text-danger small mt-2">{state.error}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
                  <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending || !score}>
                  <i className="bi bi-check2-circle me-1" aria-hidden="true"></i>
                  {pending ? "Saving…" : "Submit & Close"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
