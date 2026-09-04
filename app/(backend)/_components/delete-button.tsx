"use client";

import { useTransition } from "react";
import { swal } from "@/app/lib/swal";

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
    <button
      type="button"
      className="btn btn-outline-secondary"
      aria-label={label}
      onClick={handleClick}
      disabled={isPending}
    >
      <i className="bi bi-trash" aria-hidden="true"></i>
    </button>
  );
}
