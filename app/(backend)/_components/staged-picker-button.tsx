"use client";

import { useEffect, useState } from "react";
import { Select2Select } from "./select2-select";
import { FormVendorScripts } from "./form-vendor-scripts";

type Option = { value: string; label: string };

// Create-mode sibling of AddUserButton: there's no id to bind a server
// action to yet (the parent record doesn't exist until the whole form
// submits), so this just stages a pick into the caller's own React state via
// onAdd — no server round trip, no pending/error state of its own.
export function StagedPickerButton({
  options,
  onAdd,
  buttonLabel,
  modalTitle,
  fieldLabel,
  emptyMessage,
}: {
  options: Option[];
  onAdd: (value: string, label: string) => void;
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
        <StagedPickerModal
          options={options}
          onAdd={onAdd}
          modalTitle={modalTitle}
          fieldLabel={fieldLabel}
          emptyMessage={emptyMessage}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function StagedPickerModal({
  options,
  onAdd,
  modalTitle,
  fieldLabel,
  emptyMessage,
  onClose,
}: {
  options: Option[];
  onAdd: (value: string, label: string) => void;
  modalTitle: string;
  fieldLabel: string;
  emptyMessage?: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState("");

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  function handleAdd() {
    const option = options.find((o) => o.value === selected);
    if (!option) return;
    onAdd(option.value, option.label);
    onClose();
  }

  return (
    <>
      <FormVendorScripts />
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{modalTitle}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {options.length === 0 ? (
                <p className="text-secondary mb-0">{emptyMessage ?? "No options available to add."}</p>
              ) : (
                <>
                  <label htmlFor="staged-picker" className="form-label">
                    {fieldLabel}
                  </label>
                  <Select2Select
                    name="staged-picker"
                    required
                    placeholder="Select…"
                    options={options}
                    onChange={(value) => setSelected(value as string)}
                  />
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={options.length === 0 || !selected}>
                <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
