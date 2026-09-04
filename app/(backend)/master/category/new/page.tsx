import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../_components/page-header";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "New Category" };

export default async function NewCategoryPage() {
  const session = await requireAdmin();

  const [allUsers, allGroups] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.userGroup.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="New Category" role={session.user.role} breadcrumbs={[{ label: "Categories", href: "/master/category" }, { label: "New" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <CategoryForm
                mode="create"
                availableUsers={allUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                availableGroups={allGroups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
