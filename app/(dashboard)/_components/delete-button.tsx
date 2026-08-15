"use client";

import Script from "next/script";
import { useTransition } from "react";

// Loose shim — just the bits of SweetAlert2's API this component calls.
// Loaded via CDN (no jQuery dependency, unlike Select2), self-contained per
// button; next/script dedupes by src so N delete buttons on one page still
// only load it once.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

export function DeleteButton({
  action,
  confirmMessage,
  label,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    const swal = window.Swal;
    if (!swal) return;

    const result = await swal.fire({
      title: "Are you sure?",
      text: confirmMessage,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
    });

    // Call the Server Action outside SweetAlert2's own promise chain — it
    // ends in redirect(), which Next.js needs to handle as a real
    // navigation, not as a value resolved/rejected inside a third-party
    // dialog's preConfirm handler.
    if (result.isConfirmed) {
      startTransition(() => {
        action();
      });
    }
  }

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" strategy="afterInteractive" />
      <button
        type="button"
        className="btn btn-outline-secondary"
        aria-label={label}
        onClick={handleClick}
        disabled={isPending}
      >
        <i className="bi bi-trash" aria-hidden="true"></i>
      </button>
    </>
  );
}
