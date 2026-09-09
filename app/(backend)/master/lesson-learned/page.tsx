import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../_components/page-header";
import { deleteLessonLearned } from "@/app/actions/lesson-learned";
import { ListCard, type ListColumn } from "../../_components/list-card";
import { RowActions } from "../../_components/row-actions";
import type { SortDir } from "@/app/lib/table-sort";
import { formatDateTime } from "@/app/lib/date-format";
import type { Prisma } from "@/app/generated/prisma/client";
import { fetchPage } from "@/app/lib/list-query";
import { parseListParams } from "@/app/lib/list-params";

export const metadata: Metadata = { title: "Lesson Learned" };

const PATHNAME = "/master/lesson-learned";

const SORT_COLUMNS = ["title", "isActive", "createdAt"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

const COLUMNS: ListColumn[] = [
  { label: "Title", sort: "title" },
  { label: "Status", sort: "isActive" },
  { label: "Created", sort: "createdAt" },
  { label: "Actions", className: "text-end" },
];

function buildOrderBy(sortBy: SortColumn, sortDir: SortDir): Prisma.LessonLearnedOrderByWithRelationInput {
  return { [sortBy]: sortDir };
}

export default async function LessonLearnedAdminPage({ searchParams }: PageProps<"/master/lesson-learned">) {
  const session = await requireAdmin();

  const params = await searchParams;
  const { query, currentPage, pageSize, sortBy, sortDir, linkQuery } = parseListParams(params, SORT_COLUMNS, {
    column: "createdAt",
    dir: "desc",
  });

  const where: Prisma.LessonLearnedWhereInput = query ? { title: { contains: query, mode: "insensitive" } } : {};

  const { items: entries, total } = await fetchPage(
    () =>
      prisma.lessonLearned.findMany({
        where,
        orderBy: buildOrderBy(sortBy, sortDir),
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
    () => prisma.lessonLearned.count({ where })
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader title="Lesson Learned" role={session.user.role} breadcrumbs={[{ label: "Master" }, { label: "Lesson Learned" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <ListCard
                pathname={PATHNAME}
                query={query}
                linkQuery={linkQuery}
                searchPlaceholder="Search lesson learned"
                newHref={`${PATHNAME}/new`}
                columns={COLUMNS}
                sortBy={sortBy}
                sortDir={sortDir}
                itemCount={entries.length}
                total={total}
                currentPage={currentPage}
                pageSize={pageSize}
                totalPages={totalPages}
              >
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
                      <RowActions
                        basePath={PATHNAME}
                        id={entry.id}
                        name={entry.title}
                        deleteAction={deleteLessonLearned.bind(null, entry.id)}
                        confirmMessage={`Delete "${entry.title}"? This cannot be undone.`}
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
