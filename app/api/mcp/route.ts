import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import * as z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { prisma } from "@/app/lib/db";
import { authenticateMcpRequest, type McpAuthedUser } from "@/app/lib/mcp-auth";
import { excerpt } from "@/app/lib/text";
import { generateTicketNumber } from "@/app/actions/tickets";
import { STATUSES } from "@/app/(dashboard)/tickets/ticket-badges";
import type { TicketStatus } from "@/app/generated/prisma/client";

// Remote HTTP MCP server (stateless mode — a fresh McpServer/transport pair
// per request, no session/connection state kept between calls, since a
// serverless invocation can't assume the next request lands on the same
// instance anyway). Exposes exactly three tools: search the Lesson Learned
// knowledge base, create a ticket, and list tickets by status — each one
// enforcing the same authorization the web app already does for the
// token's owner (admin sees everything, everyone else sees their own).
function buildServer(user: McpAuthedUser): McpServer {
  const server = new McpServer({ name: "helpdesk-mcp", version: "1.0.0" });

  server.registerTool(
    "search_lesson_learned",
    {
      title: "Search Lesson Learned",
      description:
        "Search the helpdesk's Lesson Learned knowledge base by keyword. Returns matching titles, short summaries, and a link to each entry.",
      inputSchema: { query: z.string().min(1).describe("Keyword or phrase to search for") },
    },
    async ({ query }) => {
      const entries = await prisma.lessonLearned.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, description: true },
      });

      if (entries.length === 0) {
        return { content: [{ type: "text" as const, text: `No Lesson Learned entries found matching "${query}".` }] };
      }

      const lines = entries.map(
        (e) => `- ${e.title} (id: ${e.id})\n  ${excerpt(e.description, 200)}\n  Link: /lesson-learned/${e.id}`
      );
      return { content: [{ type: "text" as const, text: lines.join("\n\n") }] };
    }
  );

  server.registerTool(
    "create_ticket",
    {
      title: "Create Ticket",
      description:
        "Create a new support ticket on behalf of the authenticated user. Category is matched by name (case-insensitive) against the helpdesk's active categories. Company/department come from the user's own profile; telephone defaults to the profile's telephone if not given.",
      inputSchema: {
        title: z.string().min(1).describe("Short ticket title"),
        description: z.string().min(1).describe("Full description of the problem"),
        category: z.string().min(1).describe("Category name — case-insensitive match against active categories"),
        telephone: z
          .string()
          .optional()
          .describe("Contact telephone number — defaults to the user's profile telephone if omitted"),
      },
    },
    async ({ title, description, category, telephone }) => {
      if (!user.companyId || !user.departmentId) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "This account has no company/department set on its helpdesk profile — add those at /profile before creating a ticket this way.",
            },
          ],
        };
      }

      const resolvedTelephone = telephone?.trim() || user.telephone;
      if (!resolvedTelephone) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: "No telephone number available — pass one, or set it on your profile." },
          ],
        };
      }

      const matchedCategory = await prisma.category.findFirst({
        where: { isActive: true, name: { equals: category, mode: "insensitive" } },
      });
      if (!matchedCategory) {
        const active = await prisma.category.findMany({
          where: { isActive: true },
          select: { name: true },
          orderBy: { name: "asc" },
        });
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `No active category named "${category}". Available categories: ${active.map((c) => c.name).join(", ")}`,
            },
          ],
        };
      }

      const ticketId = randomUUID();
      const ticketNumber = await generateTicketNumber();
      await prisma.ticket.create({
        data: {
          id: ticketId,
          ticketNumber,
          title: title.trim(),
          description: description.trim(),
          categoryId: matchedCategory.id,
          companyId: user.companyId,
          departmentId: user.departmentId,
          telephone: resolvedTelephone,
          attachments: [],
          createdById: user.id,
          updatedAt: new Date(),
        },
      });
      await prisma.ticketHistory.create({
        data: { id: randomUUID(), ticketId, actorId: user.id, action: "Ticket created", newState: "NEW" },
      });

      return {
        content: [
          { type: "text" as const, text: `Created ticket ${ticketNumber}: "${title.trim()}". Link: /tickets/${ticketId}` },
        ],
      };
    }
  );

  server.registerTool(
    "list_tickets",
    {
      title: "List Tickets",
      description:
        "List tickets, optionally filtered by status. Admins see every ticket; everyone else sees only tickets they created themselves.",
      inputSchema: {
        status: z
          .enum(STATUSES as [TicketStatus, ...TicketStatus[]])
          .optional()
          .describe("Filter to a single status — omit to list all statuses"),
      },
    },
    async ({ status }) => {
      const tickets = await prisma.ticket.findMany({
        where: {
          ...(user.role === "ADMIN" ? {} : { createdById: user.id }),
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { ticketNumber: true, title: true, status: true, priority: true, createdAt: true },
      });

      if (tickets.length === 0) {
        return { content: [{ type: "text" as const, text: "No tickets found." }] };
      }

      const lines = tickets.map(
        (t) => `- ${t.ticketNumber} [${t.status}/${t.priority}] ${t.title} (created ${t.createdAt.toISOString()})`
      );
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  return server;
}

async function handle(request: Request): Promise<Response> {
  const user = await authenticateMcpRequest(request);
  if (!user) {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized — missing or invalid API token" }, id: null },
      { status: 401 }
    );
  }

  const server = buildServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
