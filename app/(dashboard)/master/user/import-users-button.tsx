"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { importUsers, type ImportUsersResult } from "@/app/actions/users";
import { useMounted } from "../../_components/use-mounted";

export function ImportUsersButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(true)}>
        <i className="bi bi-upload me-1" aria-hidden="true"></i>
        Import
      </button>
      {open && <ImportUsersModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportUsersModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ImportUsersResult, FormData>(importUsers, undefined);
  const mounted = useMounted();

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  useEffect(() => {
    if (state && !("error" in state)) {
      router.refresh();
    }
  }, [state, router]);

  if (!mounted) return null;

  const result = state && !("error" in state) ? state : null;

  return createPortal(
    <>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <form action={formAction}>
              <div className="modal-header">
                <h5 className="modal-title">Import Users</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
              <div className="modal-body text-start">
                <p className="text-secondary">
                  Upload an .xlsx file with a header row: <strong>Name, Email, Role, Status, Company, Department,
                  Telephone</strong>. Only Name and Email are required — Role defaults to USER, Status to ACTIVE.
                  Company/Department must match an existing name exactly. A row matching an existing email updates
                  that user (their password is untouched); a new email creates a new account with a generated
                  password shown below once.
                </p>
                <input type="file" name="file" accept=".xlsx" className="form-control" required />
                {state && "error" in state && <div className="text-danger small mt-2">{state.error}</div>}

                {result && (
                  <div className="mt-3">
                    <div className="alert alert-success mb-2">
                      {result.created.length} created, {result.updated.length} updated
                      {result.errors.length > 0 ? `, ${result.errors.length} skipped` : ""}.
                    </div>
                    {result.created.length > 0 && (
                      <div className="mb-2">
                        <div className="fw-bold fs-7">New accounts — save these passwords now, they won&apos;t be shown again:</div>
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Email</th>
                                <th>Password</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.created.map((u) => (
                                <tr key={u.email}>
                                  <td>{u.email}</td>
                                  <td>
                                    <code>{u.password}</code>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {result.errors.length > 0 && (
                      <div>
                        <div className="fw-bold fs-7">Skipped rows:</div>
                        <ul className="mb-0 fs-7 text-danger">
                          {result.errors.map((e, i) => (
                            <li key={i}>
                              Row {e.row}: {e.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
                  <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                  Close
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  <i className="bi bi-upload me-1" aria-hidden="true"></i>
                  {pending ? "Importing…" : "Import"}
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
