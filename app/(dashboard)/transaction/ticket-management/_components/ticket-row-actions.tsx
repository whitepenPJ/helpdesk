"use client";

import { useState } from "react";
import Link from "next/link";
import { TicketActionModal, type ModalTicket } from "./ticket-action-modal";

type Option = { id: string; name: string };

const BACK_TO = "/transaction/ticket-management";

// View and Edit both land on the existing ticket detail page (not the
// ticket creation/edit form) — View read-only, Edit in ?edit=1 mode, which
// shows the assign-to-user/group editor there, with its own Back button
// returning here via the `back` param. More (⋮) instead opens the same
// assignment modal inline, without leaving this page.
export function TicketRowActions({
  ticket,
  assignees,
  groups,
}: {
  ticket: ModalTicket;
  assignees: Option[];
  groups: Option[];
}) {
  const [open, setOpen] = useState(false);
  const backParam = `back=${encodeURIComponent(BACK_TO)}`;

  return (
    <>
      <div className="btn-group">
        <Link
          href={`/tickets/${ticket.id}?${backParam}`}
          className="btn btn-sm btn-outline-secondary"
          title="View"
          aria-label={`View ${ticket.ticketNumber}`}
        >
          <i className="bi bi-eye" aria-hidden="true"></i>
        </Link>
        <Link
          href={`/tickets/${ticket.id}?edit=1&${backParam}`}
          className="btn btn-sm btn-outline-secondary"
          title="Edit"
          aria-label={`Edit ${ticket.ticketNumber}`}
        >
          <i className="bi bi-pencil" aria-hidden="true"></i>
        </Link>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          title="More"
          aria-label={`More actions for ${ticket.ticketNumber}`}
          onClick={() => setOpen(true)}
        >
          <i className="bi bi-three-dots-vertical" aria-hidden="true"></i>
        </button>
      </div>
      {open && (
        <TicketActionModal ticket={ticket} assignees={assignees} groups={groups} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
