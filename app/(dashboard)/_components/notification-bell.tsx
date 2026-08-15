"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsSeen } from "@/app/actions/notifications";

// Bootstrap's own JS still drives the dropdown open/close via
// data-bs-toggle — this only piggybacks a click handler on the same
// trigger to mark the feed seen and clear the unread badge.
export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleClick() {
    if (unreadCount === 0) return;
    startTransition(async () => {
      await markNotificationsSeen();
      router.refresh();
    });
  }

  return (
    <a
      className="nav-link"
      data-bs-toggle="dropdown"
      href="#"
      aria-label={`Notifications: ${unreadCount} unread`}
      onClick={handleClick}
    >
      <i className="bi bi-bell-fill"></i>
      {unreadCount > 0 && <span className="navbar-badge badge text-bg-warning">{unreadCount}</span>}
    </a>
  );
}
