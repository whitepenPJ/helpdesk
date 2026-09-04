import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { Role } from "@/app/generated/prisma/enums";
import { requireUser } from "@/app/lib/dal";
import { TicketForm } from "../ticket-form";
import { PageHeader } from "../../_components/page-header";

export const metadata: Metadata = { title: "New Ticket" };

export default async function NewTicketPage() {
  const session = await requireUser();

  const isAdmin = session.user.role === Role.ADMIN;

  const [categories, profile] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { status: true, canOpenTicketForOthers: true },
    }),
  ]);

  const breadcrumb = (
    <PageHeader
      title="New Ticket"
      role={session.user.role}
      breadcrumbs={[{ label: "Tickets", href: "/tickets" }, { label: "New" }]}
    />
  );

  // A brand-new Microsoft Entra ID sign-in with no admin-configured profile
  // yet (see auth.ts) — can browse but can't file a ticket until an admin
  // sets their company/department and moves them off PENDING.
  if (profile?.status === "PENDING") {
    return (
      <>
        {breadcrumb}
        <div className="app-content">
          <div className="container-fluid">
            <div className="alert alert-warning" role="alert">
              Your account is waiting on an admin to set up your company and department. You&apos;ll be able to
              open tickets once that&apos;s done.
            </div>
          </div>
        </div>
      </>
    );
  }

  // Admin, or a user whose Master User "Options" grants it, can pick anyone
  // as the Creator — everyone else's copy is locked to just their own name
  // (still needs an option for it, or the read-only field would render blank).
  const canChangeCreator = isAdmin || Boolean(profile?.canOpenTicketForOthers);
  const users = await (canChangeCreator
    ? prisma.user.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          telephone: true,
          Company: { select: { name: true } },
          Department_User_departmentIdToDepartment: {
            select: {
              name: true,
              DepartmentApprover: { select: { User: { select: { name: true, email: true } } } },
            },
          },
        },
      })
    : prisma.user.findMany({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          telephone: true,
          Company: { select: { name: true } },
          Department_User_departmentIdToDepartment: {
            select: {
              name: true,
              DepartmentApprover: { select: { User: { select: { name: true, email: true } } } },
            },
          },
        },
      }));

  return (
    <>
      {breadcrumb}

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <TicketForm
                categories={categories.map((c) => ({ value: c.id, label: c.name }))}
                users={users.map((u) => ({
                  value: u.id,
                  label: `${u.name} (${u.email})`,
                  companyName: u.Company?.name ?? null,
                  departmentName: u.Department_User_departmentIdToDepartment?.name ?? null,
                  telephone: u.telephone,
                  approvers: (u.Department_User_departmentIdToDepartment?.DepartmentApprover ?? []).map((a) => a.User),
                }))}
                defaultCreatorId={session.user.id}
                canChangeCreator={canChangeCreator}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
