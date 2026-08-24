import type { Metadata } from "next";
import { TicketDetailContent } from "../../../tickets/[id]/ticket-detail-content";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketManagementDetailPage({
  params,
  searchParams,
}: PageProps<"/transaction/ticket-management/[id]">) {
  const { id } = await params;
  const { edit, back } = await searchParams;

  return (
    <TicketDetailContent
      id={id}
      edit={typeof edit === "string" ? edit : undefined}
      back={typeof back === "string" ? back : undefined}
      defaultBackHref="/transaction/ticket-management"
      defaultBackLabel="Ticket Management"
    />
  );
}
