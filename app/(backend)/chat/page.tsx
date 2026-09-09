import type { Metadata } from "next";
import { prisma } from "@/app/lib/db";
import { Role } from "@/app/generated/prisma/enums";
import { requireUser } from "@/app/lib/dal";
import { CHAT_ENABLED } from "@/app/lib/feature-flags";
import { ChatPanel } from "./chat-panel";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Ask AI" };

export default async function ChatPage() {
  const session = await requireUser();
  const isAdmin = session.user.role === Role.ADMIN;

  if (!CHAT_ENABLED) {
    return (
      <>
        <PageHeader title="Ask AI" role={session.user.role} />
        <div className="app-content">
          <div className="container-fluid">
            <div className="alert alert-info mb-0" role="alert">
              Ask AI is temporarily unavailable. Please check back later.
            </div>
          </div>
        </div>
      </>
    );
  }

  // Same data tickets/new/page.tsx fetches — needed to pass through to the
  // TicketForm embedded here once the chat's ticket-creation handoff fires.
  const [categories, profile] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { canOpenTicketForOthers: true },
    }),
  ]);

  const canChangeCreator = isAdmin || Boolean(profile?.canOpenTicketForOthers);
  const userSelect = {
    id: true,
    name: true,
    email: true,
    telephone: true,
    Company: { select: { name: true } },
    department: {
      select: {
        name: true,
        DepartmentApprover: { select: { User: { select: { name: true, email: true } } } },
      },
    },
  } as const;
  const users = await (canChangeCreator
    ? prisma.user.findMany({ orderBy: { name: "asc" }, select: userSelect })
    : prisma.user.findMany({ where: { id: session.user.id }, select: userSelect }));

  return (
    <>
      <PageHeader title="Ask AI" role={session.user.role} />

      <div className="app-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12 col-lg-8 mx-auto">
              <ChatPanel
                ticketFormProps={{
                  categories: categories.map((c) => ({ value: c.id, label: c.name })),
                  users: users.map((u) => ({
                    value: u.id,
                    label: `${u.name} (${u.email})`,
                    companyName: u.Company?.name ?? null,
                    departmentName: u.department?.name ?? null,
                    telephone: u.telephone,
                    approvers: (u.department?.DepartmentApprover ?? []).map((a) => a.User),
                  })),
                  defaultCreatorId: session.user.id,
                  canChangeCreator,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
