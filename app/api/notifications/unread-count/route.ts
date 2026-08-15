import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUnreadNotificationCount } from "@/app/lib/notifications";

// Polled by notification-poller.tsx to approximate a live "new ticket"
// alert without a websocket/SSE layer — cheap enough (a single COUNT query)
// to hit every ~20s per signed-in admin.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await getUnreadNotificationCount(session.user.id, session.user.role);
  return NextResponse.json({ count });
}
