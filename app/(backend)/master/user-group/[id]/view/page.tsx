import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../../_components/page-header";
import { UserGroupForm } from "../../user-group-form";

export const metadata: Metadata = { title: "View User Group" };

export default async function ViewUserGroupPage({ params }: PageProps<"/master/user-group/[id]/view">) {
  const session = await requireAdmin();

  const { id } = await params;
  const [group, members] = await Promise.all([
    prisma.userGroup.findUnique({ where: { id } }),
    prisma.user.findMany({ where: { UserGroupMember: { some: { userGroupId: id } } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  if (!group) {
    notFound();
  }

  return (
    <>
      <PageHeader title="View User Group" role={session.user.role} breadcrumbs={[{ label: "User Groups", href: "/master/user-group" }, { label: "View" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <UserGroupForm
                mode="view"
                groupId={group.id}
                initialValues={{ name: group.name, isActive: group.isActive }}
                members={members}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
