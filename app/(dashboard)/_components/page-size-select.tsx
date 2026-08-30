"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PAGE_SIZE_OPTIONS } from "@/app/lib/page-size";

// Navigates client-side (preserving every other query param already on the
// URL — search, sort, filters) rather than needing this folded into each
// page's own GET filter form, so it drops into any table's footer the same
// way regardless of what that page's filters look like.
export function PageSizeSelect({ pageSize }: { pageSize: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", e.target.value);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <label htmlFor="pageSize" className="form-label mb-0 fs-7 text-secondary text-nowrap">
        Rows per page
      </label>
      <select
        id="pageSize"
        className="form-select form-select-sm w-auto"
        value={pageSize}
        onChange={handleChange}
        aria-label="Rows per page"
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
