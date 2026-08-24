import "server-only";
import path from "node:path";
import { formatDateTime } from "@/app/lib/date-format";

// Shared by every report export route (Main/Assignee/Category/Ticket) so the
// pdfkit table-pagination logic and the Sarabun font wiring — both fiddly,
// both already debugged once for the Main Report export — exist in one
// place instead of being copy-pasted per report.

const FONT_DIR = path.join(process.cwd(), "app/lib/fonts");
const FONT_REGULAR = path.join(FONT_DIR, "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

export type ExportColumn = { label: string; width: number };

export type ExportSection = {
  // Rendered as its own worksheet (Excel) / its own page (PDF) when a
  // document has more than one section.
  heading: string;
  columns: ExportColumn[];
  rows: (string | number)[][];
  emptyMessage?: string;
};

export type ExportDocument = {
  title: string;
  summaryLines?: string[];
  sections: ExportSection[];
};

export async function buildExcelWorkbook(doc: ExportDocument) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  for (const section of doc.sections) {
    const sheet = workbook.addWorksheet(section.heading.slice(0, 31));
    sheet.addRow([doc.title, `Generated ${formatDateTime(new Date())}`]);
    for (const line of doc.summaryLines ?? []) sheet.addRow([line]);
    sheet.addRow([]);

    const header = sheet.addRow(section.columns.map((c) => c.label));
    header.font = { bold: true };
    for (const row of section.rows) sheet.addRow(row);
    if (section.rows.length === 0 && section.emptyMessage) sheet.addRow([section.emptyMessage]);

    sheet.columns = section.columns.map((c) => ({ width: Math.max(10, Math.round(c.width / 7)) }));
  }

  return workbook.xlsx.writeBuffer();
}

export async function buildPdfBuffer(doc: ExportDocument, opts?: { landscape?: boolean }): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 40, size: "A4", layout: opts?.landscape === false ? "portrait" : "landscape" });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    // pdfkit's built-in standard fonts (Helvetica etc.) only cover
    // WinAnsi/Latin — ticket/category/user data in this app can be Thai,
    // which would render as blank boxes with those fonts. Sarabun
    // (OFL-licensed, bundled in app/lib/fonts) covers Thai + Latin, so it's
    // used for every string here, not just ones detected as Thai.
    pdf.registerFont("Sarabun", FONT_REGULAR);
    pdf.registerFont("Sarabun-Bold", FONT_BOLD);
    pdf.font("Sarabun");

    const startX = pdf.page.margins.left;
    const rowHeight = 20;
    const bottomLimit = pdf.page.height - pdf.page.margins.bottom;

    doc.sections.forEach((section, sectionIndex) => {
      if (sectionIndex > 0) pdf.addPage();

      pdf.fontSize(16).fillColor("#000").text(doc.title, { continued: false });
      pdf.fontSize(9).fillColor("#666").text(`Generated ${formatDateTime(new Date())}`);
      for (const line of doc.summaryLines ?? []) {
        pdf.fontSize(10).fillColor("#000").text(line);
      }
      pdf.moveDown(0.3);
      pdf.fontSize(13).fillColor("#000").text(section.heading);
      pdf.moveDown(0.5);

      function drawHeader() {
        const y = pdf.y;
        let x = startX;
        pdf.fontSize(9).font("Sarabun-Bold");
        for (const col of section.columns) {
          pdf.text(col.label, x, y, { width: col.width, ellipsis: true });
          x += col.width;
        }
        pdf.font("Sarabun");
        pdf.y = y + rowHeight;
      }

      drawHeader();
      for (const row of section.rows) {
        if (pdf.y + rowHeight > bottomLimit) {
          pdf.addPage();
          pdf.y = pdf.page.margins.top;
          drawHeader();
        }
        const y = pdf.y;
        let x = startX;
        pdf.fontSize(8).fillColor("#000");
        row.forEach((cell, i) => {
          pdf.text(String(cell), x, y, { width: section.columns[i].width, ellipsis: true });
          x += section.columns[i].width;
        });
        pdf.y = y + rowHeight;
      }

      if (section.rows.length === 0) {
        pdf.fontSize(9).fillColor("#666").text(section.emptyMessage ?? "No data matches these filters.");
      }
    });

    pdf.end();
  });
}
