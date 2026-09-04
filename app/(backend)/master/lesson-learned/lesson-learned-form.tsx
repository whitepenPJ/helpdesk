"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createLessonLearned,
  updateLessonLearned,
  type LessonLearnedFormState,
} from "@/app/actions/lesson-learned";
import { RichTextEditor } from "../../_components/rich-text-editor";
import { FormVendorScripts } from "../../_components/form-vendor-scripts";
import { BootstrapFileInput } from "../../_components/bootstrap-file-input";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <div className="text-danger small mt-1">{messages[0]}</div>;
}

export function LessonLearnedForm({
  mode,
  entryId,
  initialValues,
  existingImages,
  existingAttachments,
}: {
  mode: "create" | "edit" | "view";
  entryId?: string;
  initialValues?: { title: string; description: string; isActive: boolean };
  existingImages?: { url: string; name: string }[];
  existingAttachments?: { url: string; name: string }[];
}) {
  const isView = mode === "view";
  const action = mode === "create" ? createLessonLearned : updateLessonLearned.bind(null, entryId as string);
  const [state, formAction, pending] = useActionState<LessonLearnedFormState, FormData>(action, undefined);

  const values = state?.values;
  const titleValue = values?.title ?? initialValues?.title;
  const descriptionValue = values?.description ?? initialValues?.description;
  const isActiveValue = values?.isActive ?? initialValues?.isActive ?? true;
  const formKey = state ? JSON.stringify(state) : "initial";

  return (
    <div className="card card-primary card-outline mb-4">
      <div className="card-header">
        <div className="card-title">
          {mode === "create" ? "New Lesson Learned" : isView ? "View Lesson Learned" : "Edit Lesson Learned"}
        </div>
      </div>
      <form key={formKey} action={formAction}>
        <FormVendorScripts select2={false} fileInput />
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-8">
              <label htmlFor="title" className="form-label">
                Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                className="form-control"
                defaultValue={titleValue}
                required
                disabled={isView}
              />
              <FieldError messages={state?.errors?.title} />
            </div>
            <div className="col-md-4">
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

            <div className="col-12">
              <label className="form-label">Description</label>
              <RichTextEditor name="description" defaultValue={descriptionValue} disabled={isView} />
              <FieldError messages={state?.errors?.description} />
            </div>

            <div className="col-12">
              <label className="form-label">Images</label>
              <BootstrapFileInput
                name="images"
                existingFiles={existingImages}
                accept="image/*"
                preview="image"
                disabled={isView}
              />
            </div>

            <div className="col-12">
              <label className="form-label">Attach File</label>
              <BootstrapFileInput name="attachments" existingFiles={existingAttachments} disabled={isView} />
            </div>
          </div>
        </div>
        <div className="card-footer d-flex gap-2 justify-content-end">
          {isView ? (
            <Link href="/master/lesson-learned" className="btn btn-secondary">
              <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>
              Back
            </Link>
          ) : (
            <>
              <button className="btn btn-primary" type="submit" disabled={pending}>
                <i className={`bi ${mode === "create" ? "bi-plus-lg" : "bi-check2"} me-1`} aria-hidden="true"></i>
                {pending ? "Saving…" : mode === "create" ? "Create entry" : "Save changes"}
              </button>
              <Link href="/master/lesson-learned" className="btn btn-secondary">
                <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>
                Back
              </Link>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
