"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileFormState, type ProfileFormValues } from "@/app/actions/profile";
import { FormVendorScripts } from "../_components/form-vendor-scripts";
import { ChangePasswordButton } from "./change-password-modal";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <div className="text-danger small mt-1">{messages[0]}</div>;
}

export function ProfileForm({
  email,
  role,
  hasPassword,
  companyName,
  departmentName,
  initialValues,
}: {
  email: string;
  role: string;
  hasPassword: boolean;
  /** Admin-managed only (Master User) — read-only here, not form fields. */
  companyName: string | null;
  departmentName: string | null;
  initialValues: ProfileFormValues;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(updateProfile, undefined);

  const values = state?.values ?? initialValues;

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
              <div className="form-text">Used as the default phone number when you open a new ticket.</div>
              <FieldError messages={state?.errors?.telephone} />
            </div>

            <div className="col-md-6">
              <label className="form-label">Company</label>&nbsp;{companyName ?? "—"}
            </div>
            <div className="col-md-6">
              <label className="form-label">Department</label>&nbsp;{departmentName ?? "—"}
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
