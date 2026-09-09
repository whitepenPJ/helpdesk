import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../_components/page-header";
import { deleteUserGroup } from "@/app/actions/user-groups";
import { ListCard, type ListColumn } from "../../_components/list-card";
import { RowActions } from "../../_components/row-actions";
import { ErrorAlert } from "../../_components/error-alert";
import type { SortDir } from "@/app/lib/table-sort";
import type { Prisma } from "@/app/generated/prisma/client";
import { fetchPage } from "@/app/lib/list-query";
import { parseListParams } from "@/app/lib/list-params";

export const metadata: Metadata = { title: "User Groups" };

const PATHNAME = "/master/user-group";

const SORT_COLUMNS = ["name", "description", "isActive", "members", "tickets", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

const COLUMNS: ListColumn[] = [
  { label: "Name", sort: "name" },
  { label: "Description", sort: "description" },
  { label: "Status", sort: "isActive" },
  { label: "Members", sort: "members" },
  { label: "Assigned tickets", sort: "tickets" },
  { label: "Actions", className: "text-end" },
];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.UserGroupOrderByWithRelationInput {
  switch (sortBy) {
    case "members":
      return { UserGroupMember: { _count: sortDir } };
    case "tickets":
      return { TicketAssignedGroup: { _count: sortDir } };
    default:
      return { [sortBy]: sortDir };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  "group-in-use": "This user group still has members or assigned tickets — remove those first.",
};

export default async function UserGroupsPage({ searchParams }: PageProps<"/master/user-group">) {
  const session = await requireAdmin();

  const params = await searchParams;
  const { query, currentPage, pageSize, sortBy, sortDir, linkQuery } = parseListParams(params, SORT_COLUMNS, {
    column: "createdAt",
    dir: "desc",
  });
  const errorMessage = typeof params.error === "string" ? ERROR_MESSAGES[params.error] : undefined;

  const where: Prisma.UserGroupWhereInput = query ? { name: { contains: query, mode: "insensitive" } } : {};

  const { items: groups, total } = await fetchPage(
    () =>
      prisma.userGroup.findMany({
        where,
        include: { _count: { select: { UserGroupMember: true, TicketAssignedGroup: true } } },
        orderBy: buildOrderBy(sortBy, sortDir),
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
    () => prisma.userGroup.count({ where })
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader title="User Groups" role={session.user.role} breadcrumbs={[{ label: "Master" }, { label: "User Groups" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <ErrorAlert message={errorMessage} />

          <div className="row">
            <div className="col-12">
              <ListCard
                pathname={PATHNAME}
                query={query}
                linkQuery={linkQuery}
                searchPlaceholder="Search groups"
                newHref={`${PATHNAME}/new`}
                columns={COLUMNS}
                sortBy={sortBy}
                sortDir={sortDir}
                itemCount={groups.length}
                total={total}
                currentPage={currentPage}
                pageSize={pageSize}
                totalPages={totalPages}
              >
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td className="fw-medium">{group.name}</td>
                    <td>{group.description ?? <span className="text-secondary">—</span>}</td>
                    <td>
                      <span className={`badge ${group.isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                        {group.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>{group._count.UserGroupMember}</td>
                    <td>{group._count.TicketAssignedGroup}</td>
                    <td className="text-end">
                      <RowActions
                        basePath={PATHNAME}
                        id={group.id}
                        name={group.name}
                        deleteAction={deleteUserGroup.bind(null, group.id)}
                        confirmMessage={`Delete user group "${group.name}"? This cannot be undone.`}
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
