"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { requestTicketApproval, type RequestApprovalState } from "@/app/actions/tickets";
import { useMounted } from "./use-mounted";

type Supervisor = { name: string; email: string } | null;

// Shared between Ticket Management's row actions (⋮ dropdown) and the
// ticket detail page — both admin surfaces get the same Request Approve
// entry point.
export function RequestApprovalButton({
  ticketId,
  companyId,
  supervisor,
  disabled,
  variant = "button",
}: {
  ticketId: string;
  companyId: string;
  supervisor: Supervisor;
  disabled?: boolean;
  variant?: "button" | "dropdown-item";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "dropdown-item" ? (
        <button type="button" className="dropdown-item" onClick={() => setOpen(true)} disabled={disabled}>
          <i className="bi bi-send-check me-2" aria-hidden="true"></i>
          Request Approve
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          <i className="bi bi-send-check me-1" aria-hidden="true"></i>
          Request Approve
        </button>
      )}
      {open && (
        <RequestApprovalModal
          ticketId={ticketId}
          companyId={companyId}
          supervisor={supervisor}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function RequestApprovalModal({
  ticketId,
  companyId,
  supervisor,
  onClose,
}: {
  ticketId: string;
  companyId: string;
  supervisor: Supervisor;
  onClose: () => void;
}) {
  const router = useRouter();
  const action = requestTicketApproval.bind(null, ticketId);
  const [state, formAction, pending] = useActionState<RequestApprovalState, FormData>(action, undefined);
  // Portaled to <body> (below) rather than rendered in place, since this can
  // be triggered from inside a Bootstrap dropdown-menu (Ticket Management's
  // ⋮ actions) — Bootstrap hides that menu on item click, and a display:none
  // ancestor would take the modal down with it if it stayed nested inside.
  const mounted = useMounted();

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

  if (!mounted) return null;

  return createPortal(
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
                  <>
                    <p className="text-danger mb-1">This ticket&apos;s department has no supervisor assigned.</p>
                    <Link href={`/master/company/${companyId}/edit`} target="_blank" rel="noopener noreferrer">
                      + Add supervisor
                    </Link>
                  </>
                )}
                {state?.error && <div className="text-danger small mt-2">{state.error}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
                  <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending || !supervisor}>
                  <i className="bi bi-send-check me-1" aria-hidden="true"></i>
                  {pending ? "Sending…" : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
