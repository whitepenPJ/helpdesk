import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { Role } from "@/app/generated/prisma/enums";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../../_components/page-header";
import { ErrorAlert } from "../../../../_components/error-alert";
import { CompanyForm } from "../../company-form";

export const metadata: Metadata = { title: "Edit Company" };

const ERROR_MESSAGES: Record<string, string> = {
  "department-in-use": "This department still has users assigned — remove them first.",
};

export default async function EditCompanyPage({
  params,
  searchParams,
}: PageProps<"/master/company/[id]/edit">) {
  const session = await requireAdmin();

  const { id } = await params;
  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? ERROR_MESSAGES[error] : undefined;
  const [company, departments, supervisors] = await Promise.all([
    prisma.company.findUnique({ where: { id } }),
    prisma.department.findMany({
      where: { companyId: id },
      orderBy: { name: "asc" },
      include: { DepartmentApprover: { select: { userId: true, User: { select: { name: true } } } } },
    }),
    // A supervisor can now approve for more than one department, so every
    // department's picker offers the same full list — no more "free vs.
    // already assigned" split.
    prisma.user.findMany({
      where: { role: Role.SUPERVISOR },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!company) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Edit Company" role={session.user.role} breadcrumbs={[{ label: "Companies", href: "/master/company" }, { label: "Edit" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <ErrorAlert message={errorMessage} />
          <div className="row">
            <div className="col-12">
              <CompanyForm
                mode="edit"
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
                  approverIds: d.DepartmentApprover.map((a) => a.userId),
                  approverNames: d.DepartmentApprover.map((a) => a.User.name),
                }))}
                supervisors={supervisors.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
