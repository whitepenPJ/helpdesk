"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { createUserGroup, updateUserGroup, type UserGroupFormState } from "@/app/actions/user-groups";
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

export function UserGroupForm({
  mode,
  groupId,
  initialValues,
  members,
  availableUsers,
}: {
  mode: "create" | "edit" | "view";
  groupId?: string;
  initialValues?: { name: string; isActive: boolean };
  members?: { id: string; name: string; email: string }[];
  availableUsers?: Option[];
}) {
  const isView = mode === "view";
  const action = mode === "create" ? createUserGroup : updateUserGroup.bind(null, groupId as string);
  const [state, formAction, pending] = useActionState<UserGroupFormState, FormData>(action, undefined);

  // On a failed submit the server echoes back what was submitted in
  // `state.values` — fall back to that (then initialValues, then blank) so
  // the form doesn't lose what the user typed, and re-key the form so the
  // (uncontrolled) fields' defaultValue actually re-applies on remount.
  const values = state?.values;
  const nameValue = values?.name ?? initialValues?.name;
  const isActiveValue = values?.isActive ?? initialValues?.isActive ?? true;
  const formKey = state ? JSON.stringify(state) : "initial";

  // Edit starts from the group's real current members; create starts empty
  // (or from the server-echoed staged list after a failed submit) — either
  // way, additions/removals only actually persist when the form submits.
  const initialMembers: StagedMember[] =
    values?.members ?? (members ?? []).map((m) => ({ id: m.id, label: `${m.name} (${m.email})` }));

  return (
    <form key={formKey} action={formAction}>
      {!isView && <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" strategy="afterInteractive" />}
      <div className="card card-primary card-outline mb-4">
        <div className="card-header">
          <div className="card-title">
            {mode === "create" ? "New User Group" : isView ? "View User Group" : "Edit User Group"}
          </div>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="name" className="form-label">
                Group name
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
            <StagedMembersField key={formKey} availableUsers={availableUsers ?? []} initialMembers={initialMembers} />
          )}

          {isView && groupId && (
            <div className="mt-4">
              <label className="form-label d-block">Users</label>
              <div className="table-responsive border rounded">
                <table className="table table-hover align-middle m-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(members ?? []).map((member) => (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>{member.email}</td>
                      </tr>
                    ))}
                    {(members ?? []).length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-center text-secondary py-4">
                          No members yet.
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
            <Link href="/master/user-group" className="btn btn-secondary">
              <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>
              Back
            </Link>
          ) : (
            <>
              <button className="btn btn-primary" type="submit" disabled={pending}>
                <i className={`bi ${mode === "create" ? "bi-plus-lg" : "bi-check2"} me-1`} aria-hidden="true"></i>
                {pending ? "Saving…" : mode === "create" ? "Create group" : "Save changes"}
              </button>
              <Link href="/master/user-group" className="btn btn-secondary">
                <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                Cancel
              </Link>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

// Stages members in local state and carries them as one JSON hidden field
// inside the same <form> the parent fields submit through — used for both
// create (no groupId exists yet) and edit (persists to the real group only
// when Save changes is submitted) — see createUserGroup/updateUserGroup in
// app/actions/user-groups.ts. Its own component so remounting it via the
// parent's `key={formKey}` after a failed submit re-seeds this state from
// the server-echoed `values`, the same way the name/isActive fields do.
// Lives inside the same card as the Group name/Status fields, separated by
// a divider rather than its own card.
function StagedMembersField({
  availableUsers,
  initialMembers,
}: {
  availableUsers: Option[];
  initialMembers: StagedMember[];
}) {
  const [staged, setStaged] = useState<StagedMember[]>(initialMembers);
  const remainingUsers = availableUsers.filter((u) => !staged.some((m) => m.id === u.value));

  async function handleRemove(member: StagedMember) {
    const swal = window.Swal;
    if (swal) {
      const { isConfirmed } = await swal.fire({
        title: "Remove user?",
        text: `Remove "${member.label}" from this group?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc3545",
      });
      if (!isConfirmed) return;
    }
    setStaged((prev) => prev.filter((m) => m.id !== member.id));
  }

  return (
    <div className="mt-4">
      <input type="hidden" name="members" value={JSON.stringify(staged)} />
      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label mb-0 fw-bold">Users</label>
        <StagedPickerButton
          options={remainingUsers}
          onAdd={(value, label) => setStaged((prev) => [...prev, { id: value, label }])}
          buttonLabel="Add user"
          modalTitle="Add User to Group"
          fieldLabel="User"
          emptyMessage="All users are already in this group."
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
            {staged.map((member) => (
              <tr key={member.id}>
                <td>{member.label}</td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    aria-label={`Remove ${member.label}`}
                    onClick={() => handleRemove(member)}
                  >
                    <i className="bi bi-x-lg" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
            ))}
            {staged.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center text-secondary py-4">
                  No members added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
