import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { deleteLessonLearned } from "@/app/actions/lesson-learned";
import { DeleteButton } from "../../_components/delete-button";
import { SortableTh } from "../../_components/sortable-th";
import { Pagination } from "../../_components/pagination";
import { PageSizeSelect } from "../../_components/page-size-select";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import { formatDateTime } from "@/app/lib/date-format";
import type { Prisma } from "@/app/generated/prisma/client";
import { parsePageSize } from "@/app/lib/page-size";

export const metadata: Metadata = { title: "Lesson Learned" };

const SORT_COLUMNS = ["title", "isActive", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.LessonLearnedOrderByWithRelationInput {
  return { [sortBy]: sortDir };
}

export default async function LessonLearnedAdminPage({ searchParams }: PageProps<"/master/lesson-learned">) {
  await requireAdmin();

  const { q, page, pageSize: pageSizeParam, sort, dir } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const pageSize = parsePageSize(typeof pageSizeParam === "string" ? pageSizeParam : undefined);
  const currentPage = Math.max(1, Number(page) || 1);
  const { sortBy, sortDir } = parseSort(
    typeof sort === "string" ? sort : undefined,
    typeof dir === "string" ? dir : undefined,
    SORT_COLUMNS,
    { column: "createdAt", dir: "desc" }
  );

  const where: Prisma.LessonLearnedWhereInput = query ? { title: { contains: query, mode: "insensitive" } } : {};

  const [entries, total] = await Promise.all([
    prisma.lessonLearned.findMany({
      where,
      orderBy: buildOrderBy(sortBy, sortDir),
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lessonLearned.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const linkQuery = { ...(query ? { q: query } : {}), pageSize: String(pageSize) };

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Lesson Learned</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">Master</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Lesson Learned
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-header">
                  <div className="row g-2 align-items-center">
                    <div className="col-12 col-md-12">
                      <form method="get" className="d-flex gap-2 align-items-center flex-column flex-md-row flex-wrap">
                        <div className="input-group input-group-sm w-auto flex-grow-1">
                          <span className="input-group-text">
                            <i className="bi bi-search" aria-hidden="true"></i>
                          </span>
                          <input
                            type="search"
                            name="q"
                            defaultValue={query}
                            className="form-control form-control-sm"
                            placeholder="Search lesson learned"
                            aria-label="Search lesson learned"
                          />
                        </div>
                        <button type="submit" className="btn btn-sm btn-outline-secondary">
                          <i className="bi bi-search me-1" aria-hidden="true"></i>
                          Search
                        </button>
                        <Link href="/master/lesson-learned/new" className="btn btn-sm btn-primary">
                          <i className="bi bi-journal-plus me-1" aria-hidden="true"></i>
                          New entry
                        </Link>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                      <thead>
                        <tr>
                          <SortableTh label="Title" column="title" pathname="/master/lesson-learned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="isActive" pathname="/master/lesson-learned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Created" column="createdAt" pathname="/master/lesson-learned" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="fw-medium">{entry.title}</td>
                            <td>
                              <span className={`badge ${entry.isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                                {entry.isActive ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>
                            <td>{formatDateTime(entry.createdAt)}</td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <Link
                                  href={`/master/lesson-learned/${entry.id}/view`}
                                  className="btn btn-outline-secondary"
                                  title="View"
                                  aria-label={`View ${entry.title}`}
                                >
                                  <i className="bi bi-eye" aria-hidden="true"></i>
                                </Link>
                                <Link
                                  href={`/master/lesson-learned/${entry.id}/edit`}
                                  className="btn btn-outline-secondary"
                                  title="Edit"
                                  aria-label={`Edit ${entry.title}`}
                                >
                                  <i className="bi bi-pencil" aria-hidden="true"></i>
                                </Link>
                                <DeleteButton
                                  action={deleteLessonLearned.bind(null, entry.id)}
                                  confirmMessage={`Delete "${entry.title}"? This cannot be undone.`}
                                  label={`Delete ${entry.title}`}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {entries.length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center text-secondary py-4">
                              No lesson learned entries found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex flex-wrap align-items-center gap-3">
                    <div className="fs-7 text-body-secondary">
                      Showing {entries.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                      {(currentPage - 1) * pageSize + entries.length} of {total} entries
                    </div>
                    <PageSizeSelect pageSize={pageSize} />
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    className="pagination pagination-sm m-0"
                    makeHref={(p) => ({
                      pathname: "/master/lesson-learned",
                      query: { ...linkQuery, sort: sortBy, dir: sortDir, page: p },
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
