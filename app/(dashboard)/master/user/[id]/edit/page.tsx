import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { UserForm } from "../../user-form";

export const metadata: Metadata = { title: "Edit User" };

export default async function EditUserPage({ params }: PageProps<"/master/user/[id]/edit">) {
  await requireAdmin();

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
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Edit User</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link href="/master/user">Users</Link>
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
