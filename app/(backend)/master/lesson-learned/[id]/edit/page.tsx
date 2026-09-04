import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../../_components/page-header";
import { getAttachmentName } from "@/app/lib/attachments";
import { LessonLearnedForm } from "../../lesson-learned-form";

export const metadata: Metadata = { title: "Edit Lesson Learned" };

export default async function EditLessonLearnedPage({ params }: PageProps<"/master/lesson-learned/[id]/edit">) {
  const session = await requireAdmin();

  const { id } = await params;
  const entry = await prisma.lessonLearned.findUnique({ where: { id } });

  if (!entry) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Edit Lesson Learned" role={session.user.role} breadcrumbs={[{ label: "Lesson Learned", href: "/master/lesson-learned" }, { label: "Edit" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <LessonLearnedForm
                mode="edit"
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
