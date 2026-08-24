"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { decideTicketApproval } from "@/app/actions/approvals";
import { PRIORITY_BADGE, STATUS_BADGE } from "../tickets/ticket-badges";
import { formatDateTime } from "@/app/lib/date-format";
import type { Priority, TicketStatus } from "@/app/generated/prisma/client";

// Loose shim — just the bits of SweetAlert2's API this component calls. Same
// CDN-loaded, per-component pattern as DeleteButton/RemoveButton/AssignModal/
// MarkResolvedButton; next/script dedupes by src so this doesn't double-load
// it alongside those.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

export type ApprovalTicketInfo = {
  ticketNumber: string;
  title: string;
  categoryName: string;
  companyName: string;
  departmentName: string;
  priority: Priority;
  status: TicketStatus;
  requestedByName: string;
  requestMessage: string | null;
  requestedAt: Date;
};

// Shared between the Approval Ticket list (a "⋮" trigger — the row itself no
// longer carries direct Approve/Reject buttons) and the ticket detail page's
// own Approve/Reject buttons, so a supervisor gets the identical review
// modal — ticket info, the admin's request message, a reason field, and
// both decisions — no matter where they act from.
export function ApprovalDecisionButton({
  approvalId,
  info,
  trigger,
}: {
  approvalId: string;
  info: ApprovalTicketInfo;
  trigger: "icon" | "buttons";
}) {
  // "icon" (list row's ⋮ trigger) opens one modal offering both decisions.
  // "buttons" (detail page's separate Approve/Reject buttons) pre-selects
  // which decision the modal should act on, so each button's modal only
  // shows that one action.
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);

  return (
    <>
      {trigger === "icon" ? (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          title="Review"
          aria-label={`Review ${info.ticketNumber}`}
          onClick={() => setOpen(true)}
        >
          <i className="bi bi-three-dots" aria-hidden="true"></i>
        </button>
      ) : (
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-success" onClick={() => setDecision("APPROVED")}>
            <i className="bi bi-check-lg me-1" aria-hidden="true"></i>
            Approve
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setDecision("REJECTED")}>
            <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
            Reject
          </button>
        </div>
      )}
      {open && <ApprovalDecisionModal approvalId={approvalId} info={info} decision={null} onClose={() => setOpen(false)} />}
      {decision && (
        <ApprovalDecisionModal
          approvalId={approvalId}
          info={info}
          decision={decision}
          onClose={() => setDecision(null)}
        />
      )}
    </>
  );
}

function ApprovalDecisionModal({
  approvalId,
  info,
  decision: fixedDecision,
  onClose,
}: {
  approvalId: string;
  info: ApprovalTicketInfo;
  // Null means the modal itself offers both decisions (list row's ⋮
  // trigger); a fixed value means the caller already chose one (detail
  // page's separate Approve/Reject buttons), so only that action shows.
  decision: "APPROVED" | "REJECTED" | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<"APPROVED" | "REJECTED" | null>(null);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED" && !reason.trim()) {
      setError("Enter a reason for rejecting.");
      return;
    }

    const swal = window.Swal;
    if (swal) {
      const { isConfirmed } = await swal.fire({
        title: "Confirm",
        text: `${decision === "APPROVED" ? "Approve" : "Reject"} ticket ${info.ticketNumber}?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: decision === "APPROVED" ? "Yes, approve" : "Yes, reject",
        cancelButtonText: "Cancel",
      });
      if (!isConfirmed) return;
    }

    const formData = new FormData();
    formData.set("reason", reason);
    setError(null);
    setPendingDecision(decision);
    startTransition(async () => {
      const result = await decideTicketApproval(approvalId, decision, undefined, formData);
      if (result?.error) {
        setError(result.error);
        setPendingDecision(null);
        return;
      }
      router.refresh();
      await window.Swal?.fire({
        title: "Done",
        text: `Ticket ${decision === "APPROVED" ? "approved" : "rejected"}.`,
        icon: "success",
        confirmButtonText: "OK",
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
              <h5 className="modal-title">
                {fixedDecision === "APPROVED" ? "Approve" : fixedDecision === "REJECTED" ? "Reject" : "Approval"} —{" "}
                {info.ticketNumber}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body text-start">
              <dl className="row mb-3">
                <dt className="col-4">Title</dt>
                <dd className="col-8">{info.title}</dd>
                <dt className="col-4">Category</dt>
                <dd className="col-8">{info.categoryName}</dd>
                <dt className="col-4">Company</dt>
                <dd className="col-8">
                  {info.companyName} / {info.departmentName}
                </dd>
                <dt className="col-4">Priority</dt>
                <dd className="col-8">
                  <span className={`badge ${PRIORITY_BADGE[info.priority]}`}>{info.priority}</span>
                </dd>
                <dt className="col-4">Status</dt>
                <dd className="col-8">
                  <span className={`badge ${STATUS_BADGE[info.status]}`}>{info.status}</span>
                </dd>
                <dt className="col-4">Requested by</dt>
                <dd className="col-8">{info.requestedByName}</dd>
                <dt className="col-4">Requested at</dt>
                <dd className="col-8">{formatDateTime(info.requestedAt)}</dd>
                <dt className="col-4">Message</dt>
                <dd className="col-8">{info.requestMessage ?? "—"}</dd>
              </dl>
              <label htmlFor="approval-decision-reason" className="form-label">
                Reason{" "}
                {fixedDecision === "APPROVED"
                  ? "(optional)"
                  : fixedDecision === "REJECTED"
                    ? "(required)"
                    : "(required to reject)"}
              </label>
              <textarea
                id="approval-decision-reason"
                className="form-control"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
              />
              {error && <div className="text-danger small mt-2">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
                <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                Cancel
              </button>
              {fixedDecision !== "APPROVED" && (
                <button type="button" className="btn btn-danger" onClick={() => decide("REJECTED")} disabled={isPending}>
                  <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                  {isPending && pendingDecision === "REJECTED" ? "Saving…" : "Reject"}
                </button>
              )}
              {fixedDecision !== "REJECTED" && (
                <button type="button" className="btn btn-success" onClick={() => decide("APPROVED")} disabled={isPending}>
                  <i className="bi bi-check-lg me-1" aria-hidden="true"></i>
                  {isPending && pendingDecision === "APPROVED" ? "Saving…" : "Approve"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
