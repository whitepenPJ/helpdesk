"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Sibling of DeleteButton for actions that detach a record (e.g. remove a
// user from a group) rather than delete one. Those actions revalidatePath
// but deliberately don't redirect() — the admin stays on the same edit page
// — so this explicitly router.refresh()es afterward instead of relying on
// the delete-then-redirect-to-self refresh DeleteButton gets for free.
declare global {
  interface Window {
    Swal?: {
      fire: (options: Record<string, unknown>) => Promise<{ isConfirmed: boolean }>;
    };
  }
}

export function RemoveButton({
  action,
  confirmMessage,
  label,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    const swal = window.Swal;
    if (!swal) return;

    const result = await swal.fire({
      title: "Remove?",
      text: confirmMessage,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, remove",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
    });

    if (result.isConfirmed) {
      startTransition(async () => {
        await action();
        router.refresh();
      });
    }
  }

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" strategy="afterInteractive" />
      <button
        type="button"
        className="btn btn-sm btn-outline-danger"
        aria-label={label}
        onClick={handleClick}
        disabled={isPending}
      >
        <i className="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </>
  );
}
