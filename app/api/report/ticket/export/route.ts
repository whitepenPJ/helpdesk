import { auth } from "@/auth";
import { getTicketReportData, type TicketReportRow } from "@/app/lib/ticket-report-data";
import { parseDate } from "@/app/lib/report-filters";
import { formatDateTime } from "@/app/lib/date-format";
import { buildExcelWorkbook, buildPdfBuffer, type ExportDocument, type ExportSection } from "@/app/lib/report-export";

function satisfactionSections(data: Awaited<ReturnType<typeof getTicketReportData>>): ExportSection[] {
  return [
    {
      heading: "Satisfaction by Month",
      columns: [
        { label: "Month", width: 100 },
        { label: "Rated Tickets", width: 100 },
        { label: "Avg Satisfaction", width: 120 },
      ],
      rows: data.monthly.map((m) => [m.month, m.count, m.avgRating !== null ? `${m.avgRating.toFixed(1)} / 5` : "—"]),
      emptyMessage: "No rated tickets in range.",
    },
    {
      heading: "Satisfaction by Category",
      columns: [
        { label: "Category", width: 200 },
        { label: "Rated Tickets", width: 100 },
        { label: "Avg Satisfaction", width: 120 },
      ],
      rows: data.byCategory.map((c) => [c.categoryName, c.count, c.avgRating !== null ? `${c.avgRating.toFixed(1)} / 5` : "—"]),
      emptyMessage: "No rated tickets in range.",
    },
    {
      heading: "Satisfaction Distribution",
      columns: [
        { label: "Rating", width: 150 },
        { label: "Count", width: 80 },
        { label: "Percent", width: 80 },
      ],
      rows: data.ratingDistribution.map((r) => [r.label, r.count, `${r.percent.toFixed(1)}%`]),
      emptyMessage: "No rated tickets in range.",
    },
  ];
}

// Excel gets every Ticket field ("show all field in ticket table") — a
// spreadsheet has no readable-width constraint. The PDF's "Tickets" table
// sticks to a curated subset matching the on-screen table, same
// full-in-Excel / curated-in-PDF split the Main Report export already uses.
function ticketsRowsFull(tickets: TicketReportRow[]): (string | number)[][] {
  return tickets.map((t) => [
    t.ticketNumber,
    t.title,
    t.description,
    t.categoryName,
    t.companyName,
    t.departmentName,
    t.status,
    t.priority,
    t.requesterName,
    t.requesterEmail,
    t.assignment,
    t.telephone ?? "",
    formatDateTime(t.transactionDate),
    formatDateTime(t.createdAt),
    t.resolvedAt ? formatDateTime(t.resolvedAt) : "",
    t.closedAt ? formatDateTime(t.closedAt) : "",
    t.ratingScore !== null ? t.ratingScore : "",
    t.ratingComment ?? "",
    t.problem ?? "",
    t.solution ?? "",
  ]);
}

const FULL_COLUMNS = [
  { label: "Ticket #", width: 90 },
  { label: "Title", width: 160 },
  { label: "Description", width: 220 },
  { label: "Category", width: 90 },
  { label: "Company", width: 100 },
  { label: "Department", width: 100 },
  { label: "Status", width: 70 },
  { label: "Priority", width: 60 },
  { label: "Requester", width: 100 },
  { label: "Requester Email", width: 140 },
  { label: "Assignment", width: 120 },
  { label: "Telephone", width: 80 },
  { label: "Transaction Date", width: 100 },
  { label: "Created", width: 100 },
  { label: "Resolved", width: 100 },
  { label: "Closed", width: 100 },
  { label: "Rating", width: 60 },
  { label: "Rating Comment", width: 200 },
  { label: "Problem", width: 220 },
  { label: "Solution", width: 220 },
];

const CURATED_COLUMNS = [
  { label: "Ticket #", width: 70 },
  { label: "Title", width: 150 },
  { label: "Category", width: 80 },
  { label: "Status", width: 60 },
  { label: "Priority", width: 55 },
  { label: "Requester", width: 90 },
  { label: "Transaction Date", width: 90 },
  { label: "Rating", width: 55 },
];

function ticketsRowsCurated(tickets: TicketReportRow[]): (string | number)[][] {
  return tickets.map((t) => [
    t.ticketNumber,
    t.title,
    t.categoryName,
    t.status,
    t.priority,
    t.requesterName,
    formatDateTime(t.transactionDate),
    t.ratingScore !== null ? t.ratingScore : "—",
  ]);
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const dateFrom = parseDate(url.searchParams.get("dateFrom") ?? undefined, false);
  const dateTo = parseDate(url.searchParams.get("dateTo") ?? undefined, true);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  const data = await getTicketReportData(dateFrom, dateTo);
  const summaryLines = [`Total Tickets: ${data.tickets.length}   Rated: ${data.totalRated}`];
  const filenameDate = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const doc: ExportDocument = {
      title: "Ticket Report",
      summaryLines,
      sections: [
        { heading: "Tickets", columns: CURATED_COLUMNS, rows: ticketsRowsCurated(data.tickets), emptyMessage: "No tickets match these filters." },
        ...satisfactionSections(data),
      ],
    };
    const buffer = await buildPdfBuffer(doc, { landscape: true });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ticket-report-${filenameDate}.pdf"`,
      },
    });
  }

  const doc: ExportDocument = {
    title: "Ticket Report",
    summaryLines,
    sections: [
      { heading: "Tickets", columns: FULL_COLUMNS, rows: ticketsRowsFull(data.tickets), emptyMessage: "No tickets match these filters." },
      ...satisfactionSections(data),
    ],
  };
  const buffer = await buildExcelWorkbook(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ticket-report-${filenameDate}.xlsx"`,
    },
  });
}
