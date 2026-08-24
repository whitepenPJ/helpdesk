import Link from "next/link";

type Href = React.ComponentProps<typeof Link>["href"];

/** Shared list-page pagination — matches AdminLTE's pagination markup with First/Prev/Next/Last added. */
export function Pagination({
  currentPage,
  totalPages,
  makeHref,
  className = "pagination pagination-sm m-0 float-end",
}: {
  currentPage: number;
  totalPages: number;
  makeHref: (page: number) => Href;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const atFirst = currentPage === 1;
  const atLast = currentPage === totalPages;

  return (
    <ul className={className}>
      <li className={`page-item ${atFirst ? "disabled" : ""}`}>
        {atFirst ? (
          <span className="page-link" aria-hidden="true">
            <i className="bi bi-chevron-double-left"></i>
          </span>
        ) : (
          <Link className="page-link" href={makeHref(1)} aria-label="First">
            <i className="bi bi-chevron-double-left" aria-hidden="true"></i>
          </Link>
        )}
      </li>
      <li className={`page-item ${atFirst ? "disabled" : ""}`}>
        {atFirst ? (
          <span className="page-link" aria-hidden="true">
            <i className="bi bi-chevron-left"></i>
          </span>
        ) : (
          <Link className="page-link" href={makeHref(currentPage - 1)} aria-label="Previous">
            <i className="bi bi-chevron-left" aria-hidden="true"></i>
          </Link>
        )}
      </li>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
          <Link className="page-link" href={makeHref(p)}>
            {p}
          </Link>
        </li>
      ))}
      <li className={`page-item ${atLast ? "disabled" : ""}`}>
        {atLast ? (
          <span className="page-link" aria-hidden="true">
            <i className="bi bi-chevron-right"></i>
          </span>
        ) : (
          <Link className="page-link" href={makeHref(currentPage + 1)} aria-label="Next">
            <i className="bi bi-chevron-right" aria-hidden="true"></i>
          </Link>
        )}
      </li>
      <li className={`page-item ${atLast ? "disabled" : ""}`}>
        {atLast ? (
          <span className="page-link" aria-hidden="true">
            <i className="bi bi-chevron-double-right"></i>
          </span>
        ) : (
          <Link className="page-link" href={makeHref(totalPages)} aria-label="Last">
            <i className="bi bi-chevron-double-right" aria-hidden="true"></i>
          </Link>
        )}
      </li>
    </ul>
  );
}
