"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    jQuery?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (target: unknown): any;
      fn: Record<string, unknown>;
    };
  }
}

type Option = { value: string; label: string };

export function Select2Select({
  name,
  defaultValue,
  defaultValues,
  multiple,
  small,
  options,
  placeholder = "Select…",
  required,
  disabled,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  /** Only used when `multiple` is true. */
  defaultValues?: string[];
  multiple?: boolean;
  /**
   * Matches `form-select-sm`/`btn-sm` height (e.g. inside a toolbar next to
   * a "sm" search box and buttons) — AdminLTE's compat CSS keys Select2's
   * compact sizing off `form-select-sm` on the underlying (hidden) select
   * via a sibling selector, so it has to land on this element specifically,
   * not just be inherited from an ancestor like `.input-group-sm`.
   */
  small?: boolean;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: string | string[]) => void;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  // Select2 reports selection changes through jQuery's own event system
  // (`$el.trigger('change')`), which never becomes a real native DOM event —
  // so React's onChange prop on the <select> is never called for a
  // Select2-driven pick. Bind to jQuery's event directly instead.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const el = selectRef.current;
    if (!el) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let $el: any;
    const handleChange = () => {
      const val = $el.val();
      onChangeRef.current?.(multiple ? (Array.isArray(val) ? val : []) : String(val ?? ""));
    };

    function init() {
      const jq = window.jQuery;
      if (!jq || !jq.fn.select2) {
        timer = setTimeout(init, 50);
        return;
      }
      if (cancelled) return;
      $el = jq(el);
      $el.select2({ width: "100%", placeholder, allowClear: !multiple && !required });
      $el.on("change", handleChange);
    }
    init();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if ($el?.data("select2")) {
        $el.off("change", handleChange);
        $el.select2("destroy");
      }
    };
  }, [placeholder, required, multiple]);

  return (
    <select
      ref={selectRef}
      id={name}
      name={name}
      className={`form-select${small ? " form-select-sm" : ""}`}
      multiple={multiple}
      defaultValue={multiple ? defaultValues : (defaultValue ?? "")}
      required={required}
      disabled={disabled}
      onChange={(e) =>
        onChange?.(multiple ? Array.from(e.target.selectedOptions).map((o) => o.value) : e.target.value)
      }
    >
      {!multiple && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
