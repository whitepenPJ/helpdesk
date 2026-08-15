import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { excerpt } from "@/app/lib/text";
import type { Prisma } from "@/app/generated/prisma/client";

export const metadata: Metadata = { title: "Lesson Learned" };

const PAGE_SIZE = 12;

// Knowledge-base browsing, open to any signed-in role — admins who want the
// full list including inactive entries already have /master/lesson-learned.
export default async function LessonLearnedBrowsePage({ searchParams }: PageProps<"/lesson-learned">) {
  await requireUser();

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
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.lessonLearned.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Lesson Learned</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Lesson Learned
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          <form method="get" className="d-flex gap-2 mb-3">
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
              Search
            </button>
          </form>

          <div className="row row-cols-1 row-cols-md-3 g-3">
            {entries.map((entry) => (
              <div className="col" key={entry.id}>
                <Link href={`/lesson-learned/${entry.id}`} className="card h-100 text-decoration-none text-reset">
                  {entry.images[0] ? (
                    <img src={entry.images[0]} alt="" className="card-img-top" style={{ height: 160, objectFit: "cover" }} />
                  ) : (
                    <div
                      className="card-img-top d-flex align-items-center justify-content-center bg-body-secondary"
                      style={{ height: 160 }}
                    >
                      <i className="bi bi-lightbulb fs-1 text-secondary" aria-hidden="true"></i>
                    </div>
                  )}
                  <div className="card-body">
                    <div className="card-title fw-medium">{entry.title}</div>
                    <p className="card-text text-secondary fs-7 mb-0">{excerpt(entry.description, 160)}</p>
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
            <nav aria-label="Pagination" className="mt-3">
              <ul className="pagination pagination-sm justify-content-center mb-0">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                    <Link
                      className="page-link"
                      href={{ pathname: "/lesson-learned", query: { ...(query ? { q: query } : {}), page: p } }}
                    >
                      {p}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
