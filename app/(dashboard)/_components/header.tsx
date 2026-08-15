import type { CSSProperties } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/app/actions/auth";
import { getRecentTicketActivity, type TicketActivityItem } from "@/app/lib/notifications";
import { NotificationBell } from "./notification-bell";
import { NotificationSubscribe } from "./notification-subscribe";
import { NotificationPoller } from "./notification-poller";

function formatRelativeTime(date: Date): string {
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"}`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

function NotificationItem({ item }: { item: TicketActivityItem }) {
  return (
    <Link href={`/tickets/${item.ticketId}`} className="dropdown-item">
      <i className="bi bi-ticket-perforated me-2" aria-hidden="true"></i>
      <span className="fw-medium">{item.ticketNumber}</span> {item.action}
      {item.previousState && item.newState && (
        <span className="text-secondary">
          {" "}
          ({item.previousState} → {item.newState})
        </span>
      )}
      <span className="float-end text-secondary fs-7">{formatRelativeTime(item.timestamp)}</span>
    </Link>
  );
}

export async function Header() {
  const session = await auth();
  const user = session?.user;
  const displayName = user?.name ?? user?.email ?? "Account";
  const { items: notifications, unreadCount } = user
    ? await getRecentTicketActivity(user.id, user.role)
    : { items: [], unreadCount: 0 };

  return (
    <nav className="app-header navbar navbar-expand bg-body">
      <div className="container-fluid">
        <ul className="navbar-nav">
          <li className="nav-item">
            <a
              className="nav-link"
              data-lte-toggle="sidebar"
              href="#"
              role="button"
              aria-label="Toggle sidebar"
            >
              <i className="bi bi-list"></i>
            </a>
          </li>
        </ul>

        <form className="navbar-search d-none d-md-block w-100 ms-3" role="search">
          <div className="input-group input-group-sm">
            <label htmlFor="navbar-search-input" className="visually-hidden">
              Search
            </label>
            <input
              type="search"
              id="navbar-search-input"
              name="q"
              className="form-control"
              placeholder="Search…"
            />
            <button className="btn btn-outline-secondary" type="submit" aria-label="Submit search">
              <i className="bi bi-search" aria-hidden="true"></i>
            </button>
          </div>
        </form>

        <ul className="navbar-nav ms-auto">
          <li className="nav-item dropdown">
            <NotificationBell unreadCount={unreadCount} />
            <div className="dropdown-menu dropdown-menu-lg dropdown-menu-end">
              <span className="dropdown-item dropdown-header">
                {unreadCount > 0
                  ? `${unreadCount} New Update${unreadCount === 1 ? "" : "s"}`
                  : notifications.length > 0
                    ? "Recent Updates"
                    : "No recent activity"}
              </span>
              <div className="dropdown-divider"></div>
              <NotificationSubscribe />
              {notifications.length > 0 && (
                <>
                  <div className="dropdown-divider"></div>
                  {notifications.map((item) => (
                    <NotificationItem key={item.id} item={item} />
                  ))}
                </>
              )}
              <div className="dropdown-divider"></div>
              <Link href="/notifications" className="dropdown-item dropdown-footer">
                See All Notifications
              </Link>
            </div>
          </li>

          <li className="nav-item">
            <a className="nav-link" href="#" data-lte-toggle="fullscreen" aria-label="Toggle fullscreen">
              <i data-lte-icon="maximize" className="bi bi-arrows-fullscreen"></i>
              <i data-lte-icon="minimize" className="bi bi-fullscreen-exit d-none"></i>
            </a>
          </li>

          <li className="nav-item dropdown">
            <a
              className="nav-link"
              href="#"
              id="bd-theme"
              aria-label="Toggle color scheme"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="bi bi-sun-fill" data-lte-theme-icon="light"></i>
              <i className="bi bi-moon-fill d-none" data-lte-theme-icon="dark"></i>
              <i className="bi bi-circle-half d-none" data-lte-theme-icon="auto"></i>
            </a>
            <ul
              className="dropdown-menu dropdown-menu-end"
              aria-labelledby="bd-theme"
              style={{ "--bs-dropdown-min-width": "8rem" } as CSSProperties}
            >
              <li>
                <button
                  type="button"
                  className="dropdown-item d-flex align-items-center"
                  data-bs-theme-value="light"
                  aria-pressed="false"
                >
                  <i className="bi bi-sun-fill me-2"></i>
                  Light
                  <i className="bi bi-check-lg ms-auto d-none"></i>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="dropdown-item d-flex align-items-center"
                  data-bs-theme-value="dark"
                  aria-pressed="false"
                >
                  <i className="bi bi-moon-fill me-2"></i>
                  Dark
                  <i className="bi bi-check-lg ms-auto d-none"></i>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="dropdown-item d-flex align-items-center active"
                  data-bs-theme-value="auto"
                  aria-pressed="true"
                >
                  <i className="bi bi-circle-half me-2"></i>
                  Auto
                  <i className="bi bi-check-lg ms-auto d-none"></i>
                </button>
              </li>
            </ul>
          </li>

          <li className="nav-item dropdown user-menu">
            <a href="#" className="nav-link dropdown-toggle" data-bs-toggle="dropdown">
              <i className="bi bi-person-circle" aria-hidden="true"></i>
              <span className="d-none d-md-inline ms-1">{displayName}</span>
            </a>
            <ul className="dropdown-menu dropdown-menu-lg dropdown-menu-end">
              <li className="user-header text-bg-primary">
                <i className="bi bi-person-circle" style={{ fontSize: "5.5rem" }} aria-hidden="true"></i>
                <p>
                  {displayName}
                  <small>{user?.role ? `Role: ${user.role}` : user?.email}</small>
                </p>
              </li>
              <li className="user-footer">
                <Link href="/profile" className="btn btn-outline-secondary">
                  Profile
                </Link>
                <form action={logout} className="float-end">
                  <button type="submit" className="btn btn-outline-danger">
                    Sign out
                  </button>
                </form>
              </li>
            </ul>
          </li>
        </ul>
      </div>
      {user?.role === "ADMIN" && <NotificationPoller initialUnreadCount={unreadCount} />}
    </nav>
  );
}
