import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";

// Backs the Tickets list's search-box autocomplete (ticket-search-input.tsx)
// — same title/ticketNumber substring match and own-tickets-only scoping as
// the page's own filter, just returning a short suggestion list per
// keystroke instead of a full paginated page.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const isAdmin = session.user.role === "ADMIN";
  const tickets = await prisma.ticket.findMany({
    where: {
      deletedAt: null,
      ...(isAdmin ? {} : { createdById: session.user.id }),
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { ticketNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, ticketNumber: true, title: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return NextResponse.json(tickets);
}
