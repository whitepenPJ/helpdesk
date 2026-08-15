"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Select2Select } from "./select2-select";
import { FormVendorScripts } from "./form-vendor-scripts";

type Option = { value: string; label: string };

export type AddMemberState = { errors?: Record<string, string[]>; success?: boolean } | undefined;

// Hand-rolled modal (no Bootstrap JS) — same approach as everywhere else in
// this app that needs to coexist with an imperative jQuery-based widget
// (Select2) inside it: keep the two systems from fighting over the same DOM
// by driving all of the modal's own show/hide purely through React state.
export function AddUserButton({
  users,
  action,
  buttonLabel,
  modalTitle,
  fieldLabel,
  emptyMessage,
}: {
  users: Option[];
  action: (prevState: AddMemberState, formData: FormData) => Promise<AddMemberState>;
  buttonLabel: string;
  modalTitle: string;
  fieldLabel: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>
        <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
        {buttonLabel}
      </button>
      {open && (
        <AddUserModalDialog
          users={users}
          action={action}
          modalTitle={modalTitle}
          fieldLabel={fieldLabel}
          emptyMessage={emptyMessage}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AddUserModalDialog({
  users,
  action,
  modalTitle,
  fieldLabel,
  emptyMessage,
  onClose,
}: {
  users: Option[];
  action: (prevState: AddMemberState, formData: FormData) => Promise<AddMemberState>;
  modalTitle: string;
  fieldLabel: string;
  emptyMessage?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AddMemberState, FormData>(action, undefined);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onClose();
    }
  }, [state, router, onClose]);

  return (
    <>
      <FormVendorScripts />
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <form action={formAction}>
              <div className="modal-header">
                <h5 className="modal-title">{modalTitle}</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
              <div className="modal-body">
                {users.length === 0 ? (
                  <p className="text-secondary mb-0">{emptyMessage ?? "No users available to add."}</p>
                ) : (
                  <>
                    <label htmlFor="userId" className="form-label">
                      {fieldLabel}
                    </label>
                    <Select2Select name="userId" required placeholder="Select a user" options={users} />
                  </>
                )}
                {state?.errors?.userId && <div className="text-danger small mt-1">{state.errors.userId[0]}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending || users.length === 0}>
                  {pending ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
