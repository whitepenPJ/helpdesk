"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createTicket, type TicketFormState } from "@/app/actions/tickets";
import { Select2Select } from "../_components/select2-select";
import { FormVendorScripts } from "../_components/form-vendor-scripts";
import { STATUS_BADGE } from "./ticket-badges";

type Option = { value: string; label: string };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <div className="text-danger small mt-1">{messages[0]}</div>;
}

export function TicketForm({
  categories,
  companies,
  departments,
  users,
  defaultCompanyId,
  defaultDepartmentId,
  defaultCreatorId,
  canChangeCreator,
  defaultTitle,
  defaultDescription,
}: {
  categories: Option[];
  companies: Option[];
  departments: (Option & { companyId: string })[];
  users: Option[];
  defaultCompanyId?: string;
  defaultDepartmentId?: string;
  defaultCreatorId: string;
  canChangeCreator: boolean;
  /** Pre-fill from e.g. the AI chat handoff — no existing caller passes these. */
  defaultTitle?: string;
  defaultDescription?: string;
}) {
  const [state, formAction, pending] = useActionState<TicketFormState, FormData>(createTicket, undefined);

  // On a failed submit the server echoes back what was submitted in
  // `state.values` — fall back to that (then the profile-derived default,
  // then blank) so the form doesn't lose what the user entered.
  const values = state?.values;
  const titleValue = values?.title ?? defaultTitle;
  const descriptionValue = values?.description ?? defaultDescription;
  const categoryIdValue = values?.categoryId;
  const telephoneValue = values?.telephone;
  // Only an admin's own submission is ever honored server-side (see
  // createTicket) — for everyone else this stays locked to their own id.
  const creatorIdValue = canChangeCreator ? (values?.creatorId ?? defaultCreatorId) : defaultCreatorId;

  // Department belongs to a company, so it can't be chosen until a company
  // is — same cascading pattern as the Master User form.
  const [companyId, setCompanyId] = useState(values?.companyId ?? defaultCompanyId ?? "");
  const departmentOptions = departments
    .filter((d) => d.companyId === companyId)
    .map((d) => ({ value: d.value, label: d.label }));
  const departmentValue =
    companyId === (values?.companyId ?? defaultCompanyId ?? "")
      ? (values?.departmentId ?? defaultDepartmentId)
      : undefined;

  // Every field below is uncontrolled (defaultValue only applies at mount),
  // but React's built-in form-action handling resets the form's DOM after
  // the action runs — so re-mounting with a key tied to the latest state is
  // what actually makes the "keep what I entered" fallbacks above apply.
  const formKey = state ? JSON.stringify(state) : "initial";

  return (
    <div className="card card-primary card-outline mb-4">
      <FormVendorScripts />
      <div className="card-header">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="card-title mb-0 text-secondary">Ticket #: Auto</div>
          <div className="d-flex flex-wrap align-items-center gap-3 fs-7 text-secondary">
            <span>
              <i className="bi bi-calendar-event me-1" aria-hidden="true"></i>
              Created: Auto
            </span>
            <span className="d-flex align-items-center gap-1">
              Status: <span className={`badge ${STATUS_BADGE.NEW}`}>NEW</span>
            </span>
          </div>
        </div>
      </div>
      <form key={formKey} action={formAction}>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12">
              <label htmlFor="title" className="form-label">
                Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                className="form-control"
                defaultValue={titleValue}
                required
              />
              <FieldError messages={state?.errors?.title} />
            </div>
            <div className="col-12">
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                className="form-control"
                rows={4}
                defaultValue={descriptionValue}
                required
              />
              <FieldError messages={state?.errors?.description} />
            </div>

            <div className="col-md-6">
              <label htmlFor="creatorId" className="form-label">
                Creator
              </label>
              <Select2Select
                name="creatorId"
                defaultValue={creatorIdValue}
                required
                disabled={!canChangeCreator}
                placeholder="Select a creator"
                options={users}
              />
              <FieldError messages={state?.errors?.creatorId} />
            </div>
            <div className="col-md-6">
              <label htmlFor="categoryId" className="form-label">
                Category
              </label>
              <Select2Select
                name="categoryId"
                defaultValue={categoryIdValue}
                required
                placeholder="Select a category"
                options={categories}
              />
              <FieldError messages={state?.errors?.categoryId} />
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
                defaultValue={telephoneValue}
                required
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
                required
                placeholder="Select a company"
                options={companies}
                onChange={setCompanyId}
              />
              <FieldError messages={state?.errors?.companyId} />
            </div>
            <div className="col-md-6">
              <label htmlFor="departmentId" className="form-label">
                Department
              </label>
              <Select2Select
                key={companyId || "no-company"}
                name="departmentId"
                defaultValue={departmentValue}
                required
                placeholder={companyId ? "Select a department" : "Select a company first"}
                options={departmentOptions}
                disabled={!companyId}
              />
              <FieldError messages={state?.errors?.departmentId} />
            </div>

            <div className="col-12">
              <label htmlFor="attachments" className="form-label">
                Attach File
              </label>
              <input type="file" id="attachments" name="attachments" className="form-control" multiple />
            </div>
          </div>
        </div>
        <div className="card-footer d-flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit ticket"}
          </button>
          <Link href="/tickets" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
