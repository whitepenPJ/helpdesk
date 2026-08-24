"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateDepartmentSupervisor, type UpdateDepartmentSupervisorState } from "@/app/actions/companies";
import { Select2Select } from "../../_components/select2-select";
import { FormVendorScripts } from "../../_components/form-vendor-scripts";
import { useMounted } from "../../_components/use-mounted";

type Option = { value: string; label: string };

export function EditDepartmentSupervisorButton({
  departmentId,
  departmentName,
  currentSupervisorId,
  supervisors,
}: {
  departmentId: string;
  departmentName: string;
  currentSupervisorId: string | null;
  supervisors: Option[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        title="Edit supervisor"
        aria-label={`Edit supervisor for ${departmentName}`}
        onClick={() => setOpen(true)}
      >
        <i className="bi bi-pencil" aria-hidden="true"></i>
      </button>
      {open && (
        <EditDepartmentSupervisorModal
          departmentId={departmentId}
          departmentName={departmentName}
          currentSupervisorId={currentSupervisorId}
          supervisors={supervisors}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function EditDepartmentSupervisorModal({
  departmentId,
  departmentName,
  currentSupervisorId,
  supervisors,
  onClose,
}: {
  departmentId: string;
  departmentName: string;
  currentSupervisorId: string | null;
  supervisors: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const action = updateDepartmentSupervisor.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<UpdateDepartmentSupervisorState, FormData>(action, undefined);
  // Portaled to <body> rather than rendered in place — this button lives
  // inside the Edit Company page's own <form>, and a nested <form> in the
  // DOM makes React unable to tell which form owns a submit ("A React form
  // was unexpectedly submitted").
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
      <FormVendorScripts />
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <form action={formAction}>
              <div className="modal-header">
                <h5 className="modal-title">Supervisor — {departmentName}</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
              <div className="modal-body">
                <label htmlFor="supervisorId" className="form-label">
                  Supervisor
                </label>
                <Select2Select
                  name="supervisorId"
                  defaultValue={currentSupervisorId ?? undefined}
                  placeholder="No supervisor"
                  options={supervisors}
                />
                {state?.error && <div className="text-danger small mt-2">{state.error}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
                  <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  <i className="bi bi-check2 me-1" aria-hidden="true"></i>
                  {pending ? "Saving…" : "Save"}
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
