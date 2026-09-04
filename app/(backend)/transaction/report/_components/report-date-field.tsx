"use client";

import { useState } from "react";

// A native <input type="date"> displays its picker text in whatever format
// the visitor's OS/browser locale dictates (not the page's own `lang`) —
// unreliable for guaranteeing "day month year" everywhere. This keeps the
// native picker (for its calendar UX and value semantics) but adds an
// unambiguous day-month-year echo underneath, so the read format is fixed
// regardless of the visitor's locale.
export function ReportDateField({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const formatted =
    value.length === 10
      ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "";

  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input
        type="date"
        id={id}
        name={name}
        className="form-control"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="form-text">{formatted || " "}</div>
    </div>
  );
}
