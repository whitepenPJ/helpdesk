import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { formatDateTime } from "@/app/lib/date-format";
import type { Prisma, Role } from "@/app/generated/prisma/client";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const role = url.searchParams.get("role");
  const roleFilter = role && role !== "all" ? role : "";

  const where: Prisma.UserWhereInput = {
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : {}),
    ...(roleFilter ? { role: roleFilter as Role } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    include: { Company: true, Department_User_departmentIdToDepartment: true },
    orderBy: { name: "asc" },
  });

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Users");

  const header = sheet.addRow([
    "Name",
    "Email",
    "Role",
    "Status",
    "Company",
    "Department",
    "Telephone",
    "Open Ticket For Others",
    "Created",
  ]);
  header.font = { bold: true };

  for (const u of users) {
    sheet.addRow([
      u.name,
      u.email,
      u.role,
      u.status,
      u.Company?.name ?? "",
      u.Department_User_departmentIdToDepartment?.name ?? "",
      u.telephone ?? "",
      u.canOpenTicketForOthers ? "Yes" : "No",
      formatDateTime(u.createdAt),
    ]);
  }

  sheet.columns = [
    { width: 24 },
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 22 },
    { width: 20 },
    { width: 16 },
    { width: 20 },
    { width: 18 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const filenameDate = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="users-${filenameDate}.xlsx"`,
    },
  });
}
