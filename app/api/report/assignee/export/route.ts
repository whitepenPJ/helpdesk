import { auth } from "@/auth";
import { Role } from "@/app/generated/prisma/enums";
import { getAssigneeReportData } from "@/app/lib/assignee-report-data";
import { parseDate } from "@/app/lib/report-filters";
import { slaDaysLabel } from "@/app/lib/sla";
import { buildExcelWorkbook, buildPdfBuffer, type ExportDocument } from "@/app/lib/report-export";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const dateFrom = parseDate(url.searchParams.get("dateFrom") ?? undefined, false);
  const dateTo = parseDate(url.searchParams.get("dateTo") ?? undefined, true);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  const data = await getAssigneeReportData(dateFrom, dateTo);

  const doc: ExportDocument = {
    title: "Assignee Report",
    summaryLines: [
      `Active: ${data.totals.active}   Processing: ${data.totals.processing}   Done: ${data.totals.done}`,
    ],
    sections: [
      {
        heading: "Assignees",
        columns: [
          { label: "Assignee", width: 200 },
          { label: "Active", width: 70 },
          { label: "Processing", width: 90 },
          { label: "Done", width: 70 },
          { label: "Total", width: 70 },
          { label: "Avg SLA Time", width: 100 },
        ],
        rows: data.rows.map((r) => [r.assigneeName, r.active, r.processing, r.done, r.total, slaDaysLabel(r.avgSlaDays)]),
        emptyMessage: "No assignees found.",
      },
    ],
  };

  const filenameDate = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const buffer = await buildPdfBuffer(doc, { landscape: false });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="assignee-report-${filenameDate}.pdf"`,
      },
    });
  }

  const buffer = await buildExcelWorkbook(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="assignee-report-${filenameDate}.xlsx"`,
    },
  });
}
