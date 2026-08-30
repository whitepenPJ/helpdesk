import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { CompanyForm } from "../../company-form";

export const metadata: Metadata = { title: "Edit Company" };

const ERROR_MESSAGES: Record<string, string> = {
  "department-in-use": "This department still has users assigned — remove them first.",
};

export default async function EditCompanyPage({
  params,
  searchParams,
}: PageProps<"/master/company/[id]/edit">) {
  await requireAdmin();

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
      where: { role: "SUPERVISOR" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!company) {
    notFound();
  }

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Edit Company</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link href="/master/company">Companies</Link>
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
          {errorMessage && (
            <div className="alert alert-danger" role="alert">
              {errorMessage}
            </div>
          )}
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
