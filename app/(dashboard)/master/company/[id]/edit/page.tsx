import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { CompanyForm } from "../../company-form";

export const metadata: Metadata = { title: "Edit Company" };

export default async function EditCompanyPage({ params }: PageProps<"/master/company/[id]/edit">) {
  await requireAdmin();

  const { id } = await params;
  const [company, departments, freeSupervisors, allSupervisors] = await Promise.all([
    prisma.company.findUnique({ where: { id } }),
    prisma.department.findMany({
      where: { companyId: id },
      orderBy: { name: "asc" },
      include: { User_Department_supervisorIdToUser: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { role: "SUPERVISOR", Department_Department_supervisorIdToUser: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Broader than freeSupervisors — includes every supervisor regardless of
    // current assignment, plus which department (if any) they currently
    // supervise, so each row's "edit supervisor" picker can offer its own
    // current supervisor too (who's excluded from freeSupervisors precisely
    // because they're not "free").
    prisma.user.findMany({
      where: { role: "SUPERVISOR" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, Department_Department_supervisorIdToUser: { select: { id: true } } },
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
          <div className="row">
            <div className="col-12">
              <CompanyForm
                mode="edit"
                companyId={company.id}
                initialValues={{
                  name: company.name,
                  isActive: company.isActive,
                }}
                departments={departments.map((d) => ({
                  id: d.id,
                  name: d.name,
                  supervisorId: d.supervisorId,
                  supervisorName: d.User_Department_supervisorIdToUser?.name ?? null,
                  availableSupervisors: allSupervisors
                    .filter(
                      (s) =>
                        !s.Department_Department_supervisorIdToUser ||
                        s.Department_Department_supervisorIdToUser.id === d.id
                    )
                    .map((s) => ({ value: s.id, label: s.name })),
                }))}
                supervisors={freeSupervisors.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
