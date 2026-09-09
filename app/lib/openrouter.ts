import "server-only";
import { excerpt, isNonEmptyString } from "@/app/lib/text";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatEnvelope = {
  reply: string;
  lessonLearnedId: string | null;
  lessonLearnedTitle: string | null;
  offerTicket: boolean;
  draftTitle: string | null;
  draftDescription: string | null;
};

type LessonContext = { id: string; title: string; description: string };

const NOT_CONFIGURED: ChatEnvelope = {
  reply: "AI chat isn't configured yet — an administrator needs to add an OpenRouter API key.",
  lessonLearnedId: null,
  lessonLearnedTitle: null,
  offerTicket: false,
  draftTitle: null,
  draftDescription: null,
};

const UNREACHABLE: ChatEnvelope = {
  reply: "Sorry, I couldn't reach the AI service — please try again.",
  lessonLearnedId: null,
  lessonLearnedTitle: null,
  offerTicket: false,
  draftTitle: null,
  draftDescription: null,
};

const DEFAULT_MODEL = "openai/gpt-oss-20b:free";
const REQUEST_TIMEOUT_MS = 30000;

function buildSystemPrompt(lessons: LessonContext[]): string {
  const context = lessons.map((l) => ({ id: l.id, title: l.title, summary: excerpt(l.description, 200) }));
  return `You are a helpdesk assistant for an internal support ticketing system.
You have access to this organization's Lesson Learned knowledge base:
${JSON.stringify(context)}

Rules:
- If the user's question is answered by one of these entries, mention it and set lessonLearnedId to its exact id.
- If nothing in the list answers the question, and it sounds like something that needs a support ticket, set offerTicket to true and draft a concise title and description for it based on the whole conversation.
- Never invent a lessonLearnedId that isn't in the list above.
- Respond with ONLY a single JSON object, no markdown code fences, no extra prose, matching exactly this shape:
  {"reply": string, "lessonLearnedId": string|null, "offerTicket": boolean, "draftTitle": string|null, "draftDescription": string|null}`;
}

function parseEnvelope(
  raw: string,
  validIds: Set<string>,
  idToTitle: Map<string, string>
): ChatEnvelope {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(stripped);
    const lessonLearnedId =
      typeof parsed.lessonLearnedId === "string" && validIds.has(parsed.lessonLearnedId)
        ? parsed.lessonLearnedId
        : null;
    const offerTicket = parsed.offerTicket === true;
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply : raw,
      lessonLearnedId,
      lessonLearnedTitle: lessonLearnedId ? (idToTitle.get(lessonLearnedId) ?? null) : null,
      offerTicket,
      draftTitle: offerTicket && typeof parsed.draftTitle === "string" ? parsed.draftTitle : null,
      draftDescription: offerTicket && typeof parsed.draftDescription === "string" ? parsed.draftDescription : null,
    };
  } catch {
    return { reply: raw, lessonLearnedId: null, lessonLearnedTitle: null, offerTicket: false, draftTitle: null, draftDescription: null };
  }
}

// Known, accepted scale limitation: every request stuffs *all* active
// Lesson Learned entries into the system prompt. Fine for tens to low
// hundreds of short entries; won't scale to a large knowledge base. No
// vector-search/embeddings infra exists in this codebase — building one is
// out of scope here.
export async function getChatReply(messages: ChatMessage[], lessons: LessonContext[]): Promise<ChatEnvelope> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("getChatReply: missing OPENROUTER_API_KEY — skipping call");
    return NOT_CONFIGURED;
  }

  const validIds = new Set(lessons.map((l) => l.id));
  const idToTitle = new Map(lessons.map((l) => [l.id, l.title]));
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: buildSystemPrompt(lessons) }, ...messages],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`getChatReply: OpenRouter responded ${response.status}`, await response.text());
      return UNREACHABLE;
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!isNonEmptyString(raw)) {
      console.error("getChatReply: OpenRouter returned no content", data);
      return UNREACHABLE;
    }

    return parseEnvelope(raw, validIds, idToTitle);
  } catch (error) {
    console.error("getChatReply: request failed", error);
    return UNREACHABLE;
  } finally {
    clearTimeout(timeout);
  }
}
