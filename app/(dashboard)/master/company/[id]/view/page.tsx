import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { CompanyForm } from "../../company-form";

export const metadata: Metadata = { title: "View Company" };

export default async function ViewCompanyPage({ params }: PageProps<"/master/company/[id]/view">) {
  await requireAdmin();

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
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">View Company</h1>
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
