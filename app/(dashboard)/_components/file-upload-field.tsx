"use client";

import { useRef, useState } from "react";

type ExistingFile = { url: string; name: string };

// Multi-file picker with preview + remove, and (edit mode) keep/remove of
// already-uploaded files. Kept URLs submit as `${name}Existing` hidden
// inputs — the server action reads those for what to keep, and
// `formData.getAll(name).filter(f => f instanceof File)` for new uploads.
export function FileUploadField({
  name,
  existingFiles = [],
  accept,
  preview,
  disabled,
}: {
  name: string;
  existingFiles?: ExistingFile[];
  accept?: string;
  preview: "image" | "list";
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keepUrls, setKeepUrls] = useState<string[]>(existingFiles.map((f) => f.url));
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const existingByUrl = new Map(existingFiles.map((f) => [f.url, f]));

  function syncInput(files: File[]) {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const next = [...newFiles, ...picked];
    setNewFiles(next);
    syncInput(next);
  }

  function removeExisting(url: string) {
    setKeepUrls((prev) => prev.filter((u) => u !== url));
  }

  function removeNew(index: number) {
    const next = newFiles.filter((_, i) => i !== index);
    setNewFiles(next);
    syncInput(next);
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        name={name}
        multiple
        accept={accept}
        className="d-none"
        onChange={handleChange}
        disabled={disabled}
      />
      {keepUrls.map((url) => (
        <input key={url} type="hidden" name={`${name}Existing`} value={url} />
      ))}

      {!disabled && (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary mb-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <i className="bi bi-upload me-1" aria-hidden="true"></i>
          Add files
        </button>
      )}

      {preview === "image" ? (
        <div className="d-flex flex-wrap gap-2">
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
            </div>
          ))}
          {newFiles.map((file, i) => (
            <div key={`${file.name}-${i}`} className="position-relative" style={{ width: 96, height: 96 }}>
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-100 h-100 rounded border"
                style={{ objectFit: "cover" }}
              />
              {!disabled && (
                <button
                  type="button"
                  className="btn-close position-absolute top-0 end-0 bg-body p-1 m-1 rounded-circle"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeNew(i)}
                ></button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <ul className="list-unstyled mb-0">
          {keepUrls.map((url) => (
            <li key={url} className="d-flex align-items-center gap-2">
              <i className="bi bi-paperclip" aria-hidden="true"></i>
              <span className="flex-grow-1">{existingByUrl.get(url)?.name ?? url}</span>
              {!disabled && (
                <button
                  type="button"
                  className="btn-close"
                  aria-label={`Remove ${existingByUrl.get(url)?.name ?? "file"}`}
                  onClick={() => removeExisting(url)}
                ></button>
              )}
            </li>
          ))}
          {newFiles.map((file, i) => (
            <li key={`${file.name}-${i}`} className="d-flex align-items-center gap-2">
              <i className="bi bi-paperclip" aria-hidden="true"></i>
              <span className="flex-grow-1">{file.name}</span>
              {!disabled && (
                <button
                  type="button"
                  className="btn-close"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeNew(i)}
                ></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
