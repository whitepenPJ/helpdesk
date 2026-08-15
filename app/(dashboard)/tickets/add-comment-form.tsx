"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createComment, type CommentFormState } from "@/app/actions/comments";

export function AddCommentForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const action = createComment.bind(null, ticketId);
  const [state, formAction, pending] = useActionState<CommentFormState, FormData>(action, undefined);

  // Same "stay on page, revalidatePath isn't enough on its own" pattern as
  // the Master modules' add-member modals — explicitly refresh after a
  // successful post so the new comment (and the tab's count) shows up.
  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [state, router]);

  // Re-key on every new state: clears the field after a successful post,
  // but keeps what was typed (via state.values) after a validation error.
  const formKey = state ? JSON.stringify(state) : "initial";

  return (
    <form key={formKey} action={formAction} className="mt-3">
      <label htmlFor="message" className="form-label">
        Add a comment
      </label>
      <textarea
        id="message"
        name="message"
        className="form-control"
        rows={3}
        defaultValue={state?.values?.message}
        required
      />
      {state?.errors?.message && <div className="text-danger small mt-1">{state.errors.message[0]}</div>}

      <label htmlFor="comment-attachments" className="form-label mt-2">
        Attach File
      </label>
      <input type="file" id="comment-attachments" name="attachments" className="form-control" multiple />

      <button className="btn btn-primary btn-sm mt-2" type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}
