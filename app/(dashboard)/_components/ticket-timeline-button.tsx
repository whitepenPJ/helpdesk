"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "./use-mounted";
import { formatDateTime } from "@/app/lib/date-format";

export type TicketTimelineEntry = {
  id: string;
  action: string;
  previousState: string | null;
  newState: string | null;
  timestamp: Date;
  actorName: string | null;
};

// A quick per-row "what happened when" for a ticket, without leaving the
// list — reuses the same action/time data as the ticket detail page's own
// Timeline tab, just condensed into a popover-style modal.
export function TicketTimelineButton({
  ticketNumber,
  entries,
  variant = "icon",
}: {
  ticketNumber: string;
  entries: TicketTimelineEntry[];
  variant?: "icon" | "dropdown-item";
}) {
  const [open, setOpen] = useState(false);

  if (variant === "dropdown-item") {
    return (
      <>
        <button type="button" className="dropdown-item" onClick={() => setOpen(true)}>
          <i className="bi bi-clock-history me-2" aria-hidden="true"></i>
          Timeline
        </button>
        {open && <TicketTimelineModal ticketNumber={ticketNumber} entries={entries} onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-outline-secondary"
        title="Timeline"
        aria-label={`Timeline for ${ticketNumber}`}
        onClick={() => setOpen(true)}
      >
        <i className="bi bi-clock-history" aria-hidden="true"></i>
      </button>
      {open && <TicketTimelineModal ticketNumber={ticketNumber} entries={entries} onClose={() => setOpen(false)} />}
    </>
  );
}

function TicketTimelineModal({
  ticketNumber,
  entries,
  onClose,
}: {
  ticketNumber: string;
  entries: TicketTimelineEntry[];
  onClose: () => void;
}) {
  const mounted = useMounted();

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Timeline — {ticketNumber}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {entries.length === 0 ? (
                <p className="text-secondary mb-0">No history yet.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                  {entries.map((entry) => (
                    <li key={entry.id} className="border-start border-3 ps-3">
                      <div className="d-flex justify-content-between align-items-baseline gap-2">
                        <span className="fw-medium">{entry.action}</span>
                        <span className="fs-7 text-secondary text-nowrap">{formatDateTime(entry.timestamp)}</span>
                      </div>
                      <div className="fs-7 text-secondary">
                        {entry.actorName ?? "System"}
                        {entry.previousState && entry.newState
                          ? ` — ${entry.previousState} → ${entry.newState}`
                          : entry.newState
                            ? ` — ${entry.newState}`
                            : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
