import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { CategoryForm } from "../../category-form";

export const metadata: Metadata = { title: "Edit Category" };

export default async function EditCategoryPage({ params }: PageProps<"/master/category/[id]/edit">) {
  await requireAdmin();

  const { id } = await params;
  const [category, admins, allUsers, groups, allGroups] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    prisma.categoryAdmin.findMany({
      where: { categoryId: id },
      include: { User: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.categoryUserGroup.findMany({
      where: { categoryId: id },
      include: { UserGroup: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userGroup.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Edit Category</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link href="/master/category">Categories</Link>
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
              <CategoryForm
                mode="edit"
                categoryId={category.id}
                initialValues={{ name: category.name, isActive: category.isActive }}
                responsibleUsers={admins.map((a) => a.User)}
                availableUsers={allUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                responsibleGroups={groups.map((g) => g.UserGroup)}
                availableGroups={allGroups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
