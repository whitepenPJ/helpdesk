import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { getChatReply, type ChatMessage } from "@/app/lib/openrouter";
import { CHAT_ENABLED } from "@/app/lib/feature-flags";

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 4000;

// Route Handlers can't use requireUser()'s redirect() — this is a plain
// 401 instead. Public-to-any-signed-in-user endpoint, so the request body
// is treated as untrusted the same way every Server Action treats formData.
export async function POST(request: Request) {
  if (!CHAT_ENABLED) {
    return NextResponse.json(
      {
        reply: "Ask AI is temporarily unavailable. Please check back later.",
        lessonLearnedId: null,
        lessonLearnedTitle: null,
        offerTicket: false,
        draftTitle: null,
        draftDescription: null,
      },
      { status: 200 }
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawMessages = body?.messages;
  if (!Array.isArray(rawMessages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const messages: ChatMessage[] = rawMessages
    .filter(
      (m): m is ChatMessage =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_LENGTH) }));

  const lessons = await prisma.lessonLearned.findMany({
    where: { isActive: true },
    select: { id: true, title: true, description: true },
  });

  const envelope = await getChatReply(messages, lessons);
  return NextResponse.json(envelope);
}
