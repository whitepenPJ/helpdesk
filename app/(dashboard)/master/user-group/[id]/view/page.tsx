import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { UserGroupForm } from "../../user-group-form";

export const metadata: Metadata = { title: "View User Group" };

export default async function ViewUserGroupPage({ params }: PageProps<"/master/user-group/[id]/view">) {
  await requireAdmin();

  const { id } = await params;
  const [group, members] = await Promise.all([
    prisma.userGroup.findUnique({ where: { id } }),
    prisma.user.findMany({ where: { userGroupId: id }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  if (!group) {
    notFound();
  }

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">View User Group</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link href="/master/user-group">User Groups</Link>
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
