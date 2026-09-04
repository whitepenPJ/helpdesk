import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../../_components/page-header";
import { CategoryForm } from "../../category-form";

export const metadata: Metadata = { title: "View Category" };

export default async function ViewCategoryPage({ params }: PageProps<"/master/category/[id]/view">) {
  const session = await requireAdmin();

  const { id } = await params;
  const [category, admins, groups] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    prisma.categoryAdmin.findMany({
      where: { categoryId: id },
      include: { User: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.categoryUserGroup.findMany({
      where: { categoryId: id },
      include: { UserGroup: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <>
      <PageHeader title="View Category" role={session.user.role} breadcrumbs={[{ label: "Categories", href: "/master/category" }, { label: "View" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <CategoryForm
                mode="view"
                categoryId={category.id}
                initialValues={{ name: category.name, isActive: category.isActive }}
                responsibleUsers={admins.map((a) => a.User)}
                responsibleGroups={groups.map((g) => g.UserGroup)}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
