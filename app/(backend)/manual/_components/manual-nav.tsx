"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUDIENCE_LABEL, type ManualAudience, type ManualTopic } from "../manual-content";

type Group = { audience: ManualAudience; topics: ManualTopic[] };

export function ManualNav({ groups }: { groups: Group[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav flex-column" aria-label="User manual">
      <Link
        href="/manual"
        className={`nav-link px-2 py-1 ${pathname === "/manual" ? "active fw-semibold" : "link-body-emphasis"}`}
      >
        <i className="bi bi-house-door me-2" aria-hidden="true" />
        Manual home
      </Link>

      {groups.map((group) => (
        <div key={group.audience} className="mt-3">
          <div className="text-uppercase small fw-semibold text-secondary px-2 mb-1">
            {AUDIENCE_LABEL[group.audience]}
          </div>
          {group.topics.map((topic) => {
            const href = `/manual/${topic.audience}/${topic.slug}`;
            const active = pathname === href;
            return (
              <Link
                key={topic.slug}
                href={href}
                className={`nav-link px-2 py-1 ${active ? "active fw-semibold" : "link-body-emphasis"}`}
                aria-current={active ? "page" : undefined}
              >
                <i className={`bi ${topic.icon} me-2`} aria-hidden="true" />
                {topic.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
