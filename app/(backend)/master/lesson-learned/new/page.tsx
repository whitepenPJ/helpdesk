import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../_components/page-header";
import { getAttachmentName } from "@/app/lib/attachments";
import { textToSafeHtml } from "@/app/lib/text";
import { LessonLearnedForm } from "../lesson-learned-form";

export const metadata: Metadata = { title: "New Lesson Learned" };

export default async function NewLessonLearnedPage({ searchParams }: PageProps<"/master/lesson-learned/new">) {
  const session = await requireAdmin();

  const { ticketId } = await searchParams;
  const ticket =
    typeof ticketId === "string"
      ? await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { title: true, description: true, problem: true, solution: true, attachments: true },
        })
      : null;

  // Ticket.description is plain text (escaped into <p> tags, same helper
  // used for the assignee's Mark Resolved notes) while problem/solution are
  // already Tiptap-authored HTML — concatenated into one description for
  // the Lesson Learned's own rich-text editor, labeled so the admin can see
  // where each part came from before editing/trimming it.
  const initialValues = ticket
    ? {
        title: ticket.title,
        description: [
          textToSafeHtml(ticket.description),
          ticket.problem ? `<h4>Problem</h4>${ticket.problem}` : "",
          ticket.solution ? `<h4>Solution</h4>${ticket.solution}` : "",
        ]
          .filter(Boolean)
          .join(""),
        isActive: true,
      }
    : undefined;
  const existingAttachments = ticket?.attachments.map((url) => ({ url, name: getAttachmentName(url) }));

  return (
    <>
      <PageHeader title="New Lesson Learned" role={session.user.role} breadcrumbs={[{ label: "Lesson Learned", href: "/master/lesson-learned" }, { label: "New" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <LessonLearnedForm mode="create" initialValues={initialValues} existingAttachments={existingAttachments} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
