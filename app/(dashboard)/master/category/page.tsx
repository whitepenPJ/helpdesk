import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { deleteCategory } from "@/app/actions/categories";
import { DeleteButton } from "../../_components/delete-button";
import { SortableTh } from "../../_components/sortable-th";
import { Pagination } from "../../_components/pagination";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import type { Prisma } from "@/app/generated/prisma/client";

export const metadata: Metadata = { title: "Categories" };

const PAGE_SIZE = 10;

const SORT_COLUMNS = ["name", "isActive", "admins", "tickets", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.CategoryOrderByWithRelationInput {
  switch (sortBy) {
    case "admins":
      return { CategoryAdmin: { _count: sortDir } };
    case "tickets":
      return { Ticket: { _count: sortDir } };
    default:
      return { [sortBy]: sortDir };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  "category-in-use": "This category still has tickets — remove those first.",
};

export default async function CategoriesPage({ searchParams }: PageProps<"/master/category">) {
  await requireAdmin();

  const { q, page, error, sort, dir } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const currentPage = Math.max(1, Number(page) || 1);
  const { sortBy, sortDir } = parseSort(
    typeof sort === "string" ? sort : undefined,
    typeof dir === "string" ? dir : undefined,
    SORT_COLUMNS,
    { column: "createdAt", dir: "desc" }
  );

  const where: Prisma.CategoryWhereInput = query ? { name: { contains: query, mode: "insensitive" } } : {};

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: { _count: { select: { CategoryAdmin: true, Ticket: true } } },
      orderBy: buildOrderBy(sortBy, sortDir),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.category.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const errorMessage = typeof error === "string" ? ERROR_MESSAGES[error] : undefined;
  const linkQuery = query ? { q: query } : {};

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Categories</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">Master</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Categories
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          {errorMessage && (
            <div className="alert alert-danger" role="alert">
              {errorMessage}
            </div>
          )}

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
                            placeholder="Search categories"
                            aria-label="Search categories"
                          />
                        </div>
                        <button type="submit" className="btn btn-sm btn-outline-secondary">
                          <i className="bi bi-search me-1" aria-hidden="true"></i>
                          Search
                        </button>
                        <Link href="/master/category/new" className="btn btn-sm btn-primary">
                          <i className="bi bi-tag me-1" aria-hidden="true"></i>
                          New category
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
                          <SortableTh label="Name" column="name" pathname="/master/category" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="isActive" pathname="/master/category" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Responsible users" column="admins" pathname="/master/category" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Tickets" column="tickets" pathname="/master/category" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((category) => (
                          <tr key={category.id}>
                            <td className="fw-medium">{category.name}</td>
                            <td>
                              <span
                                className={`badge ${category.isActive ? "text-bg-success" : "text-bg-secondary"}`}
                              >
                                {category.isActive ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>
                            <td>{category._count.CategoryAdmin}</td>
                            <td>{category._count.Ticket}</td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <Link
                                  href={`/master/category/${category.id}/view`}
                                  className="btn btn-outline-secondary"
                                  title="View"
                                  aria-label={`View ${category.name}`}
                                >
                                  <i className="bi bi-eye" aria-hidden="true"></i>
                                </Link>
                                <Link
                                  href={`/master/category/${category.id}/edit`}
                                  className="btn btn-outline-secondary"
                                  title="Edit"
                                  aria-label={`Edit ${category.name}`}
                                >
                                  <i className="bi bi-pencil" aria-hidden="true"></i>
                                </Link>
                                <DeleteButton
                                  action={deleteCategory.bind(null, category.id)}
                                  confirmMessage={`Delete category "${category.name}"? This cannot be undone.`}
                                  label={`Delete ${category.name}`}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {categories.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center text-secondary py-4">
                              No categories found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer clearfix">
                  <div className="float-start pt-1 fs-7 text-body-secondary">
                    Showing {categories.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                    {(currentPage - 1) * PAGE_SIZE + categories.length} of {total} categories
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    makeHref={(p) => ({ pathname: "/master/category", query: { ...linkQuery, sort: sortBy, dir: sortDir, page: p } })}
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
