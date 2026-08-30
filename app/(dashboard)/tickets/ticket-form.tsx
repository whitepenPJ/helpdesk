"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createTicket, type TicketFormState } from "@/app/actions/tickets";
import { Select2Select } from "../_components/select2-select";
import { FormVendorScripts } from "../_components/form-vendor-scripts";
import { BootstrapFileInput } from "../_components/bootstrap-file-input";
import { useMounted } from "../_components/use-mounted";
import { STATUS_BADGE } from "./ticket-badges";
import { toDateTimeLocalValue } from "@/app/lib/date-format";

type Option = { value: string; label: string };

type CreatorOption = Option & {
  companyName: string | null;
  departmentName: string | null;
  telephone: string | null;
  approvers: { name: string; email: string }[];
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <div className="text-danger small mt-1">{messages[0]}</div>;
}

export function TicketForm({
  categories,
  users,
  defaultCreatorId,
  canChangeCreator,
  defaultTitle,
  defaultDescription,
}: {
  categories: Option[];
  /** Company/Department/Telephone all follow whichever of these is
   * selected as Creator — see the "ห้ามเปลี่ยน" (Company/Department
   * can't be changed, shown as a label) requirement. */
  users: CreatorOption[];
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
  // Only an admin's, or a user with "Open Ticket for Other User", own
  // submission is ever honored server-side (see createTicket) — for
  // everyone else this stays locked to their own id.
  const [creatorId, setCreatorId] = useState(
    canChangeCreator ? (values?.creatorId ?? defaultCreatorId) : defaultCreatorId
  );
  const creator = users.find((u) => u.value === creatorId);
  const telephoneValue = values?.telephone ?? creator?.telephone ?? "";
  const approvers = creator?.approvers ?? [];
  const hasApprover = approvers.length > 0;

  // Real Date only once mounted, so server-rendered HTML and the client's
  // first render match exactly (the real creation timestamp is stamped
  // server-side on submit anyway — this is just "right now" for the person
  // filling the form).
  const mounted = useMounted();
  const now = mounted ? new Date() : null;

  const [needApproval, setNeedApproval] = useState(false);

  // Every field below is uncontrolled (defaultValue only applies at mount),
  // but React's built-in form-action handling resets the form's DOM after
  // the action runs — so re-mounting with a key tied to the latest state is
  // what actually makes the "keep what I entered" fallbacks above apply.
  const formKey = state ? JSON.stringify(state) : "initial";

  return (
    <div className="card card-primary card-outline mb-4">
      <FormVendorScripts fileInput />
      <div className="card-header">
        <div className="d-flex flex-wrap justify-content-end align-items-center gap-2">
          <span className="d-flex align-items-center gap-1 fs-7 text-secondary">
            Status:{" "}
            {needApproval && hasApprover ? (
              <span className={`badge ${STATUS_BADGE.WAITING}`}>WAITING</span>
            ) : (
              <span className={`badge ${STATUS_BADGE.NEW}`}>NEW</span>
            )}
          </span>
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
                maxLength={255}
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
                rows={5}
                defaultValue={descriptionValue}
                required
              />
              <FieldError messages={state?.errors?.description} />
            </div>

            <div className="col-md-6">
              <label htmlFor="creatorId" className="form-label">
                Requestor
              </label>
              {canChangeCreator ? (
                <Select2Select
                  name="creatorId"
                  defaultValue={creatorId}
                  required
                  placeholder="Select a creator"
                  options={users}
                  onChange={(value) => setCreatorId((value as string) ?? "")}
                />
              ) : (
                <>
                  <input type="text" id="creatorId" className="form-control" value={creator?.label ?? ""} disabled readOnly />
                  <input type="hidden" name="creatorId" value={defaultCreatorId} />
                </>
              )}
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
              <label className="form-label">Company</label>
              <input type="text" className="form-control" value={creator?.companyName ?? "—"} disabled readOnly />
            </div>
            <div className="col-md-6">
              <label className="form-label">Department</label>
              <input type="text" className="form-control" value={creator?.departmentName ?? "—"} disabled readOnly />
            </div>

            <div className="col-md-6">
              <label htmlFor="telephone" className="form-label">
                Telephone
              </label>
              <input
                key={creatorId}
                type="tel"
                id="telephone"
                name="telephone"
                className="form-control"
                defaultValue={telephoneValue}
                required
                maxLength={20}
              />
              <FieldError messages={state?.errors?.telephone} />
            </div>
            <div className="col-md-6">
              <label htmlFor="transactionDate" className="form-label">
                Transaction Date
              </label>
              {now ? (
                <input
                  type="datetime-local"
                  id="transactionDate"
                  name="transactionDate"
                  className="form-control"
                  defaultValue={values?.transactionDate || toDateTimeLocalValue(now)}
                  required
                />
              ) : (
                <input type="text" className="form-control" value="Loading…" disabled readOnly aria-hidden="true" />
              )}
              <FieldError messages={state?.errors?.transactionDate} />
            </div>

            <div className="col-12">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="needApproval"
                  name="needApproval"
                  value="true"
                  checked={needApproval}
                  onChange={(e) => setNeedApproval(e.target.checked)}
                  disabled={!hasApprover}
                />
                <label className="form-check-label" htmlFor="needApproval">
                  Need approval
                </label>
                <div className="form-text">
                  {hasApprover ? (
                    <>
                      Sends this ticket straight to the department&apos;s approver before anyone else acts on it.
                      <div>Approver{approvers.length > 1 ? "s" : ""}: {approvers.map((a) => `${a.name} (${a.email})`).join(", ")}</div>
                    </>
                  ) : (
                    "The creator's department has no approver assigned, so this isn't available."
                  )}
                </div>
              </div>
            </div>

            <div className="col-12">
              <label htmlFor="attachments" className="form-label">
                Attach File
              </label>
              <BootstrapFileInput name="attachments" />
            </div>
          </div>
        </div>
        <div className="card-footer d-flex gap-2 justify-content-end">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            <i className={`bi ${pending ? "bi-hourglass-split" : "bi-send"} me-1`} aria-hidden="true"></i>
            {pending ? "Submitting…" : "Submit ticket"}
          </button>
          <Link href="/tickets" className="btn btn-secondary">
            <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>
            Back
          </Link>
        </div>
      </form>
    </div>
  );
}
