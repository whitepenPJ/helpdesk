import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../../_components/page-header";
import { UserForm } from "../../user-form";

export const metadata: Metadata = { title: "Edit User" };

export default async function EditUserPage({ params }: PageProps<"/master/user/[id]/edit">) {
  const session = await requireAdmin();

  const { id } = await params;

  const [user, companies, departments] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, companyId: true } }),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Edit User" role={session.user.role} breadcrumbs={[{ label: "Users", href: "/master/user" }, { label: "Edit" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <UserForm
                mode="edit"
                userId={user.id}
                initialValues={{
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  status: user.status === "SUSPENDED" ? "INACTIVE" : user.status,
                  companyId: user.companyId ?? "",
                  departmentId: user.departmentId ?? "",
                  canOpenTicketForOthers: user.canOpenTicketForOthers,
                }}
                companies={companies.map((c) => ({ value: c.id, label: c.name }))}
                departments={departments.map((d) => ({ value: d.id, label: d.name, companyId: d.companyId }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
