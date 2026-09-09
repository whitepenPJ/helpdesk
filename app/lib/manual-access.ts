import { Role } from "@/app/generated/prisma/enums";
import type { ManualAudience } from "@/app/(backend)/manual/manual-content";

// Which manual audiences a role may read. Cumulative: an approver also does
// everything a requester does, and an admin sees everything. The manual
// pages re-check this server-side — it is a real access boundary, not just
// a nav filter.
export function audiencesForRole(role: Role): ManualAudience[] {
  switch (role) {
    case Role.ADMIN:
      return ["user", "approver", "admin"];
    case Role.SUPERVISOR:
      return ["user", "approver"];
    case Role.USER:
    default:
      return ["user"];
  }
}
