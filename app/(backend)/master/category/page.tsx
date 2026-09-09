import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../_components/page-header";
import { deleteCategory } from "@/app/actions/categories";
import { ListCard, type ListColumn } from "../../_components/list-card";
import { RowActions } from "../../_components/row-actions";
import { ErrorAlert } from "../../_components/error-alert";
import { fetchPage } from "@/app/lib/list-query";
import { parseListParams } from "@/app/lib/list-params";
import type { SortDir } from "@/app/lib/table-sort";
import type { Prisma } from "@/app/generated/prisma/client";

export const metadata: Metadata = { title: "Categories" };

const PATHNAME = "/master/category";

const SORT_COLUMNS = ["name", "isActive", "admins", "tickets", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

const COLUMNS: ListColumn[] = [
  { label: "Name", sort: "name" },
  { label: "Status", sort: "isActive" },
  { label: "Responsible users", sort: "admins" },
  { label: "Tickets", sort: "tickets" },
  { label: "Actions", className: "text-end" },
];

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
  const session = await requireAdmin();

  const params = await searchParams;
  const { query, currentPage, pageSize, sortBy, sortDir, linkQuery } = parseListParams(params, SORT_COLUMNS, {
    column: "createdAt",
    dir: "desc",
  });
  const errorMessage = typeof params.error === "string" ? ERROR_MESSAGES[params.error] : undefined;

  const where: Prisma.CategoryWhereInput = query ? { name: { contains: query, mode: "insensitive" } } : {};

  const { items: categories, total } = await fetchPage(
    () =>
      prisma.category.findMany({
        where,
        include: { _count: { select: { CategoryAdmin: true, Ticket: true } } },
        orderBy: buildOrderBy(sortBy, sortDir),
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
    () => prisma.category.count({ where })
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader title="Categories" role={session.user.role} breadcrumbs={[{ label: "Master" }, { label: "Categories" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <ErrorAlert message={errorMessage} />

          <div className="row">
            <div className="col-12">
              <ListCard
                pathname={PATHNAME}
                query={query}
                linkQuery={linkQuery}
                searchPlaceholder="Search categories"
                newHref={`${PATHNAME}/new`}
                columns={COLUMNS}
                sortBy={sortBy}
                sortDir={sortDir}
                itemCount={categories.length}
                total={total}
                currentPage={currentPage}
                pageSize={pageSize}
                totalPages={totalPages}
              >
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="fw-medium">{category.name}</td>
                    <td>
                      <span className={`badge ${category.isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                        {category.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>{category._count.CategoryAdmin}</td>
                    <td>{category._count.Ticket}</td>
                    <td className="text-end">
                      <RowActions
                        basePath={PATHNAME}
                        id={category.id}
                        name={category.name}
                        deleteAction={deleteCategory.bind(null, category.id)}
                        confirmMessage={`Delete category "${category.name}"? This cannot be undone.`}
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
