import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../_components/page-header";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "New User" };

export default async function NewUserPage() {
  const session = await requireAdmin();

  const [companies, departments] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, companyId: true } }),
  ]);

  return (
    <>
      <PageHeader title="New User" role={session.user.role} breadcrumbs={[{ label: "Users", href: "/master/user" }, { label: "New" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <UserForm
                mode="create"
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
