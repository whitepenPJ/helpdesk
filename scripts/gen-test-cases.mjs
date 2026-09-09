// Builds docs/test-cases.xlsx from scripts/test-cases.data.mjs:
//   - a "Summary" sheet: one row per module, with All (case count) and
//     live Passed/Failed tallies that update as testers fill in each
//     module sheet's "Pass / Fail" column.
//   - one detail sheet per module: a Module Name / Description / Tester /
//     Date header block, then a No / Scenario / Test Step / Expected
//     Result / Actual Result / Pass / Fail table. Scenario cells are
//     merged across consecutive rows that share a scenario.
//
// Run: npm run test:cases   (or: node scripts/gen-test-cases.mjs)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import ExcelJS from "exceljs";
import { MODULES } from "./test-cases.data.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const outPath = path.join(rootDir, "docs/test-cases.xlsx");

const CYAN_HEADER = "FF00D6D6";
const CYAN_LABEL = "FF9BF0F0";
const GREEN_PASS = "FF3E7D34";
const RED_FAIL = "FFB0413E";
const GREY_SUM = "FFD9D9D9";

const THIN = { style: "thin", color: { argb: "FF808080" } };
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/** Excel sheet names: <= 31 chars, none of []:*?/\ , must be unique. */
function sheetName(name, used) {
  let base = name.replace(/[[\]:*?/\\]/g, "-").slice(0, 31);
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function fill(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

const wb = new ExcelJS.Workbook();
wb.creator = "gen-test-cases.mjs";
wb.created = new Date();

const summary = wb.addWorksheet("Summary", {
  views: [{ state: "frozen", ySplit: 2 }],
});
summary.columns = [
  { key: "id", width: 8 },
  { key: "module", width: 42 },
  { key: "all", width: 12 },
  { key: "passed", width: 12 },
  { key: "failed", width: 12 },
];

// Two-row header: "Result" spanning All/Passed/Failed.
summary.mergeCells("A1:A2");
summary.mergeCells("B1:B2");
summary.mergeCells("C1:E1");
summary.getCell("A1").value = "ID";
summary.getCell("B1").value = "Module";
summary.getCell("C1").value = "Result";
summary.getCell("A3"); // ensure row 3 exists below
const head2 = summary.getRow(2);
head2.getCell(3).value = "All";
head2.getCell(4).value = "Passed";
head2.getCell(5).value = "Failed";
for (const ref of ["A1", "B1", "C1", "C2", "D2", "E2"]) {
  const c = summary.getCell(ref);
  c.font = { bold: true };
  c.alignment = { horizontal: "center", vertical: "middle" };
  c.fill = fill(CYAN_HEADER);
  c.border = BORDER_ALL;
}

const usedNames = new Set(["summary"]);
const planned = MODULES.map((m) => ({ module: m, sheet: sheetName(m.name, usedNames) }));

let rowIdx = 3;
let firstDataRow = rowIdx;
for (const [i, { module, sheet }] of planned.entries()) {
  const count = module.cases.length;
  const row = summary.getRow(rowIdx);
  row.getCell(1).value = `#${i + 1}`;
  row.getCell(2).value = { text: module.name, hyperlink: `#'${sheet}'!A1` };
  row.getCell(2).font = { color: { argb: "FF0563C1" }, underline: true };
  row.getCell(3).value = count;
  // Live tallies from the module sheet's "Pass / Fail" column (F).
  row.getCell(4).value = { formula: `COUNTIF('${sheet}'!F:F,"PASS")` };
  row.getCell(5).value = { formula: `COUNTIF('${sheet}'!F:F,"FAIL")` };
  for (let c = 1; c <= 5; c++) {
    row.getCell(c).border = BORDER_ALL;
    if (c >= 3) row.getCell(c).alignment = { horizontal: "center" };
  }
  rowIdx++;
}
const lastDataRow = rowIdx - 1;

// Sum row.
const sumRow = summary.getRow(rowIdx);
sumRow.getCell(2).value = "Sum";
sumRow.getCell(2).alignment = { horizontal: "right" };
for (let c = 3; c <= 5; c++) {
  const col = String.fromCharCode(64 + c);
  sumRow.getCell(c).value = { formula: `SUM(${col}${firstDataRow}:${col}${lastDataRow})` };
  sumRow.getCell(c).alignment = { horizontal: "center" };
}
for (let c = 1; c <= 5; c++) {
  sumRow.getCell(c).font = { bold: true };
  sumRow.getCell(c).fill = fill(GREY_SUM);
  sumRow.getCell(c).border = BORDER_ALL;
}

// ---- one detail sheet per module ----
const TABLE_HEADERS = ["No", "Scenario", "Test Step", "Expected Result", "Actual Result", "Pass / Fail"];

for (const { module, sheet } of planned) {
  const ws = wb.addWorksheet(sheet, { views: [{ state: "frozen", ySplit: 6 }] });
  ws.columns = [
    { width: 6 },
    { width: 26 },
    { width: 52 },
    { width: 52 },
    { width: 30 },
    { width: 12 },
  ];

  const metaRows = [
    ["Module Name", module.name],
    ["Description", module.description],
    ["Tester Name", ""],
    ["Test Date", ""],
  ];
  metaRows.forEach(([label, value], r) => {
    const row = ws.getRow(r + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(1).fill = fill(CYAN_LABEL);
    row.getCell(1).alignment = { vertical: "top" };
    row.getCell(1).border = BORDER_ALL;
    ws.mergeCells(r + 1, 2, r + 1, 6);
    const v = row.getCell(2);
    v.value = value;
    v.alignment = { vertical: "top", wrapText: true };
    v.border = BORDER_ALL;
  });
  ws.getRow(2).height = 90; // Description

  // spacer row 5, header row 6
  const header = ws.getRow(6);
  TABLE_HEADERS.forEach((h, c) => {
    const cell = header.getCell(c + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = fill(CYAN_HEADER);
    cell.border = BORDER_ALL;
  });

  let r = 7;
  const firstCaseRow = r;
  let scenarioStart = r;
  module.cases.forEach((tc, idx) => {
    const row = ws.getRow(r);
    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { horizontal: "center", vertical: "top" };
    row.getCell(2).value = tc.scenario;
    row.getCell(2).alignment = { vertical: "top", wrapText: true };
    row.getCell(3).value = tc.step;
    row.getCell(3).alignment = { vertical: "top", wrapText: true };
    row.getCell(4).value = tc.expected;
    row.getCell(4).alignment = { vertical: "top", wrapText: true };
    row.getCell(5).value = "";
    row.getCell(5).alignment = { vertical: "top", wrapText: true };
    row.getCell(6).value = "";
    row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 1; c <= 6; c++) row.getCell(c).border = BORDER_ALL;

    const nextScenario = module.cases[idx + 1]?.scenario;
    if (nextScenario !== tc.scenario) {
      if (r > scenarioStart) ws.mergeCells(scenarioStart, 2, r, 2);
      scenarioStart = r + 1;
    }
    r++;
  });
  const lastCaseRow = r - 1;

  // PASS -> green, FAIL -> red on the Pass / Fail column.
  ws.addConditionalFormatting({
    ref: `F${firstCaseRow}:F${lastCaseRow}`,
    rules: [
      {
        type: "cellIs",
        operator: "equal",
        formulae: ['"PASS"'],
        style: { fill: fill(GREEN_PASS), font: { bold: true, color: { argb: "FFFFFFFF" } } },
      },
      {
        type: "cellIs",
        operator: "equal",
        formulae: ['"FAIL"'],
        style: { fill: fill(RED_FAIL), font: { bold: true, color: { argb: "FFFFFFFF" } } },
      },
    ],
  });

  // Data-validation dropdown for Pass / Fail.
  for (let rr = firstCaseRow; rr <= lastCaseRow; rr++) {
    ws.getCell(`F${rr}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"PASS,FAIL,BLOCKED,N/A"'],
    };
  }
}

await mkdir(path.dirname(outPath), { recursive: true });
await wb.xlsx.writeFile(outPath);

const totalCases = MODULES.reduce((n, m) => n + m.cases.length, 0);
console.log(`gen-test-cases: ${MODULES.length} modules, ${totalCases} test cases -> docs/test-cases.xlsx`);
