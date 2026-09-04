import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../_components/page-header";
import { deleteUser } from "@/app/actions/users";
import { ImportUsersButton } from "./import-users-button";
import { ListCard, type ListColumn } from "../../_components/list-card";
import { RowActions } from "../../_components/row-actions";
import { ErrorAlert } from "../../_components/error-alert";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import type { Prisma } from "@/app/generated/prisma/client";
import { Role } from "@/app/generated/prisma/enums";
import { ROLE_LABEL } from "@/app/lib/roles";
import { formatDateTime } from "@/app/lib/date-format";
import { parsePageSize } from "@/app/lib/page-size";

export const metadata: Metadata = { title: "Users" };

const PATHNAME = "/master/user";

const SORT_COLUMNS = ["name", "email", "company", "role", "status", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

const COLUMNS: ListColumn[] = [
  { label: "User", sort: "name" },
  { label: "Email", sort: "email" },
  { label: "Company / Department", sort: "company" },
  { label: "Role", sort: "role" },
  { label: "Status", sort: "status" },
  { label: "Created", sort: "createdAt" },
  { label: "Actions", className: "text-end" },
];

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
  const session = await requireAdmin();

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
  const exportQuery = new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
  }).toString();

  return (
    <>
      <PageHeader title="Users" role={session.user.role} breadcrumbs={[{ label: "Master" }, { label: "Users" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <ErrorAlert message={errorMessage} />

          <div className="row">
            <div className="col-12">
              <ListCard
                pathname={PATHNAME}
                query={query}
                linkQuery={linkQuery}
                searchPlaceholder="Search users"
                submitLabel="Filter"
                submitIcon="bi-funnel"
                filters={
                  <select
                    name="role"
                    defaultValue={roleFilter || "all"}
                    className="form-select form-select-sm w-auto"
                    aria-label="Filter by role"
                  >
                    <option value="all">All roles</option>
                    <option value={Role.ADMIN}>Admin</option>
                    <option value={Role.SUPERVISOR}>Approver</option>
                    <option value={Role.USER}>User</option>
                  </select>
                }
                actions={
                  <>
                    <a
                      href={`/api/master/user/export${exportQuery ? `?${exportQuery}` : ""}`}
                      className="btn btn-sm btn-outline-success"
                    >
                      <i className="bi bi-file-earmark-excel me-1" aria-hidden="true"></i>
                      Export
                    </a>
                    <ImportUsersButton />
                  </>
                }
                newHref={`${PATHNAME}/new`}
                columns={COLUMNS}
                sortBy={sortBy}
                sortDir={sortDir}
                itemCount={users.length}
                total={total}
                currentPage={currentPage}
                pageSize={pageSize}
                totalPages={totalPages}
              >
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
                      <RowActions
                        basePath={PATHNAME}
                        id={user.id}
                        name={user.name}
                        deleteAction={deleteUser.bind(null, user.id)}
                        confirmMessage={`Delete user "${user.name}"? This sets their status to Inactive — they won't be able to sign in, but their history is kept. You can reactivate them later via Edit.`}
                      />
                    </td>
                  </tr>
                ))}
              </ListCard>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
