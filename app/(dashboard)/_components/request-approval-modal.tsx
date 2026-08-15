"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestTicketApproval, type RequestApprovalState } from "@/app/actions/tickets";

type Supervisor = { name: string; email: string } | null;

// Shared between Ticket Management's modal ("More") and the ticket detail
// page's inline editor ("Edit") — both admin edit surfaces get the same
// Request Approve entry point.
export function RequestApprovalButton({
  ticketId,
  supervisor,
  disabled,
}: {
  ticketId: string;
  supervisor: Supervisor;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Request Approve
      </button>
      {open && <RequestApprovalModal ticketId={ticketId} supervisor={supervisor} onClose={() => setOpen(false)} />}
    </>
  );
}

function RequestApprovalModal({
  ticketId,
  supervisor,
  onClose,
}: {
  ticketId: string;
  supervisor: Supervisor;
  onClose: () => void;
}) {
  const router = useRouter();
  const action = requestTicketApproval.bind(null, ticketId);
  const [state, formAction, pending] = useActionState<RequestApprovalState, FormData>(action, undefined);

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
                <h5 className="modal-title">Request supervisor approval</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
              <div className="modal-body text-start">
                {supervisor ? (
                  <>
                    <div className="form-label text-secondary mb-1">Supervisor</div>
                    <div className="mb-3">
                      {supervisor.name} <span className="text-secondary">({supervisor.email})</span>
                    </div>
                    <label htmlFor="approval-message" className="form-label">
                      Message to supervisor
                    </label>
                    <textarea id="approval-message" name="message" className="form-control" rows={3} />
                  </>
                ) : (
                  <p className="text-danger mb-0">This ticket&apos;s department has no supervisor assigned.</p>
                )}
                {state?.error && <div className="text-danger small mt-2">{state.error}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending || !supervisor}>
                  {pending ? "Sending…" : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
