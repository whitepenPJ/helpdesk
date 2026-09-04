import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../_components/page-header";
import { deleteLessonLearned } from "@/app/actions/lesson-learned";
import { ListCard, type ListColumn } from "../../_components/list-card";
import { RowActions } from "../../_components/row-actions";
import { parseSort, type SortDir } from "@/app/lib/table-sort";
import { formatDateTime } from "@/app/lib/date-format";
import type { Prisma } from "@/app/generated/prisma/client";
import { parsePageSize } from "@/app/lib/page-size";

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
