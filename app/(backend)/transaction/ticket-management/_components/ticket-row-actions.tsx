import Link from "next/link";
import { AssignButton } from "../../../_components/assign-modal";
import { RequestApprovalButton } from "../../../_components/request-approval-modal";
import { DeleteTicketButton } from "../../../tickets/delete-ticket-button";
import type { TicketStatus, Priority } from "@/app/generated/prisma/client";

type Option = { id: string; name: string };
type Approver = { name: string; email: string };

export type ModalTicket = {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  priority: Priority;
  companyId: string;
  assigneeIds: string[];
  assignedGroupIds: string[];
  approvers: Approver[];
  deletedAt: Date | null;
};

// View lands on /transaction/ticket-management/[id] (a thin wrapper around
// the same ticket-detail content /tickets/[id] renders — see
// ticket-detail-content.tsx). The ⋮ dropdown's Assign / Request Approve
// open the same modals that page's own header/footer use, so all three
// admin entry points (this row, that page's "Assign" button, that page's
// "Request Approve" button) share one implementation each.
export function TicketRowActions({
  ticket,
  assignees,
  groups,
}: {
  ticket: ModalTicket;
  assignees: Option[];
  groups: Option[];
}) {
  return (
    <div className="btn-group">
      <Link
        href={`/transaction/ticket-management/${ticket.id}`}
        className="btn btn-sm btn-outline-secondary"
        title="View"
        aria-label={`View ${ticket.ticketNumber}`}
      >
        <i className="bi bi-eye" aria-hidden="true"></i>
      </Link>
      {ticket.status !== "CLOSED" && !ticket.deletedAt && (
        <Link
          href={`/transaction/ticket-management/${ticket.id}?edit=1`}
          className="btn btn-sm btn-outline-secondary"
          title="Edit"
          aria-label={`Edit ${ticket.ticketNumber}`}
        >
          <i className="bi bi-pencil" aria-hidden="true"></i>
        </Link>
      )}
      <div className="btn-group">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary dropdown-toggle"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          aria-label={`More actions for ${ticket.ticketNumber}`}
        >
          <i className="bi bi-three-dots-vertical" aria-hidden="true"></i>
        </button>
        <ul className="dropdown-menu dropdown-menu-end">
          {ticket.status !== "CLOSED" && (
            <>
              <li>
                <AssignButton
                  ticketId={ticket.id}
                  status={ticket.status}
                  priority={ticket.priority}
                  assigneeIds={ticket.assigneeIds}
                  assignedGroupIds={ticket.assignedGroupIds}
                  assignees={assignees}
                  groups={groups}
                  variant="dropdown-item"
                />
              </li>
              <li>
                <RequestApprovalButton
                  ticketId={ticket.id}
                  companyId={ticket.companyId}
                  approvers={ticket.approvers}
                  disabled={ticket.status === "WAITING"}
                  variant="dropdown-item"
                />
              </li>
            </>
          )}
          {!ticket.deletedAt && (
            <li>
              <DeleteTicketButton ticketId={ticket.id} ticketNumber={ticket.ticketNumber} variant="dropdown-item" />
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
