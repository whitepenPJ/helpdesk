import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { deleteUser } from "@/app/actions/users";
import { DeleteButton } from "../../_components/delete-button";
import { ImportUsersButton } from "./import-users-button";
import { SortableTh } from "../../_components/sortable-th";
import { Pagination } from "../../_components/pagination";
import { PageSizeSelect } from "../../_components/page-size-select";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import type { Prisma, Role } from "@/app/generated/prisma/client";
import { ROLE_LABEL } from "@/app/lib/roles";
import { formatDateTime } from "@/app/lib/date-format";
import { parsePageSize } from "@/app/lib/page-size";

export const metadata: Metadata = { title: "Users" };

const SORT_COLUMNS = ["name", "email", "company", "role", "status", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.UserOrderByWithRelationInput {
  switch (sortBy) {
    case "company":
      return { Company: { name: sortDir } };
    default:
      return { [sortBy]: sortDir };
  }
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "text-bg-danger",
  SUPERVISOR: "text-bg-primary",
  USER: "text-bg-secondary",
};

const ERROR_MESSAGES: Record<string, string> = {
  "cannot-delete-self": "You can't delete your own account while signed in.",
};

export default async function UsersPage({ searchParams }: PageProps<"/master/user">) {
  await requireAdmin();

  const { q, role, page, pageSize: pageSizeParam, error, sort, dir } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const roleFilter = typeof role === "string" && role !== "all" ? role : "";
  const pageSize = parsePageSize(typeof pageSizeParam === "string" ? pageSizeParam : undefined);
  const currentPage = Math.max(1, Number(page) || 1);
  const { sortBy, sortDir } = parseSort(
    typeof sort === "string" ? sort : undefined,
    typeof dir === "string" ? dir : undefined,
    SORT_COLUMNS,
    { column: "createdAt", dir: "desc" }
  );

  const where: Prisma.UserWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(roleFilter ? { role: roleFilter as Role } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { Company: true, Department_User_departmentIdToDepartment: true },
      orderBy: buildOrderBy(sortBy, sortDir),
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const errorMessage = typeof error === "string" ? ERROR_MESSAGES[error] : undefined;
  const linkQuery = {
    ...(query ? { q: query } : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
    pageSize: String(pageSize),
  };

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Users</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">Master</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Users
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
                      <form
                        method="get"
                        className="d-flex gap-2 align-items-center flex-column flex-md-row flex-wrap"
                      >
                        <div className="input-group input-group-sm w-auto flex-grow-1">
                          <span className="input-group-text">
                            <i className="bi bi-search" aria-hidden="true"></i>
                          </span>
                          <input
                            type="search"
                            name="q"
                            defaultValue={query}
                            className="form-control form-control-sm"
                            placeholder="Search users"
                            aria-label="Search users"
                          />
                        </div>
                        <select
                          name="role"
                          defaultValue={roleFilter || "all"}
                          className="form-select form-select-sm w-auto"
                          aria-label="Filter by role"
                        >
                          <option value="all">All roles</option>
                          <option value="ADMIN">Admin</option>
                          <option value="SUPERVISOR">Approver</option>
                          <option value="USER">User</option>
                        </select>
                        <button type="submit" className="btn btn-sm btn-outline-secondary">
                          <i className="bi bi-funnel me-1" aria-hidden="true"></i>
                          Filter
                        </button>
                        <a
                          href={`/api/master/user/export${query || roleFilter ? `?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(roleFilter ? { role: roleFilter } : {}) }).toString()}` : ""}`}
                          className="btn btn-sm btn-outline-success"
                        >
                          <i className="bi bi-file-earmark-excel me-1" aria-hidden="true"></i>
                          Export
                        </a>
                        <ImportUsersButton />
                        <Link href="/master/user/new" className="btn btn-sm btn-primary">
                          <i className="bi bi-person-plus-fill me-1" aria-hidden="true"></i>
                          New user
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
                          <SortableTh label="User" column="name" pathname="/master/user" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Email" column="email" pathname="/master/user" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Company / Department" column="company" pathname="/master/user" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Role" column="role" pathname="/master/user" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="status" pathname="/master/user" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Created" column="createdAt" pathname="/master/user" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td>
                              <div className="d-flex align-items-center">
                                <span className="fw-medium">{user.name}</span>
                              </div>
                            </td>
                            <td>{user.email}</td>
                            <td>
                              {user.Company?.name ?? <span className="text-secondary">—</span>}
                              {user.Department_User_departmentIdToDepartment && (
                                <div className="fs-7 text-secondary">
                                  {user.Department_User_departmentIdToDepartment.name}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${ROLE_BADGE[user.role]}`}>{ROLE_LABEL[user.role]}</span>
                            </td>
                            <td>
                              <span
                                className={`badge ${user.status === "ACTIVE" ? "text-bg-success" : "text-bg-secondary"}`}
                              >
                                {user.status}
                              </span>
                            </td>
                            <td>{formatDateTime(user.createdAt)}</td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <Link
                                  href={`/master/user/${user.id}/view`}
                                  className="btn btn-outline-secondary"
                                  title="View"
                                  aria-label={`View ${user.name}`}
                                >
                                  <i className="bi bi-eye" aria-hidden="true"></i>
                                </Link>
                                <Link
                                  href={`/master/user/${user.id}/edit`}
                                  className="btn btn-outline-secondary"
                                  title="Edit"
                                  aria-label={`Edit ${user.name}`}
                                >
                                  <i className="bi bi-pencil" aria-hidden="true"></i>
                                </Link>
                                <DeleteButton
                                  action={deleteUser.bind(null, user.id)}
                                  confirmMessage={`Delete user "${user.name}"? This sets their status to Inactive — they won't be able to sign in, but their history is kept. You can reactivate them later via Edit.`}
                                  label={`Delete ${user.name}`}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {users.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center text-secondary py-4">
                              No users found.
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
                      Showing {users.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                      {(currentPage - 1) * pageSize + users.length} of {total} users
                    </div>
                    <PageSizeSelect pageSize={pageSize} />
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    className="pagination pagination-sm m-0"
                    makeHref={(p) => ({
                      pathname: "/master/user",
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
