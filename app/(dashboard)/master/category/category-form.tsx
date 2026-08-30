"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { createCategory, updateCategory, type CategoryFormState } from "@/app/actions/categories";
import { StagedPickerButton } from "../../_components/staged-picker-button";

type Option = { value: string; label: string };
type StagedMember = { id: string; label: string };

// Loose shim — just the bits of SweetAlert2's API this component calls. Same
// CDN-loaded pattern as DeleteButton/RemoveButton/AssignModal elsewhere in
// the app; next/script dedupes by src so this doesn't double-load it.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <div className="text-danger small mt-1">{messages[0]}</div>;
}

export function CategoryForm({
  mode,
  categoryId,
  initialValues,
  responsibleUsers,
  availableUsers,
  responsibleGroups,
  availableGroups,
}: {
  mode: "create" | "edit" | "view";
  categoryId?: string;
  initialValues?: { name: string; isActive: boolean };
  responsibleUsers?: { id: string; name: string; email: string }[];
  availableUsers?: Option[];
  responsibleGroups?: { id: string; name: string }[];
  availableGroups?: Option[];
}) {
  const isView = mode === "view";
  const action = mode === "create" ? createCategory : updateCategory.bind(null, categoryId as string);
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(action, undefined);

  // On a failed submit the server echoes back what was submitted in
  // `state.values` — fall back to that (then initialValues, then blank) so
  // the form doesn't lose what the user typed, and re-key the form so the
  // (uncontrolled) fields' defaultValue actually re-applies on remount.
  const values = state?.values;
  const nameValue = values?.name ?? initialValues?.name;
  const isActiveValue = values?.isActive ?? initialValues?.isActive ?? true;
  const formKey = state ? JSON.stringify(state) : "initial";

  // Edit starts from the category's real current responsibles; create
  // starts empty (or from the server-echoed staged list after a failed
  // submit) — either way, additions/removals only persist on submit.
  const initialResponsibleUsers: StagedMember[] =
    values?.responsibleUsers ?? (responsibleUsers ?? []).map((u) => ({ id: u.id, label: `${u.name} (${u.email})` }));
  const initialResponsibleGroups: StagedMember[] =
    values?.responsibleGroups ?? (responsibleGroups ?? []).map((g) => ({ id: g.id, label: g.name }));

  return (
    <form key={formKey} action={formAction}>
      {!isView && <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" strategy="afterInteractive" />}
      <div className="card card-primary card-outline mb-4">
        <div className="card-header">
          <div className="card-title">
            {mode === "create" ? "New Category" : isView ? "View Category" : "Edit Category"}
          </div>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="name" className="form-label">
                Category name
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

          {!isView && (
            <>
              <StagedListField
                key={`users-${formKey}`}
                name="responsibleUsers"
                label="Responsible Users"
                options={availableUsers ?? []}
                initialItems={initialResponsibleUsers}
                buttonLabel="Add user"
                modalTitle="Add Responsible User"
                fieldLabel="User"
                emptyMessage="All users are already responsible for this category."
                emptyTableMessage="No responsible users added yet."
                confirmTitle="Remove user?"
                confirmText={(label) => `Remove "${label}" as responsible for this category?`}
              />
              <StagedListField
                key={`groups-${formKey}`}
                name="responsibleGroups"
                label="Responsible User Groups"
                options={availableGroups ?? []}
                initialItems={initialResponsibleGroups}
                buttonLabel="Add group"
                modalTitle="Add Responsible User Group"
                fieldLabel="User group"
                emptyMessage="All user groups are already responsible for this category."
                emptyTableMessage="No responsible user groups added yet."
                confirmTitle="Remove user group?"
                confirmText={(label) => `Remove "${label}" as responsible for this category?`}
              />
            </>
          )}

          {isView && categoryId && (
            <div className="mt-4">
              <label className="form-label d-block">Responsible Users</label>
              <div className="table-responsive border rounded">
                <table className="table table-hover align-middle m-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(responsibleUsers ?? []).map((user) => (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                      </tr>
                    ))}
                    {(responsibleUsers ?? []).length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-center text-secondary py-4">
                          No responsible users yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isView && categoryId && (
            <div className="mt-4">
              <label className="form-label d-block">Responsible User Groups</label>
              <div className="table-responsive border rounded">
                <table className="table table-hover align-middle m-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(responsibleGroups ?? []).map((group) => (
                      <tr key={group.id}>
                        <td>{group.name}</td>
                      </tr>
                    ))}
                    {(responsibleGroups ?? []).length === 0 && (
                      <tr>
                        <td className="text-center text-secondary py-4">No responsible user groups yet.</td>
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
            <Link href="/master/category" className="btn btn-secondary">
              <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>
              Back
            </Link>
          ) : (
            <>
              <button className="btn btn-primary" type="submit" disabled={pending}>
                <i className={`bi ${mode === "create" ? "bi-plus-lg" : "bi-check2"} me-1`} aria-hidden="true"></i>
                {pending ? "Saving…" : mode === "create" ? "Create category" : "Save changes"}
              </button>
              <Link href="/master/category" className="btn btn-secondary">
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

// Stages responsible users/groups in local state and carries them as one
// JSON hidden field inside the same <form> the parent fields submit through
// — used for both create (no categoryId exists yet) and edit (persists to
// the real category only when Save changes is submitted) — see
// createCategory/updateCategory in app/actions/categories.ts. Its own
// component so remounting it via the parent's `key` after a failed submit
// re-seeds this state from the server-echoed `values`, the same way
// name/isActive do. Shared shape for both Responsible Users and Responsible
// User Groups. Lives inside the same card as the Category name/Status
// fields, separated by a bordered table rather than its own card.
function StagedListField({
  name,
  label,
  options,
  initialItems,
  buttonLabel,
  modalTitle,
  fieldLabel,
  emptyMessage,
  emptyTableMessage,
  confirmTitle,
  confirmText,
}: {
  name: string;
  label: string;
  options: Option[];
  initialItems: StagedMember[];
  buttonLabel: string;
  modalTitle: string;
  fieldLabel: string;
  emptyMessage: string;
  emptyTableMessage: string;
  confirmTitle: string;
  confirmText: (label: string) => string;
}) {
  const [staged, setStaged] = useState<StagedMember[]>(initialItems);
  const remaining = options.filter((o) => !staged.some((s) => s.id === o.value));

  async function handleRemove(item: StagedMember) {
    const swal = window.Swal;
    if (swal) {
      const { isConfirmed } = await swal.fire({
        title: confirmTitle,
        text: confirmText(item.label),
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc3545",
      });
      if (!isConfirmed) return;
    }
    setStaged((prev) => prev.filter((s) => s.id !== item.id));
  }

  return (
    <div className="mt-4">
      <input type="hidden" name={name} value={JSON.stringify(staged)} />
      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label mb-0 fw-bold">{label}</label>
        <StagedPickerButton
          options={remaining}
          onAdd={(value, itemLabel) => setStaged((prev) => [...prev, { id: value, label: itemLabel }])}
          buttonLabel={buttonLabel}
          modalTitle={modalTitle}
          fieldLabel={fieldLabel}
          emptyMessage={emptyMessage}
        />
      </div>
      <div className="table-responsive border rounded">
        <table className="table table-hover align-middle m-0">
          <thead>
            <tr>
              <th>Name</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staged.map((item) => (
              <tr key={item.id}>
                <td>{item.label}</td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    aria-label={`Remove ${item.label}`}
                    onClick={() => handleRemove(item)}
                  >
                    <i className="bi bi-x-lg" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
            ))}
            {staged.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center text-secondary py-4">
                  {emptyTableMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
