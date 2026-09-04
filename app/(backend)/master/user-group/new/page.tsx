import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { PageHeader } from "../../../_components/page-header";
import { UserGroupForm } from "../user-group-form";

export const metadata: Metadata = { title: "New User Group" };

export default async function NewUserGroupPage() {
  const session = await requireAdmin();

  const availableUsers = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <>
      <PageHeader title="New User Group" role={session.user.role} breadcrumbs={[{ label: "User Groups", href: "/master/user-group" }, { label: "New" }]} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <UserGroupForm
                mode="create"
                availableUsers={availableUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
