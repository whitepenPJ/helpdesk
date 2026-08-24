"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    jQuery?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (target: unknown): any;
      fn: Record<string, unknown>;
    };
  }
}

type ExistingFile = { url: string; name: string };

// New-file picker backed by Krajee's bootstrap-fileinput (jQuery plugin,
// loaded via FormVendorScripts `fileInput`) — drag & drop, per-file preview
// thumbnails, remove-before-submit. Krajee's own "delete" for *initial*
// previews only works against a real delete-by-key AJAX endpoint (see
// fileinput.js: the remove button for an initial preview is left both
// unbound and `disabled` unless `initialPreviewConfig[].url` resolves to
// one), which this app doesn't have — mutations go through Server Actions,
// not hand-rolled API routes. So already-uploaded files are rendered as a
// plain list above the widget instead, with their own local-only remove;
// kept ones submit as `${name}Existing` hidden inputs, same contract as
// the old hand-rolled FileUploadField this replaces.
//
// The visible input itself is never what gets submitted. Krajee briefly
// sets it `disabled` while it processes a newly-picked selection (building
// preview thumbnails etc, ~200ms) — and a disabled control is excluded
// from FormData entirely per the HTML forms spec, even though its `.files`
// stays populated the whole time. Submitting in that window would silently
// drop the file with no error. So the visible input has no `name` and is
// purely cosmetic; every native `change` it fires (initial pick, and any
// later add/remove Krajee performs, which it implements by rewriting
// `.files` and redispatching `change`) is mirrored via DataTransfer onto a
// separate hidden input — always enabled, never touched by the plugin —
// which is what actually carries `name` and submits.
export function BootstrapFileInput({
  name,
  id = name,
  existingFiles = [],
  accept,
  preview = "list",
  disabled,
}: {
  name: string;
  id?: string;
  existingFiles?: ExistingFile[];
  accept?: string;
  preview?: "image" | "list";
  disabled?: boolean;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const submitInputRef = useRef<HTMLInputElement>(null);
  const [keepUrls, setKeepUrls] = useState<string[]>(existingFiles.map((f) => f.url));
  const existingByUrl = new Map(existingFiles.map((f) => [f.url, f]));

  useEffect(() => {
    const el = pickerRef.current;
    if (!el || disabled) return;

    function syncSubmitInput(files: FileList | null) {
      const submitEl = submitInputRef.current;
      if (!submitEl) return;
      const dt = new DataTransfer();
      if (files) {
        for (const file of Array.from(files)) dt.items.add(file);
      }
      submitEl.files = dt.files;
    }

    function handleChange() {
      syncSubmitInput(el!.files);
    }
    el.addEventListener("change", handleChange);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let $el: any;

    function init() {
      const jq = window.jQuery;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const themes = jq?.fn.fileinputThemes as any;
      if (!jq || !jq.fn.fileinput || !themes?.bs5) {
        timer = setTimeout(init, 50);
        return;
      }
      if (cancelled) return;
      $el = jq(el);
      $el.fileinput({
        theme: "bs5",
        showUpload: false,
        showCancel: false,
        showClose: false,
        browseOnZoneClick: true,
        browseClass: "btn btn-outline-secondary",
        removeClass: "btn btn-outline-danger",
      });
    }
    init();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      el.removeEventListener("change", handleChange);
      if ($el?.data("fileinput")) $el.fileinput("destroy");
    };
  }, [disabled]);

  function removeExisting(url: string) {
    setKeepUrls((prev) => prev.filter((u) => u !== url));
  }

  return (
    <div>
      {keepUrls.length > 0 &&
        (preview === "image" ? (
          <div className="d-flex flex-wrap gap-2 mb-2">
            {keepUrls.map((url) => (
              <div key={url} className="position-relative" style={{ width: 96, height: 96 }}>
                <img
                  src={url}
                  alt={existingByUrl.get(url)?.name ?? ""}
                  className="w-100 h-100 rounded border"
                  style={{ objectFit: "cover" }}
                />
                {!disabled && (
                  <button
                    type="button"
                    className="btn-close position-absolute top-0 end-0 bg-body p-1 m-1 rounded-circle"
                    aria-label={`Remove ${existingByUrl.get(url)?.name ?? "image"}`}
                    onClick={() => removeExisting(url)}
                  ></button>
                )}
                <input type="hidden" name={`${name}Existing`} value={url} />
              </div>
            ))}
          </div>
        ) : (
          <ul className="list-unstyled mb-2">
            {keepUrls.map((url) => (
              <li key={url} className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-paperclip" aria-hidden="true"></i>
                <span className="flex-grow-1 text-truncate">{existingByUrl.get(url)?.name ?? url}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="btn-close"
                    aria-label={`Remove ${existingByUrl.get(url)?.name ?? "file"}`}
                    onClick={() => removeExisting(url)}
                  ></button>
                )}
                <input type="hidden" name={`${name}Existing`} value={url} />
              </li>
            ))}
          </ul>
        ))}

      {!disabled && (
        <>
          <input ref={pickerRef} type="file" id={id} multiple accept={accept} />
          <input ref={submitInputRef} type="file" name={name} multiple className="d-none" tabIndex={-1} />
        </>
      )}
    </div>
  );
}
