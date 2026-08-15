"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { decideTicketApproval, type DecideApprovalState } from "@/app/actions/approvals";

export function ApprovalRowActions({ approvalId, ticketId, ticketNumber }: { approvalId: string; ticketId: string; ticketNumber: string }) {
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);

  return (
    <>
      <div className="btn-group">
        <Link
          href={`/tickets/${ticketId}`}
          className="btn btn-sm btn-outline-secondary"
          title="View"
          aria-label={`View ${ticketNumber}`}
        >
          <i className="bi bi-eye" aria-hidden="true"></i>
        </Link>
        <button type="button" className="btn btn-sm btn-success" onClick={() => setDecision("APPROVED")}>
          Approve
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={() => setDecision("REJECTED")}>
          Reject
        </button>
      </div>
      {decision && (
        <DecisionModal
          approvalId={approvalId}
          ticketNumber={ticketNumber}
          decision={decision}
          onClose={() => setDecision(null)}
        />
      )}
    </>
  );
}

function DecisionModal({
  approvalId,
  ticketNumber,
  decision,
  onClose,
}: {
  approvalId: string;
  ticketNumber: string;
  decision: "APPROVED" | "REJECTED";
  onClose: () => void;
}) {
  const router = useRouter();
  const action = decideTicketApproval.bind(null, approvalId, decision);
  const [state, formAction, pending] = useActionState<DecideApprovalState, FormData>(action, undefined);
  const isReject = decision === "REJECTED";

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
                <h5 className="modal-title">
                  {isReject ? "Reject" : "Approve"} {ticketNumber}
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
              <div className="modal-body text-start">
                <label htmlFor="decision-reason" className="form-label">
                  Reason {isReject ? "" : "(optional)"}
                </label>
                <textarea id="decision-reason" name="reason" className="form-control" rows={3} required={isReject} />
                {state?.error && <div className="text-danger small mt-2">{state.error}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
                  Cancel
                </button>
                <button type="submit" className={`btn ${isReject ? "btn-danger" : "btn-success"}`} disabled={pending}>
                  {pending ? "Saving…" : isReject ? "Reject" : "Approve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
