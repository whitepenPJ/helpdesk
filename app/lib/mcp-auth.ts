import "server-only";
import { prisma } from "@/app/lib/db";
import { hashApiToken } from "@/app/lib/api-tokens";
import type { Role } from "@/app/generated/prisma/client";

export type McpAuthedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  departmentId: string | null;
  telephone: string | null;
};

// MCP clients have no browser session to read a cookie from — they
// authenticate with a personal access token (Profile > API Tokens) sent as
// `Authorization: Bearer <token>`, resolved here to the same user identity
// every other authorization check in the app already keys off.
export async function authenticateMcpRequest(request: Request): Promise<McpAuthedUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiToken(token) },
    select: {
      id: true,
      User: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          companyId: true,
          departmentId: true,
          telephone: true,
        },
      },
    },
  });

  if (!apiToken || apiToken.User.status !== "ACTIVE") return null;

  // Bookkeeping only — never let a failure here block the actual request.
  prisma.apiToken
    .update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
    .catch((error) => console.error("authenticateMcpRequest: failed to update lastUsedAt", error));

  const { User } = apiToken;
  return {
    id: User.id,
    name: User.name,
    email: User.email,
    role: User.role,
    companyId: User.companyId,
    departmentId: User.departmentId,
    telephone: User.telephone,
  };
}
