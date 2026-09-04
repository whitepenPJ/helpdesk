import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { excerpt } from "@/app/lib/text";
import { formatDate } from "@/app/lib/date-format";
import type { Prisma } from "@/app/generated/prisma/client";
import { Pagination } from "../_components/pagination";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Lesson Learned" };

const PAGE_SIZE = 10;
const PLACEHOLDER_IMAGE = "/lesson-learned-placeholder.svg";

// Knowledge-base browsing, open to any signed-in role — admins who want the
// full list including inactive entries already have /master/lesson-learned.
// Styled as a blog: one big featured thumbnail per post, byline, excerpt.
export default async function LessonLearnedBrowsePage({ searchParams }: PageProps<"/lesson-learned">) {
  const session = await requireUser();

  const { q, page } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const currentPage = Math.max(1, Number(page) || 1);

  const where: Prisma.LessonLearnedWhereInput = {
    isActive: true,
    ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.lessonLearned.findMany({
      where,
      include: { User: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.lessonLearned.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Lesson Learned" role={session.user.role} />

      <div className="app-content">
        <div className="container-fluid">
          <form method="get" className="d-flex gap-2 mb-4">
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
          </form>

          <div className="row row-cols-1 row-cols-md-2 g-4">
            {entries.map((entry) => (
              <div className="col" key={entry.id}>
                <Link href={`/lesson-learned/${entry.id}`} className="card h-100 text-decoration-none text-reset shadow-sm">
                  <img
                    src={entry.images[0] || PLACEHOLDER_IMAGE}
                    alt=""
                    className="card-img-top"
                    style={{ aspectRatio: "16 / 9", objectFit: "cover" }}
                  />
                  <div className="card-body d-flex flex-column">
                    <div className="text-secondary fs-7 mb-1">
                      <i className="bi bi-calendar-event me-1" aria-hidden="true"></i>
                      {formatDate(entry.createdAt)}
                      <span className="mx-1">·</span>
                      {entry.User.name}
                    </div>
                    <div className="card-title h5 mb-2">{entry.title}</div>
                    <p className="card-text text-secondary flex-grow-1">{excerpt(entry.description, 180)}</p>
                    <span className="fw-medium text-primary">
                      Read more <i className="bi bi-arrow-right" aria-hidden="true"></i>
                    </span>
                  </div>
                </Link>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="col-12">
                <p className="text-secondary text-center py-4 mb-0">No lesson learned entries found.</p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                className="pagination pagination-sm justify-content-center mb-0"
                makeHref={(p) => ({ pathname: "/lesson-learned", query: { ...(query ? { q: query } : {}), page: p } })}
              />
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
