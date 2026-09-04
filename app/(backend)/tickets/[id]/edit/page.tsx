import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { Role } from "@/app/generated/prisma/enums";
import { requireUser } from "@/app/lib/dal";
import { EditTicketForm } from "../edit-ticket-form";
import { PageHeader } from "../../../_components/page-header";

export const metadata: Metadata = { title: "Edit Ticket" };

export default async function EditTicketPage({ params }: PageProps<"/tickets/[id]/edit">) {
  const session = await requireUser();
  const isAdmin = session.user.role === Role.ADMIN;

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    notFound();
  }
  if (ticket.createdById !== session.user.id && !isAdmin) {
    notFound();
  }
  if (ticket.status !== "NEW") {
    redirect(`/tickets/${id}`);
  }

  const [categories, companies, departments] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, companyId: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Edit Ticket"
        role={session.user.role}
        breadcrumbs={[{ label: "Tickets", href: "/tickets" }, { label: "Edit" }]}
      />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <EditTicketForm
                ticketId={ticket.id}
                ticketNumber={ticket.ticketNumber}
                categories={categories.map((c) => ({ value: c.id, label: c.name }))}
                companies={companies.map((c) => ({ value: c.id, label: c.name }))}
                departments={departments.map((d) => ({ value: d.id, label: d.name, companyId: d.companyId }))}
                initialValues={{
                  title: ticket.title,
                  description: ticket.description,
                  categoryId: ticket.categoryId,
                  telephone: ticket.telephone ?? "",
                  companyId: ticket.companyId,
                  departmentId: ticket.departmentId,
                  transactionDate: ticket.transactionDate,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
