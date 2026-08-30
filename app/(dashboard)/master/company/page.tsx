import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { deleteCompany } from "@/app/actions/companies";
import { DeleteButton } from "../../_components/delete-button";
import { SortableTh } from "../../_components/sortable-th";
import { Pagination } from "../../_components/pagination";
import { PageSizeSelect } from "../../_components/page-size-select";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import type { Prisma } from "@/app/generated/prisma/client";
import { parsePageSize } from "@/app/lib/page-size";

export const metadata: Metadata = { title: "Companies" };

const SORT_COLUMNS = ["name", "code", "address", "taxId", "isActive", "departments", "users", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.CompanyOrderByWithRelationInput {
  switch (sortBy) {
    case "departments":
      return { Department: { _count: sortDir } };
    case "users":
      return { User: { _count: sortDir } };
    default:
      return { [sortBy]: sortDir };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  "company-in-use": "This company still has users, departments, or tickets — remove those first.",
};

export default async function CompaniesPage({ searchParams }: PageProps<"/master/company">) {
  await requireAdmin();

  const { q, page, pageSize: pageSizeParam, error, sort, dir } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const pageSize = parsePageSize(typeof pageSizeParam === "string" ? pageSizeParam : undefined);
  const currentPage = Math.max(1, Number(page) || 1);
  const { sortBy, sortDir } = parseSort(
    typeof sort === "string" ? sort : undefined,
    typeof dir === "string" ? dir : undefined,
    SORT_COLUMNS,
    { column: "createdAt", dir: "desc" }
  );

  const where: Prisma.CompanyWhereInput = query ? { name: { contains: query, mode: "insensitive" } } : {};

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: { _count: { select: { User: true, Department: true } } },
      orderBy: buildOrderBy(sortBy, sortDir),
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.company.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const errorMessage = typeof error === "string" ? ERROR_MESSAGES[error] : undefined;
  const linkQuery = { ...(query ? { q: query } : {}), pageSize: String(pageSize) };

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Companies</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">Master</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Companies
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
                            placeholder="Search companies"
                            aria-label="Search companies"
                          />
                        </div>
                        <button type="submit" className="btn btn-sm btn-outline-secondary">
                          <i className="bi bi-search me-1" aria-hidden="true"></i>
                          Search
                        </button>
                        <Link href="/master/company/new" className="btn btn-sm btn-primary">
                          <i className="bi bi-building-add me-1" aria-hidden="true"></i>
                          New company
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
                          <SortableTh label="Company" column="name" pathname="/master/company" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Code" column="code" pathname="/master/company" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Address" column="address" pathname="/master/company" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Tax ID" column="taxId" pathname="/master/company" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="isActive" pathname="/master/company" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Departments" column="departments" pathname="/master/company" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Users" column="users" pathname="/master/company" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((company) => (
                          <tr key={company.id}>
                            <td className="fw-medium">{company.name}</td>
                            <td>{company.code ?? <span className="text-secondary">—</span>}</td>
                            <td>{company.address ?? <span className="text-secondary">—</span>}</td>
                            <td>{company.taxId ?? <span className="text-secondary">—</span>}</td>
                            <td>
                              <span className={`badge ${company.isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                                {company.isActive ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>
                            <td>{company._count.Department}</td>
                            <td>{company._count.User}</td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <Link
                                  href={`/master/company/${company.id}/view`}
                                  className="btn btn-outline-secondary"
                                  title="View"
                                  aria-label={`View ${company.name}`}
                                >
                                  <i className="bi bi-eye" aria-hidden="true"></i>
                                </Link>
                                <Link
                                  href={`/master/company/${company.id}/edit`}
                                  className="btn btn-outline-secondary"
                                  title="Edit"
                                  aria-label={`Edit ${company.name}`}
                                >
                                  <i className="bi bi-pencil" aria-hidden="true"></i>
                                </Link>
                                <DeleteButton
                                  action={deleteCompany.bind(null, company.id)}
                                  confirmMessage={`Delete company "${company.name}"? This cannot be undone.`}
                                  label={`Delete ${company.name}`}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {companies.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center text-secondary py-4">
                              No companies found.
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
                      Showing {companies.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                      {(currentPage - 1) * pageSize + companies.length} of {total} companies
                    </div>
                    <PageSizeSelect pageSize={pageSize} />
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    className="pagination pagination-sm m-0"
                    makeHref={(p) => ({ pathname: "/master/company", query: { ...linkQuery, sort: sortBy, dir: sortDir, page: p } })}
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
