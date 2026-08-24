import Link from "next/link";
import { AssignButton } from "../../../_components/assign-modal";
import { RequestApprovalButton } from "../../../_components/request-approval-modal";
import type { TicketStatus, Priority } from "@/app/generated/prisma/client";

type Option = { id: string; name: string };
type Supervisor = { name: string; email: string } | null;

export type ModalTicket = {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  priority: Priority;
  companyId: string;
  assigneeIds: string[];
  assignedGroupIds: string[];
  supervisor: Supervisor;
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
      {ticket.status !== "CLOSED" && (
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
                supervisor={ticket.supervisor}
                disabled={ticket.status === "WAITING"}
                variant="dropdown-item"
              />
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
