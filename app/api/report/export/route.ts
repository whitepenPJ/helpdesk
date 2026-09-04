import path from "node:path";
import { auth } from "@/auth";
import { Role } from "@/app/generated/prisma/enums";
import { getReportData, type ReportCategoryRow, type ReportTicketRow } from "@/app/lib/report-data";
import { parseReportFilters } from "@/app/lib/report-filters";
import { formatDateTime } from "@/app/lib/date-format";

// pdfkit's built-in standard fonts (Helvetica etc.) only cover WinAnsi/Latin
// — ticket/category/user data in this app can be Thai, which would render
// as blank boxes with those fonts. Sarabun (OFL-licensed, bundled here)
// covers Thai + Latin, so it's used for every string in the PDF export
// instead, not just ones detected as Thai.
const FONT_DIR = path.join(process.cwd(), "app/lib/fonts");
const FONT_REGULAR = path.join(FONT_DIR, "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

function hoursLabel(hours: number | null): string {
  return hours !== null ? `${hours.toFixed(1)}h` : "—";
}

function ratingLabel(rating: number | null): string {
  return rating !== null ? `${rating.toFixed(1)} / 5` : "—";
}

async function buildWorkbook(
  groupByCategory: boolean,
  byCategory: ReportCategoryRow[],
  tickets: ReportTicketRow[],
  kpis: { total: number; open: number; closed: number; avgResolutionHours: number | null; avgCsat: number | null }
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  sheet.addRow(["Helpdesk Report", `Generated ${formatDateTime(new Date())}`]);
  sheet.addRow(["Total Tickets", kpis.total, "Open", kpis.open, "Closed", kpis.closed]);
  sheet.addRow(["Avg Resolution", hoursLabel(kpis.avgResolutionHours), "Avg CSAT", ratingLabel(kpis.avgCsat)]);
  sheet.addRow([]);

  if (groupByCategory) {
    const header = sheet.addRow(["Category", "Ticket Count", "Avg Resolution", "Avg CSAT"]);
    header.font = { bold: true };
    for (const row of byCategory) {
      sheet.addRow([row.categoryName, row.count, hoursLabel(row.avgResolutionHours), ratingLabel(row.avgRating)]);
    }
    sheet.columns = [{ width: 28 }, { width: 14 }, { width: 16 }, { width: 12 }];
  } else {
    const header = sheet.addRow([
      "Ticket #",
      "Title",
      "Category",
      "Company",
      "Department",
      "Status",
      "Priority",
      "Requester",
      "Requester Email",
      "Created",
    ]);
    header.font = { bold: true };
    for (const t of tickets) {
      sheet.addRow([
        t.ticketNumber,
        t.title,
        t.categoryName,
        t.companyName,
        t.departmentName,
        t.status,
        t.priority,
        t.requesterName,
        t.requesterEmail,
        formatDateTime(t.createdAt),
      ]);
    }
    sheet.columns = [
      { width: 16 },
      { width: 32 },
      { width: 18 },
      { width: 20 },
      { width: 18 },
      { width: 12 },
      { width: 10 },
      { width: 20 },
      { width: 26 },
      { width: 18 },
    ];
  }

  return workbook.xlsx.writeBuffer();
}

async function buildPdf(
  groupByCategory: boolean,
  byCategory: ReportCategoryRow[],
  tickets: ReportTicketRow[],
  kpis: { total: number; open: number; closed: number; avgResolutionHours: number | null; avgCsat: number | null }
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Sarabun", FONT_REGULAR);
    doc.registerFont("Sarabun-Bold", FONT_BOLD);
    doc.font("Sarabun");

    doc.fontSize(16).text("Helpdesk Report", { continued: false });
    doc.fontSize(9).fillColor("#666").text(`Generated ${formatDateTime(new Date())}`);
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor("#000")
      .text(
        `Total: ${kpis.total}   Open: ${kpis.open}   Closed: ${kpis.closed}   Avg Resolution: ${hoursLabel(
          kpis.avgResolutionHours
        )}   Avg CSAT: ${ratingLabel(kpis.avgCsat)}`
      );
    doc.moveDown(1);

    const columns = groupByCategory
      ? [
          { label: "Category", width: 220 },
          { label: "Ticket Count", width: 100 },
          { label: "Avg Resolution", width: 120 },
          { label: "Avg CSAT", width: 100 },
        ]
      : [
          { label: "Ticket #", width: 90 },
          { label: "Title", width: 170 },
          { label: "Category", width: 90 },
          { label: "Company", width: 100 },
          { label: "Status", width: 70 },
          { label: "Priority", width: 60 },
          { label: "Requester", width: 100 },
          { label: "Created", width: 100 },
        ];

    const rows: string[][] = groupByCategory
      ? byCategory.map((row) => [row.categoryName, String(row.count), hoursLabel(row.avgResolutionHours), ratingLabel(row.avgRating)])
      : tickets.map((t) => [
          t.ticketNumber,
          t.title,
          t.categoryName,
          t.companyName,
          t.status,
          t.priority,
          t.requesterName,
          formatDateTime(t.createdAt),
        ]);

    const startX = doc.page.margins.left;
    const rowHeight = 20;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    function drawHeader() {
      const y = doc.y;
      let x = startX;
      doc.fontSize(9).font("Sarabun-Bold");
      for (const col of columns) {
        doc.text(col.label, x, y, { width: col.width, ellipsis: true });
        x += col.width;
      }
      doc.font("Sarabun");
      doc.y = y + rowHeight;
    }

    drawHeader();
    for (const row of rows) {
      if (doc.y + rowHeight > bottomLimit) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        drawHeader();
      }
      const y = doc.y;
      let x = startX;
      doc.fontSize(8);
      row.forEach((cell, i) => {
        doc.text(cell, x, y, { width: columns[i].width, ellipsis: true });
        x += columns[i].width;
      });
      doc.y = y + rowHeight;
    }

    if (rows.length === 0) {
      doc.fontSize(9).fillColor("#666").text("No tickets match these filters.");
    }

    doc.end();
  });
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseReportFilters(url.searchParams);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  const data = await getReportData(filters);
  const filenameDate = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const buffer = await buildPdf(filters.groupByCategory, data.byCategory, data.tickets, data.kpis);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${filenameDate}.pdf"`,
      },
    });
  }

  const buffer = await buildWorkbook(filters.groupByCategory, data.byCategory, data.tickets, data.kpis);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report-${filenameDate}.xlsx"`,
    },
  });
}
