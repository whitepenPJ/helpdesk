import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../../_components/page-header";
import { UserGroupForm } from "../../user-group-form";

export const metadata: Metadata = { title: "Edit User Group" };

export default async function EditUserGroupPage({ params }: PageProps<"/master/user-group/[id]/edit">) {
  const session = await requireAdmin();

  const { id } = await params;
  // availableUsers is deliberately unfiltered by current membership — the
  // form stages members client-side and itself excludes anyone already
  // staged, so a current member removed (then not yet saved) needs to stay
  // pickable again in the same session rather than being pre-excluded here.
  const [group, members, availableUsers] = await Promise.all([
    prisma.userGroup.findUnique({ where: { id } }),
    prisma.user.findMany({ where: { UserGroupMember: { some: { userGroupId: id } } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  if (!group) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Edit User Group" role={session.user.role} breadcrumbs={[{ label: "User Groups", href: "/master/user-group" }, { label: "Edit" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <UserGroupForm
                mode="edit"
                groupId={group.id}
                initialValues={{ name: group.name, isActive: group.isActive }}
                members={members}
                availableUsers={availableUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
