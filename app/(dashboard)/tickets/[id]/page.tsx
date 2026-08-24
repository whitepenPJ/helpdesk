import type { Metadata } from "next";
import { TicketDetailContent } from "./ticket-detail-content";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketDetailPage({ params, searchParams }: PageProps<"/tickets/[id]">) {
  const { id } = await params;
  const { edit, back } = await searchParams;

  return (
    <TicketDetailContent
      id={id}
      edit={typeof edit === "string" ? edit : undefined}
      back={typeof back === "string" ? back : undefined}
      defaultBackHref="/tickets"
      defaultBackLabel="Tickets"
    />
  );
}
