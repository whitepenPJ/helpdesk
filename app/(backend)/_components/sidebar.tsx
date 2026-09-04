import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { Role } from "@/app/generated/prisma/enums";
import { getTicketMenuCounts } from "@/app/lib/dal";
import { SidebarNav } from "./sidebar-nav";
import { isParent, buildSidebarNav } from "./sidebar-nav-data";

export async function Sidebar() {
  const session = await auth();
  const role = session?.user?.role ?? Role.USER;
  const isAdmin = role === Role.ADMIN;
  const counts = session?.user
    ? await getTicketMenuCounts(session.user.id, role)
    : { ticketCount: 0, assignedCount: 0, approvalCount: 0 };
  const navItems = buildSidebarNav({ role, ...counts }).filter((node) => !(isParent(node) && node.adminOnly && !isAdmin));

  return (
    <aside className="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
      <div className="sidebar-brand">
        <Link href="/dashboard" className="brand-link">
          <Image src="/help-desk.png" alt="" width={33} height={33} className="brand-image opacity-75 shadow" />
          <span className="brand-text fw-light">
            <b>Help</b>desk
          </span>
        </Link>
      </div>

      <div className="sidebar-wrapper">
        <nav className="mt-2" aria-label="Main navigation">
          <SidebarNav items={navItems} />
        </nav>
      </div>
    </aside>
  );
}
