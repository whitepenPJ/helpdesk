"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
import Link from "next/link";
import { TicketForm } from "../tickets/ticket-form";

type ChatEnvelope = {
  reply: string;
  lessonLearnedId: string | null;
  lessonLearnedTitle: string | null;
  offerTicket: boolean;
  draftTitle: string | null;
  draftDescription: string | null;
};

type DisplayMessage = { role: "user" | "assistant"; content: string; envelope?: ChatEnvelope };
type TicketFormProps = Omit<ComponentProps<typeof TicketForm>, "defaultTitle" | "defaultDescription">;

// No persisted chat history — conversation lives only in this component's
// state for the session; the full array is re-sent to /api/chat every turn
// (the route is stateless). Refreshing the page loses the conversation,
// a deliberate scope cut.
export function ChatPanel({ ticketFormProps }: { ticketFormProps: TicketFormProps }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [dismissedOffers, setDismissedOffers] = useState<Set<number>>(new Set());
  const [showTicketFormAt, setShowTicketFormAt] = useState<number | null>(null);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      const envelope = (await res.json()) as ChatEnvelope;
      setMessages((prev) => [...prev, { role: "assistant", content: envelope.reply, envelope }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card card-primary card-outline mb-4">
      <div className="card-header">
        <div className="card-title">Ask AI</div>
      </div>
      <div className="card-body" style={{ minHeight: "24rem" }}>
        {messages.length === 0 && (
          <p className="text-secondary">Ask a question — I&apos;ll check the Lesson Learned knowledge base first.</p>
        )}
        <div className="d-flex flex-column gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`d-flex ${m.role === "user" ? "justify-content-end" : "justify-content-start"}`}>
              <div
                className={`card ${m.role === "user" ? "bg-primary text-white" : "bg-body-secondary"}`}
                style={{ maxWidth: "80%" }}
              >
                <div className="card-body py-2 px-3">
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                  {m.envelope?.lessonLearnedId && (
                    <Link
                      href={`/lesson-learned/${m.envelope.lessonLearnedId}`}
                      className="btn btn-sm btn-outline-secondary mt-2"
                    >
                      <i className="bi bi-lightbulb me-1" aria-hidden="true"></i>
                      View: {m.envelope.lessonLearnedTitle}
                    </Link>
                  )}
                  {m.envelope?.offerTicket && !dismissedOffers.has(i) && showTicketFormAt !== i && (
                    <div className="mt-2 d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowTicketFormAt(i)}>
                        Yes, create a ticket
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setDismissedOffers((prev) => new Set(prev).add(i))}
                      >
                        No thanks
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {showTicketFormAt !== null && (
          <div className="mt-3">
            <TicketForm
              {...ticketFormProps}
              defaultTitle={messages[showTicketFormAt]?.envelope?.draftTitle ?? undefined}
              defaultDescription={messages[showTicketFormAt]?.envelope?.draftDescription ?? undefined}
            />
          </div>
        )}
      </div>
      <div className="card-footer">
        <form onSubmit={sendMessage} className="d-flex gap-2">
          <label htmlFor="chat-input" className="visually-hidden">
            Message
          </label>
          <input
            id="chat-input"
            type="text"
            className="form-control"
            placeholder="Type your question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending}
          />
          <button type="submit" className="btn btn-primary" disabled={pending || !input.trim()}>
            {pending ? "Thinking…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
