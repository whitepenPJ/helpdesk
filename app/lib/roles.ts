import { Role } from "@/app/generated/prisma/enums";

// Where each role lands after login / when it hits a route it doesn't have
// (e.g. a non-admin visiting "/dashboard" directly). No "server-only" here —
// proxy.ts (Node runtime, but its own module graph) and page components both
// need this, and it's a pure function with no DB/auth dependency.
export function getHomePathForRole(role: Role): string {
  switch (role) {
    case Role.ADMIN:
      return "/dashboard";
    case Role.SUPERVISOR:
      return "/tickets/approval";
    case Role.USER:
    default:
      return "/tickets";
  }
}

// Display label for a Role — "Approver" everywhere in the UI, though the
// underlying enum value stays SUPERVISOR (renaming the enum would mean a
// schema migration touching every existing User row's stored role; this is
// a wording-only change).
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  SUPERVISOR: "Approver",
  USER: "User",
};
