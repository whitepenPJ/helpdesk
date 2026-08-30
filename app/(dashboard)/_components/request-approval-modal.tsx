"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { requestTicketApproval, type RequestApprovalState } from "@/app/actions/tickets";
import { useMounted } from "./use-mounted";

// Loose shim — just the bits of SweetAlert2's API this component calls. Same
// CDN-loaded, per-component pattern as MarkResolvedButton/DeleteButton;
// next/script dedupes by src so this doesn't double-load it alongside those.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

type Approver = { name: string; email: string };

// Shared between Ticket Management's row actions (⋮ dropdown) and the
// ticket detail page — both admin surfaces get the same Request Approve
// entry point.
export function RequestApprovalButton({
  ticketId,
  companyId,
  approvers,
  disabled,
  variant = "button",
  redirectOnSuccessTo,
}: {
  ticketId: string;
  companyId: string;
  approvers: Approver[];
  disabled?: boolean;
  variant?: "button" | "dropdown-item";
  /** When set, success shows an OK-button confirmation instead of just
   * refreshing in place, and OK navigates here (the Assigned Ticket table,
   * for the assignee's own request-approval flow). */
  redirectOnSuccessTo?: string;
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
          approvers={approvers}
          onClose={() => setOpen(false)}
          redirectOnSuccessTo={redirectOnSuccessTo}
        />
      )}
    </>
  );
}

function RequestApprovalModal({
  ticketId,
  companyId,
  approvers,
  onClose,
  redirectOnSuccessTo,
}: {
  ticketId: string;
  companyId: string;
  approvers: Approver[];
  onClose: () => void;
  redirectOnSuccessTo?: string;
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
    if (!state?.success) return;
    onClose();
    if (redirectOnSuccessTo) {
      window.Swal?.fire({ title: "Sent", text: "Approval request sent.", icon: "success" }).then(() => {
        router.push(redirectOnSuccessTo);
      });
      return;
    }
    router.refresh();
  }, [state, router, onClose, redirectOnSuccessTo]);

  if (!mounted) return null;

  return createPortal(
    <>
      <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" strategy="afterInteractive" />
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <form action={formAction}>
              <div className="modal-header">
                <h5 className="modal-title">Request approver approval</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
              <div className="modal-body text-start">
                {approvers.length > 0 ? (
                  <>
                    <div className="form-label text-secondary mb-1">Approver{approvers.length > 1 ? "s" : ""}</div>
                    <ul className="mb-3">
                      {approvers.map((approver) => (
                        <li key={approver.email}>
                          {approver.name} <span className="text-secondary">({approver.email})</span>
                        </li>
                      ))}
                    </ul>
                    <label htmlFor="approval-message" className="form-label">
                      Message to approver{approvers.length > 1 ? "s" : ""}
                    </label>
                    <textarea id="approval-message" name="message" className="form-control" rows={3} />
                  </>
                ) : (
                  <>
                    <p className="text-danger mb-1">This ticket&apos;s department has no approver assigned.</p>
                    <Link href={`/master/company/${companyId}/edit`} target="_blank" rel="noopener noreferrer">
                      + Add approver
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
                <button type="submit" className="btn btn-primary" disabled={pending || approvers.length === 0}>
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
