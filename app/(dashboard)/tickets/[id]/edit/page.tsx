import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { EditTicketForm } from "../edit-ticket-form";

export const metadata: Metadata = { title: "Edit Ticket" };

export default async function EditTicketPage({ params }: PageProps<"/tickets/[id]/edit">) {
  const session = await requireUser();
  const isAdmin = session.user.role === "ADMIN";

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
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Edit Ticket</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link href="/tickets">Tickets</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Edit
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
              <EditTicketForm
                ticketId={ticket.id}
                ticketNumber={ticket.ticketNumber}
                createdAt={ticket.createdAt}
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
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
