"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isHeader, isParent, type NavNode } from "./sidebar-nav-data";

function collectHrefs(nodes: NavNode[]): string[] {
  const hrefs: string[] = [];
  for (const node of nodes) {
    if (isHeader(node)) continue;
    if (isParent(node)) {
      hrefs.push(...collectHrefs(node.children));
    } else if (node.href) {
      hrefs.push(node.href);
    }
  }
  return hrefs;
}

function matchesPathname(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The active item is the href that matches the current pathname most
// specifically, so e.g. "/tickets/assigned" wins over "/tickets" when both match.
function findActiveHref(pathname: string, items: NavNode[]): string | undefined {
  return collectHrefs(items)
    .filter((href) => matchesPathname(pathname, href))
    .reduce<string | undefined>((best, href) => (!best || href.length > best.length ? href : best), undefined);
}

function NavLink({
  href,
  active,
  children,
}: {
  href?: string;
  active?: boolean;
  children: ReactNode;
}) {
  const className = `nav-link${active ? " active" : ""}`;
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href="#" className={className}>
      {children}
    </a>
  );
}

function NavItem({ node, activeHref }: { node: NavNode; activeHref?: string }) {
  if (isHeader(node)) {
    return <li className="nav-header">{node.header}</li>;
  }

  if (isParent(node)) {
    const hasActiveChild = activeHref !== undefined && collectHrefs(node.children).includes(activeHref);
    return (
      <li className={`nav-item${hasActiveChild ? " menu-open" : ""}`}>
        <a href="#" className={`nav-link${hasActiveChild ? " active" : ""}`}>
          <i className={`nav-icon bi ${node.icon}`}></i>
          <p>
            {node.label}
            {node.badge && <span className="nav-badge badge text-bg-secondary me-3">{node.badge}</span>}
            <i className="nav-arrow bi bi-chevron-right"></i>
          </p>
        </a>
        <ul className="nav nav-treeview">
          {node.children.map((child, i) => (
            <NavItem key={i} node={child} activeHref={activeHref} />
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li className="nav-item">
      <NavLink href={node.href} active={node.href !== undefined && node.href === activeHref}>
        <i className={`nav-icon bi ${node.icon}`}></i>
        <p>
          {node.label}
          {node.badge && <span className="nav-badge badge text-bg-secondary me-3">{node.badge}</span>}
        </p>
      </NavLink>
    </li>
  );
}

export function SidebarNav({ items }: { items: NavNode[] }) {
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname, items);

  return (
    <ul className="nav sidebar-menu flex-column" data-lte-toggle="treeview" data-accordion="false" id="navigation">
      {items.map((node, i) => (
        <NavItem key={i} node={node} activeHref={activeHref} />
      ))}
    </ul>
  );
}
