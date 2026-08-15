import type { Role } from "@/app/generated/prisma/client";

// Where each role lands after login / when it hits a route it doesn't have
// (e.g. a non-admin visiting "/dashboard" directly). No "server-only" here —
// proxy.ts (Node runtime, but its own module graph) and page components both
// need this, and it's a pure function with no DB/auth dependency.
export function getHomePathForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/dashboard";
    case "SUPERVISOR":
      return "/tickets/approval";
    case "USER":
    default:
      return "/tickets";
  }
}
