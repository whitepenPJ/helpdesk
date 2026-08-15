"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDepartment, type DepartmentFormState } from "@/app/actions/companies";
import { Select2Select } from "../../_components/select2-select";
import { FormVendorScripts } from "../../_components/form-vendor-scripts";

type Option = { value: string; label: string };

export function AddDepartmentButton({ companyId, supervisors }: { companyId: string; supervisors: Option[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>
        <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
        New department
      </button>
      {open && (
        <AddDepartmentModal companyId={companyId} supervisors={supervisors} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function AddDepartmentModal({
  companyId,
  supervisors,
  onClose,
}: {
  companyId: string;
  supervisors: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const action = createDepartment.bind(null, companyId);
  const [state, formAction, pending] = useActionState<DepartmentFormState, FormData>(action, undefined);

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
      <FormVendorScripts />
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <form action={formAction}>
              <div className="modal-header">
                <h5 className="modal-title">New Department</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">
                    Department name
                  </label>
                  <input type="text" id="name" name="name" className="form-control" required />
                  {state?.errors?.name && <div className="text-danger small mt-1">{state.errors.name[0]}</div>}
                </div>
                <div>
                  <label htmlFor="supervisorId" className="form-label">
                    Supervisor
                  </label>
                  <Select2Select
                    name="supervisorId"
                    placeholder="No supervisor"
                    options={supervisors}
                  />
                  {state?.errors?.supervisorId && (
                    <div className="text-danger small mt-1">{state.errors.supervisorId[0]}</div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? "Adding…" : "Add department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
