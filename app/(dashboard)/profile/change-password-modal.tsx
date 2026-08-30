"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Script from "next/script";
import { changePassword, type ChangePasswordState } from "@/app/actions/profile";
import { useMounted } from "../_components/use-mounted";

// Loose shim — just the bits of SweetAlert2's API this component calls. Same
// CDN-loaded, per-component pattern as other modals; next/script dedupes by
// src so this doesn't double-load it alongside them.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

// Only meaningful for Credentials accounts — an OAuth-only sign-in (Entra
// ID) has no passwordHash to change. `hasPassword` gates this from the
// server-fetched User row, not client-guessed state.
export function ChangePasswordButton({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => setOpen(true)}
        disabled={!hasPassword}
        title={hasPassword ? undefined : "This account signs in with Microsoft — there's no password to change."}
      >
        <i className="bi bi-key me-1" aria-hidden="true"></i>
        Change Password
      </button>
      {open && <ChangePasswordModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(changePassword, undefined);
  // Portaled to <body> rather than rendered in place — this button lives
  // inside the Profile page's own <form>, and a nested <form> in the DOM
  // makes React unable to tell which form owns a submit.
  const mounted = useMounted();

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  useEffect(() => {
    if (!state?.success) return;
    onClose();
    window.Swal?.fire({ title: "Done", text: "Password changed.", icon: "success", timer: 1500, showConfirmButton: false });
  }, [state, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" strategy="afterInteractive" />
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show" style={{ display: "block" }} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <form action={formAction}>
              <div className="modal-header">
                <h5 className="modal-title">Change Password</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
              <div className="modal-body text-start">
                <label htmlFor="currentPassword" className="form-label">
                  Current password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  className="form-control mb-1"
                  autoComplete="current-password"
                  required
                />
                {state?.errors?.currentPassword && (
                  <div className="text-danger small mb-2">{state.errors.currentPassword[0]}</div>
                )}

                <label htmlFor="newPassword" className="form-label mt-2">
                  New password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  className="form-control mb-1"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                {state?.errors?.newPassword && <div className="text-danger small mb-2">{state.errors.newPassword[0]}</div>}

                <label htmlFor="confirmNewPassword" className="form-label mt-2">
                  Confirm new password
                </label>
                <input
                  type="password"
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  className="form-control mb-1"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                {state?.errors?.confirmNewPassword && (
                  <div className="text-danger small mb-2">{state.errors.confirmNewPassword[0]}</div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
                  <i className="bi bi-x-lg me-1" aria-hidden="true"></i>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  <i className="bi bi-key me-1" aria-hidden="true"></i>
                  {pending ? "Saving…" : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
