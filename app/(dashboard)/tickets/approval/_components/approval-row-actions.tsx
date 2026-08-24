import Link from "next/link";
import { ApprovalDecisionButton, type ApprovalTicketInfo } from "../../../_components/approval-decision-modal";

export function ApprovalRowActions({
  approvalId,
  ticketId,
  ticketNumber,
  info,
}: {
  approvalId: string;
  ticketId: string;
  ticketNumber: string;
  info: ApprovalTicketInfo;
}) {
  return (
    <div className="btn-group">
      <Link
        href={`/tickets/approval/${ticketId}`}
        className="btn btn-sm btn-outline-secondary"
        title="Edit"
        aria-label={`Edit ${ticketNumber}`}
      >
        <i className="bi bi-pencil" aria-hidden="true"></i>
      </Link>
      <ApprovalDecisionButton approvalId={approvalId} info={info} trigger="icon" />
    </div>
  );
}
