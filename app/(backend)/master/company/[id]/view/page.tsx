import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../../_components/page-header";
import { CompanyForm } from "../../company-form";

export const metadata: Metadata = { title: "View Company" };

export default async function ViewCompanyPage({ params }: PageProps<"/master/company/[id]/view">) {
  const session = await requireAdmin();

  const { id } = await params;
  const [company, departments] = await Promise.all([
    prisma.company.findUnique({ where: { id } }),
    prisma.department.findMany({
      where: { companyId: id },
      orderBy: { name: "asc" },
      include: { DepartmentApprover: { select: { User: { select: { name: true } } } } },
    }),
  ]);

  if (!company) {
    notFound();
  }

  return (
    <>
      <PageHeader title="View Company" role={session.user.role} breadcrumbs={[{ label: "Companies", href: "/master/company" }, { label: "View" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <CompanyForm
                mode="view"
                companyId={company.id}
                initialValues={{
                  name: company.name,
                  code: company.code,
                  isActive: company.isActive,
                }}
                departments={departments.map((d) => ({
                  id: d.id,
                  name: d.name,
                  code: d.code,
                  approverNames: d.DepartmentApprover.map((a) => a.User.name),
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
