"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createUser, updateUser, type UserFormState } from "@/app/actions/users";
import { Select2Select } from "../../_components/select2-select";
import { FormVendorScripts } from "../../_components/form-vendor-scripts";

type Option = { value: string; label: string };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <div className="text-danger small mt-1">{messages[0]}</div>;
}

export function UserForm({
  mode,
  userId,
  initialValues,
  companies,
  departments,
}: {
  mode: "create" | "edit" | "view";
  userId?: string;
  initialValues?: {
    name: string;
    email: string;
    role: string;
    status: string;
    companyId: string;
    departmentId: string;
  };
  companies: Option[];
  departments: (Option & { companyId: string })[];
}) {
  const isView = mode === "view";
  const action = mode === "create" ? createUser : updateUser.bind(null, userId as string);
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(action, undefined);

  // On a failed submit the server echoes back what was submitted in
  // `state.values` — fall back to that (then to `initialValues` for edit
  // mode, then blank) so the form doesn't lose what the user typed.
  const values = state?.values;
  const nameValue = values?.name ?? initialValues?.name;
  const emailValue = values?.email ?? initialValues?.email;
  const roleValue = values?.role ?? initialValues?.role;
  const statusValue = values?.status ?? initialValues?.status ?? "ACTIVE";

  // Department belongs to a company, so it can't be chosen until a company
  // is — the dropdown re-mounts (via `key`) whenever the company changes so
  // Select2 reinitializes with just that company's departments.
  const [companyId, setCompanyId] = useState(values?.companyId ?? initialValues?.companyId ?? "");
  const departmentOptions = departments
    .filter((d) => d.companyId === companyId)
    .map((d) => ({ value: d.value, label: d.label }));
  const departmentValue =
    companyId === (values?.companyId ?? initialValues?.companyId ?? "")
      ? (values?.departmentId ?? initialValues?.departmentId)
      : undefined;

  // Every field below is uncontrolled (defaultValue only applies at mount),
  // but React's built-in form-action handling resets the form's DOM after
  // the action runs — so re-mounting with a key tied to the latest state is
  // what actually makes the "keep what I typed" fallbacks above take effect.
  const formKey = state ? JSON.stringify(state) : "initial";

  return (
    <div className="card card-primary card-outline mb-4">
      <FormVendorScripts />
      <div className="card-header">
        <div className="card-title">{mode === "create" ? "New User" : isView ? "View User" : "Edit User"}</div>
      </div>
      <form key={formKey} action={formAction}>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="name" className="form-label">
                Name
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
            <div className="col-md-6">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-control"
                defaultValue={emailValue}
                required
                disabled={isView}
              />
              <FieldError messages={state?.errors?.email} />
            </div>

            {mode === "create" && (
              <>
                <div className="col-md-6">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <input type="password" id="password" name="password" className="form-control" required />
                  <FieldError messages={state?.errors?.password} />
                </div>
                <div className="col-md-6">
                  <label htmlFor="confirmPassword" className="form-label">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className="form-control"
                    required
                  />
                  <FieldError messages={state?.errors?.confirmPassword} />
                </div>
              </>
            )}

            <div className="col-md-6">
              <label htmlFor="role" className="form-label">
                Role
              </label>
              <Select2Select
                name="role"
                defaultValue={roleValue}
                required
                disabled={isView}
                placeholder="Select a role"
                options={[
                  { value: "ADMIN", label: "Admin" },
                  { value: "SUPERVISOR", label: "Supervisor" },
                  { value: "USER", label: "User" },
                ]}
              />
              <FieldError messages={state?.errors?.role} />
            </div>
            <div className="col-md-6">
              <label className="form-label d-block">Status</label>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="status"
                  name="status"
                  value="ACTIVE"
                  defaultChecked={statusValue === "ACTIVE"}
                  disabled={isView}
                />
                <label className="form-check-label" htmlFor="status">
                  Active
                </label>
              </div>
            </div>

            <div className="col-md-6">
              <label htmlFor="companyId" className="form-label">
                Company
              </label>
              <Select2Select
                name="companyId"
                defaultValue={companyId}
                placeholder="No company"
                options={companies}
                onChange={setCompanyId}
                disabled={isView}
              />
            </div>
            <div className="col-md-6">
              <label htmlFor="departmentId" className="form-label">
                Department
              </label>
              <Select2Select
                key={companyId || "no-company"}
                name="departmentId"
                defaultValue={departmentValue}
                placeholder={companyId ? "No department" : "Select a company first"}
                options={departmentOptions}
                disabled={isView || !companyId}
              />
              <FieldError messages={state?.errors?.departmentId} />
            </div>
          </div>
        </div>
        <div className="card-footer d-flex gap-2">
          {isView ? (
            <Link href="/master/user" className="btn btn-secondary">
              Back
            </Link>
          ) : (
            <>
              <button className="btn btn-primary" type="submit" disabled={pending}>
                {pending ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
              </button>
              <Link href="/master/user" className="btn btn-secondary">
                Cancel
              </Link>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
