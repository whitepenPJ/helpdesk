"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { editTicket, type TicketFormState } from "@/app/actions/tickets";
import { Select2Select } from "../../_components/select2-select";
import { FormVendorScripts } from "../../_components/form-vendor-scripts";
import { STATUS_BADGE } from "../ticket-badges";
import { toDateTimeLocalValue } from "@/app/lib/date-format";

type Option = { value: string; label: string };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <div className="text-danger small mt-1">{messages[0]}</div>;
}

export function EditTicketForm({
  ticketId,
  ticketNumber,
  categories,
  companies,
  departments,
  initialValues,
}: {
  ticketId: string;
  ticketNumber: string;
  categories: Option[];
  companies: Option[];
  departments: (Option & { companyId: string })[];
  initialValues: {
    title: string;
    description: string;
    categoryId: string;
    telephone: string;
    companyId: string;
    departmentId: string;
    transactionDate: Date;
  };
}) {
  const editTicketWithId = editTicket.bind(null, ticketId);
  const [state, formAction, pending] = useActionState<TicketFormState, FormData>(editTicketWithId, undefined);

  const values = state?.values ?? initialValues;
  const transactionDateValue =
    typeof values.transactionDate === "string" ? values.transactionDate : toDateTimeLocalValue(values.transactionDate);

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
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="card-title mb-0">Ticket #: {ticketNumber}</div>
          <span className="d-flex align-items-center gap-1 fs-7 text-secondary">
            Status: <span className={`badge ${STATUS_BADGE.NEW}`}>NEW</span>
          </span>
        </div>
      </div>
      <form key={formKey} action={formAction}>
        <div className="card-body">
          {state?.errors?.form && (
            <div className="alert alert-danger" role="alert">
              {state.errors.form[0]}
            </div>
          )}
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
                defaultValue={values.title}
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
                defaultValue={values.description}
                required
              />
              <FieldError messages={state?.errors?.description} />
            </div>

            <div className="col-md-6">
              <label htmlFor="categoryId" className="form-label">
                Category
              </label>
              <Select2Select
                name="categoryId"
                defaultValue={values.categoryId}
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
                defaultValue={values.telephone}
                required
              />
              <FieldError messages={state?.errors?.telephone} />
            </div>
            <div className="col-md-6">
              <label htmlFor="transactionDate" className="form-label">
                Transaction Date
              </label>
              <input
                type="datetime-local"
                id="transactionDate"
                name="transactionDate"
                className="form-control"
                defaultValue={transactionDateValue}
                required
              />
              <FieldError messages={state?.errors?.transactionDate} />
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
                onChange={(value) => setCompanyId(value as string)}
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
          </div>
        </div>
        <div className="card-footer d-flex gap-2 justify-content-end">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            <i className="bi bi-check2 me-1" aria-hidden="true"></i>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <Link href={`/tickets/${ticketId}`} className="btn btn-secondary">
            <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
