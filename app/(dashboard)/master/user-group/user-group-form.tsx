"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createUserGroup, updateUserGroup, addUserToGroup, removeUserFromGroup, type UserGroupFormState } from "@/app/actions/user-groups";
import { AddUserButton } from "../../_components/add-user-modal";
import { RemoveButton } from "../../_components/remove-button";

type Option = { value: string; label: string };

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

  return (
    <>
      <div className="card card-primary card-outline mb-4">
        <div className="card-header">
          <div className="card-title">
            {mode === "create" ? "New User Group" : isView ? "View User Group" : "Edit User Group"}
          </div>
        </div>
        <form key={formKey} action={formAction}>
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
          </div>
          <div className="card-footer d-flex gap-2">
            {isView ? (
              <Link href="/master/user-group" className="btn btn-secondary">
                Back
              </Link>
            ) : (
              <>
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : mode === "create" ? "Create group" : "Save changes"}
                </button>
                <Link href="/master/user-group" className="btn btn-secondary">
                  Cancel
                </Link>
              </>
            )}
          </div>
        </form>
      </div>

      {(mode === "edit" || isView) && groupId && (
        <div className="card card-outline mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <div className="card-title">Users</div>
            {!isView && (
              <AddUserButton
                users={availableUsers ?? []}
                action={addUserToGroup.bind(null, groupId)}
                buttonLabel="Add user"
                modalTitle="Add User to Group"
                fieldLabel="User"
                emptyMessage="All users are already in this group."
              />
            )}
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle m-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    {!isView && <th className="text-end">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(members ?? []).map((member) => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td>{member.email}</td>
                      {!isView && (
                        <td className="text-end">
                          <RemoveButton
                            action={removeUserFromGroup.bind(null, groupId, member.id)}
                            confirmMessage={`Remove "${member.name}" from this group?`}
                            label={`Remove ${member.name}`}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                  {(members ?? []).length === 0 && (
                    <tr>
                      <td colSpan={isView ? 2 : 3} className="text-center text-secondary py-4">
                        No members yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
