"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createCompany, updateCompany, deleteDepartment, type CompanyFormState } from "@/app/actions/companies";
import { AddDepartmentButton } from "./add-department-button";
import { EditDepartmentButton } from "./edit-department-supervisor-button";
import { DeleteButton } from "../../_components/delete-button";

type Option = { value: string; label: string };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <div className="text-danger small mt-1">{messages[0]}</div>;
}

export function CompanyForm({
  mode,
  companyId,
  initialValues,
  departments,
  supervisors,
}: {
  mode: "create" | "edit" | "view";
  companyId?: string;
  initialValues?: { name: string; code?: string | null; isActive: boolean };
  departments?: {
    id: string;
    name: string;
    code?: string | null;
    approverIds?: string[];
    approverNames: string[];
  }[];
  supervisors?: Option[];
}) {
  const isView = mode === "view";
  const action = mode === "create" ? createCompany : updateCompany.bind(null, companyId as string);
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(action, undefined);

  // On a failed submit the server echoes back what was submitted in
  // `state.values` — fall back to that (then initialValues, then blank) so
  // the form doesn't lose what the user typed, and re-key the form so the
  // (uncontrolled) fields' defaultValue actually re-applies on remount.
  const values = state?.values;
  const nameValue = values?.name ?? initialValues?.name;
  const codeValue = values?.code ?? initialValues?.code ?? "";
  const isActiveValue = values?.isActive ?? initialValues?.isActive ?? true;
  const formKey = state ? JSON.stringify(state) : "initial";

  return (
    <form key={formKey} action={formAction}>
      <div className="card card-primary card-outline mb-4">
        <div className="card-header">
          <div className="card-title">
            {mode === "create" ? "New Company" : isView ? "View Company" : "Edit Company"}
          </div>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-5">
              <label htmlFor="name" className="form-label">
                Company name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-control"
                defaultValue={nameValue}
                required
                disabled={isView}
              />
              <FieldError messages={state?.errors?.name} />
            </div>
            <div className="col-md-3">
              <label htmlFor="code" className="form-label">
                Company code
              </label>
              <input
                type="text"
                id="code"
                name="code"
                className="form-control"
                defaultValue={codeValue}
                disabled={isView}
              />
              <FieldError messages={state?.errors?.code} />
            </div>
            <div className="col-md-4">
              <label className="form-label d-block">Status</label>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="isActive"
                  name="isActive"
                  value="true"
                  defaultChecked={isActiveValue}
                  disabled={isView}
                />
                <label className="form-check-label" htmlFor="isActive">
                  Active
                </label>
              </div>
            </div>
          </div>

          {(mode === "edit" || isView) && companyId && (
            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label mb-0 fw-bold">Departments</label>
                {!isView && <AddDepartmentButton companyId={companyId} supervisors={supervisors ?? []} />}
              </div>
              <div className="table-responsive border rounded">
                <table className="table table-hover align-middle m-0">
                  <thead>
                    <tr>
                      <th>Department name</th>
                      <th>Code</th>
                      <th>Approver</th>
                      {!isView && <th className="text-end">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(departments ?? []).map((department) => (
                      <tr key={department.id}>
                        <td>{department.name}</td>
                        <td>{department.code ?? <span className="text-secondary">—</span>}</td>
                        <td>
                          {department.approverNames.length > 0
                            ? department.approverNames.join(", ")
                            : <span className="text-secondary">—</span>}
                        </td>
                        {!isView && (
                          <td className="text-end">
                            <div className="btn-group btn-group-sm">
                              <EditDepartmentButton
                                departmentId={department.id}
                                departmentName={department.name}
                                currentCode={department.code ?? null}
                                currentApproverIds={department.approverIds ?? []}
                                supervisors={supervisors ?? []}
                              />
                              <DeleteButton
                                action={deleteDepartment.bind(null, department.id)}
                                confirmMessage={`Delete department "${department.name}"? This cannot be undone.`}
                                label={`Delete ${department.name}`}
                              />
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {(departments ?? []).length === 0 && (
                      <tr>
                        <td colSpan={isView ? 3 : 4} className="text-center text-secondary py-4">
                          No departments yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="card-footer d-flex gap-2 justify-content-end">
          {isView ? (
            <Link href="/master/company" className="btn btn-secondary">
              <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>
              Back
            </Link>
          ) : (
            <>
              <button className="btn btn-primary" type="submit" disabled={pending}>
                <i className={`bi ${mode === "create" ? "bi-plus-lg" : "bi-check2"} me-1`} aria-hidden="true"></i>
                {pending ? "Saving…" : mode === "create" ? "Create company" : "Save changes"}
              </button>
              <Link href="/master/company" className="btn btn-secondary">
                <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>
                Back
              </Link>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
