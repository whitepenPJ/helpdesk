import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { getAttachmentName } from "@/app/lib/attachments";
import { LessonLearnedForm } from "../../lesson-learned-form";

export const metadata: Metadata = { title: "View Lesson Learned" };

export default async function ViewLessonLearnedPage({ params }: PageProps<"/master/lesson-learned/[id]/view">) {
  await requireAdmin();

  const { id } = await params;
  const entry = await prisma.lessonLearned.findUnique({ where: { id } });

  if (!entry) {
    notFound();
  }

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">View Lesson Learned</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link href="/master/lesson-learned">Lesson Learned</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    View
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <LessonLearnedForm
                mode="view"
                entryId={entry.id}
                initialValues={{ title: entry.title, description: entry.description, isActive: entry.isActive }}
                existingImages={entry.images.map((url) => ({ url, name: getAttachmentName(url) }))}
                existingAttachments={entry.attachments.map((url) => ({ url, name: getAttachmentName(url) }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
