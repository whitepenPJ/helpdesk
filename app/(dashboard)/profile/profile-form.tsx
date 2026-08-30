"use client";

import { useActionState, useState } from "react";
import { updateProfile, type ProfileFormState, type ProfileFormValues } from "@/app/actions/profile";
import { Select2Select } from "../_components/select2-select";
import { FormVendorScripts } from "../_components/form-vendor-scripts";
import { ChangePasswordButton } from "./change-password-modal";

type Option = { value: string; label: string };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <div className="text-danger small mt-1">{messages[0]}</div>;
}

export function ProfileForm({
  email,
  role,
  hasPassword,
  companies,
  departments,
  initialValues,
}: {
  email: string;
  role: string;
  hasPassword: boolean;
  companies: Option[];
  departments: (Option & { companyId: string })[];
  initialValues: ProfileFormValues;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(updateProfile, undefined);

  const values = state?.values ?? initialValues;

  // Department belongs to a company, so it can't be chosen until a company
  // is — same cascading pattern as the ticket and admin User forms.
  const [companyId, setCompanyId] = useState(values.companyId);
  const departmentOptions = departments
    .filter((d) => d.companyId === companyId)
    .map((d) => ({ value: d.value, label: d.label }));
  const departmentValue = companyId === values.companyId ? values.departmentId : undefined;

  const formKey = state ? JSON.stringify(state) : "initial";

  return (
    <div className="card card-primary card-outline mb-4">
      <FormVendorScripts />
      <div className="card-header">
        <div className="card-title">My Profile</div>
      </div>
      <form key={formKey} action={formAction}>
        <div className="card-body">
          {state?.success && (
            <div className="alert alert-success" role="alert">
              Profile updated.
            </div>
          )}
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={email} disabled readOnly />
            </div>
            <div className="col-md-6">
              <label className="form-label">Role</label>
              <input type="text" className="form-control" value={role} disabled readOnly />
            </div>

            <div className="col-md-6">
              <label htmlFor="name" className="form-label">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-control"
                defaultValue={values.name}
                required
              />
              <FieldError messages={state?.errors?.name} />
            </div>
            <div className="col-md-6">
              <label htmlFor="telephone" className="form-label">
                Telephone
              </label>
              <input
                type="tel"
                id="telephone"
                name="telephone"
                className="form-control"
                defaultValue={values.telephone}
              />
              <FieldError messages={state?.errors?.telephone} />
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
                onChange={(value) => setCompanyId(value as string)}
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
                disabled={!companyId}
              />
              <FieldError messages={state?.errors?.departmentId} />
            </div>
          </div>
        </div>
        <div className="card-footer d-flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            <i className="bi bi-check2 me-1" aria-hidden="true"></i>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <ChangePasswordButton hasPassword={hasPassword} />
        </div>
      </form>
    </div>
  );
}
