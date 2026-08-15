import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { deleteUserGroup } from "@/app/actions/user-groups";
import { DeleteButton } from "../../_components/delete-button";
import { SortableTh } from "../../_components/sortable-th";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import type { Prisma } from "@/app/generated/prisma/client";

export const metadata: Metadata = { title: "User Groups" };

const PAGE_SIZE = 10;

const SORT_COLUMNS = ["name", "description", "isActive", "members", "tickets", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.UserGroupOrderByWithRelationInput {
  switch (sortBy) {
    case "members":
      return { User: { _count: sortDir } };
    case "tickets":
      return { Ticket: { _count: sortDir } };
    default:
      return { [sortBy]: sortDir };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  "group-in-use": "This user group still has members or assigned tickets — remove those first.",
};

export default async function UserGroupsPage({ searchParams }: PageProps<"/master/user-group">) {
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

  const where: Prisma.UserGroupWhereInput = query ? { name: { contains: query, mode: "insensitive" } } : {};

  const [groups, total] = await Promise.all([
    prisma.userGroup.findMany({
      where,
      include: { _count: { select: { User: true, Ticket: true } } },
      orderBy: buildOrderBy(sortBy, sortDir),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.userGroup.count({ where }),
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
              <h1 className="mb-0 fs-3">User Groups</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">Master</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    User Groups
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
                            placeholder="Search groups"
                            aria-label="Search groups"
                          />
                        </div>
                        <button type="submit" className="btn btn-sm btn-outline-secondary">
                          Search
                        </button>
                        <Link href="/master/user-group/new" className="btn btn-sm btn-primary">
                          <i className="bi bi-collection me-1" aria-hidden="true"></i>
                          New group
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
                          <SortableTh label="Name" column="name" pathname="/master/user-group" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Description" column="description" pathname="/master/user-group" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Status" column="isActive" pathname="/master/user-group" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Members" column="members" pathname="/master/user-group" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <SortableTh label="Assigned tickets" column="tickets" pathname="/master/user-group" query={linkQuery} sortBy={sortBy} sortDir={sortDir} />
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((group) => (
                          <tr key={group.id}>
                            <td className="fw-medium">{group.name}</td>
                            <td>{group.description ?? <span className="text-secondary">—</span>}</td>
                            <td>
                              <span className={`badge ${group.isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                                {group.isActive ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>
                            <td>{group._count.User}</td>
                            <td>{group._count.Ticket}</td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <Link
                                  href={`/master/user-group/${group.id}/view`}
                                  className="btn btn-outline-secondary"
                                  title="View"
                                  aria-label={`View ${group.name}`}
                                >
                                  <i className="bi bi-eye" aria-hidden="true"></i>
                                </Link>
                                <Link
                                  href={`/master/user-group/${group.id}/edit`}
                                  className="btn btn-outline-secondary"
                                  title="Edit"
                                  aria-label={`Edit ${group.name}`}
                                >
                                  <i className="bi bi-pencil" aria-hidden="true"></i>
                                </Link>
                                <DeleteButton
                                  action={deleteUserGroup.bind(null, group.id)}
                                  confirmMessage={`Delete user group "${group.name}"? This cannot be undone.`}
                                  label={`Delete ${group.name}`}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {groups.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-secondary py-4">
                              No user groups found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer clearfix">
                  <div className="float-start pt-1 fs-7 text-body-secondary">
                    Showing {groups.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
                    {(currentPage - 1) * PAGE_SIZE + groups.length} of {total} groups
                  </div>
                  {totalPages > 1 && (
                    <ul className="pagination pagination-sm m-0 float-end">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                          <Link
                            className="page-link"
                            href={{ pathname: "/master/user-group", query: { ...linkQuery, sort: sortBy, dir: sortDir, page: p } }}
                          >
                            {p}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
