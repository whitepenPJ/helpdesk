import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { CHAT_ENABLED } from "@/app/lib/feature-flags";
import { ChatPanel } from "./chat-panel";

export const metadata: Metadata = { title: "Ask AI" };

export default async function ChatPage() {
  const session = await requireUser();
  const isAdmin = session.user.role === "ADMIN";

  if (!CHAT_ENABLED) {
    return (
      <>
        <div className="app-content-header">
          <div className="container-fluid">
            <div className="row">
              <div className="col-sm-6">
                <h1 className="mb-0 fs-3">Ask AI</h1>
              </div>
              <div className="col-sm-6">
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb float-sm-end">
                    <li className="breadcrumb-item">
                      <Link href="/dashboard">Home</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Ask AI
                    </li>
                  </ol>
                </nav>
              </div>
            </div>
          </div>
        </div>
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
  const [categories, companies, departments, profile, users] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, companyId: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { companyId: true, departmentId: true } }),
    isAdmin
      ? prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } })
      : prisma.user.findMany({ where: { id: session.user.id }, select: { id: true, name: true, email: true } }),
  ]);

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6">
              <h1 className="mb-0 fs-3">Ask AI</h1>
            </div>
            <div className="col-sm-6">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb float-sm-end">
                  <li className="breadcrumb-item">
                    <Link href="/dashboard">Home</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Ask AI
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
            <div className="col-12 col-lg-8 mx-auto">
              <ChatPanel
                ticketFormProps={{
                  categories: categories.map((c) => ({ value: c.id, label: c.name })),
                  companies: companies.map((c) => ({ value: c.id, label: c.name })),
                  departments: departments.map((d) => ({ value: d.id, label: d.name, companyId: d.companyId })),
                  users: users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
                  defaultCompanyId: profile?.companyId ?? undefined,
                  defaultDepartmentId: profile?.departmentId ?? undefined,
                  defaultCreatorId: session.user.id,
                  canChangeCreator: isAdmin,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
