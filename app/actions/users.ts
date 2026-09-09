"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { isNonEmptyString } from "@/app/lib/text";
import { Role } from "@/app/generated/prisma/enums";
import type { UserStatus } from "@/app/generated/prisma/client";
import type { Row } from "exceljs";

export type UserFormValues = {
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  companyId: string;
  departmentId: string;
  canOpenTicketForOthers: boolean;
};

export type UserFormState =
  | {
      errors?: Record<string, string[]>;
      values?: UserFormValues;
    }
  | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: Role[] = [Role.ADMIN, Role.SUPERVISOR, Role.USER];

function readCommonFields(formData: FormData) {
  return {
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    // Checkbox: present (value "ACTIVE") only when checked, absent when
    // unchecked — there's no invalid state to validate against.
    status: (formData.get("status") === "ACTIVE" ? "ACTIVE" : "INACTIVE") as UserStatus,
    companyId: formData.get("companyId"),
    departmentId: formData.get("departmentId"),
    // Checkbox: present (value "true") only when checked.
    canOpenTicketForOthers: formData.get("canOpenTicketForOthers") === "true",
  };
}

// Re-render after a failed submission still shows whatever the user typed —
// the inputs stay uncontrolled and just keep their live DOM value, EXCEPT
// the ones driven by Select2 (jQuery re-owns their DOM on remount), which
// need the submitted value fed back in explicitly.
function toFormValues(fields: ReturnType<typeof readCommonFields>): UserFormValues {
  return {
    name: typeof fields.name === "string" ? fields.name : "",
    email: typeof fields.email === "string" ? fields.email : "",
    role: typeof fields.role === "string" ? fields.role : "",
    status: fields.status,
    companyId: typeof fields.companyId === "string" ? fields.companyId : "",
    departmentId: typeof fields.departmentId === "string" ? fields.departmentId : "",
    canOpenTicketForOthers: fields.canOpenTicketForOthers,
  };
}

export async function validateDepartmentBelongsToCompany(companyId: string | null, departmentId: string | null) {
  if (!departmentId) return null;
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) return "Selected department was not found.";
  if (companyId && department.companyId !== companyId) {
    return "Selected department does not belong to the selected company.";
  }
  return null;
}

export async function createUser(_prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireAdmin();

  const fields = readCommonFields(formData);
  const { name, email, role, status, companyId, departmentId, canOpenTicketForOthers } = fields;
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");
  const values = toFormValues(fields);

  const errors: Record<string, string[]> = {};

  if (!isNonEmptyString(name)) {
    errors.name = ["Enter a name."];
  }
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    errors.email = ["Enter a valid email address."];
  }
  if (typeof password !== "string" || password.length < 8) {
    errors.password = ["Password must be at least 8 characters."];
  }
  if (password !== confirmPassword) {
    errors.confirmPassword = ["Passwords do not match."];
  }
  if (typeof role !== "string" || !ROLES.includes(role as Role)) {
    errors.role = ["Select a role."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const existing = await prisma.user.findUnique({ where: { email: email as string } });
  if (existing) {
    return { errors: { email: ["A user with this email already exists."] }, values };
  }

  const companyIdValue = typeof companyId === "string" && companyId ? companyId : null;
  const departmentIdValue = typeof departmentId === "string" && departmentId ? departmentId : null;

  const departmentError = await validateDepartmentBelongsToCompany(companyIdValue, departmentIdValue);
  if (departmentError) {
    return { errors: { departmentId: [departmentError] }, values };
  }

  const passwordHash = await bcrypt.hash(password as string, 10);

  await prisma.user.create({
    data: {
      name: (name as string).trim(),
      email: email as string,
      passwordHash,
      role: role as Role,
      status: status as UserStatus,
      companyId: companyIdValue,
      departmentId: departmentIdValue,
      canOpenTicketForOthers,
    },
  });

  revalidatePath("/master/user");
  redirect("/master/user");
}

export async function updateUser(
  id: string,
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();

  const fields = readCommonFields(formData);
  const { name, email, role, status, companyId, departmentId, canOpenTicketForOthers } = fields;
  const values = toFormValues(fields);

  const errors: Record<string, string[]> = {};

  if (!isNonEmptyString(name)) {
    errors.name = ["Enter a name."];
  }
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    errors.email = ["Enter a valid email address."];
  }
  if (typeof role !== "string" || !ROLES.includes(role as Role)) {
    errors.role = ["Select a role."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const existing = await prisma.user.findUnique({ where: { email: email as string } });
  if (existing && existing.id !== id) {
    return { errors: { email: ["A user with this email already exists."] }, values };
  }

  const companyIdValue = typeof companyId === "string" && companyId ? companyId : null;
  const departmentIdValue = typeof departmentId === "string" && departmentId ? departmentId : null;

  const departmentError = await validateDepartmentBelongsToCompany(companyIdValue, departmentIdValue);
  if (departmentError) {
    return { errors: { departmentId: [departmentError] }, values };
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: (name as string).trim(),
      email: email as string,
      role: role as Role,
      status: status as UserStatus,
      companyId: companyIdValue,
      departmentId: departmentIdValue,
      canOpenTicketForOthers,
    },
  });

  revalidatePath("/master/user");
  redirect("/master/user");
}

// "Delete" is really deactivation, not a row removal — a hard delete would
// cascade into every ticket/comment/history row this user ever touched.
// INACTIVE already blocks Credentials sign-in (see auth.ts's authorize),
// so this has the same practical effect while keeping their history intact
// and reversible (an admin can flip them back to ACTIVE via Edit).
export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) {
    redirect("/master/user?error=cannot-delete-self");
  }

  await prisma.user.update({ where: { id }, data: { status: "INACTIVE" } });
  revalidatePath("/master/user");
  redirect("/master/user");
}

export type ImportUsersResult =
  | {
      created: { email: string; password: string }[];
      updated: string[];
      errors: { row: number; message: string }[];
    }
  | { error: string }
  | undefined;

const STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"];

// Bulk create/update from an uploaded .xlsx (see the export at
// /api/master/user/export for the exact column shape this expects — Name,
// Email, Role, Status, Company, Department, Telephone). Matches existing
// rows by email (update, password untouched) vs. new rows (create with a
// random generated password — shown once in the result, never stored in
// plaintext or logged, since there's no invite-by-email flow to hand it off
// through otherwise). Company/Department must match an existing name
// exactly (case-insensitive) — a typo skips just that row, not the batch.
export async function importUsers(_prevState: ImportUsersResult, formData: FormData): Promise<ImportUsersResult> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a .xlsx file to import." };
  }

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return { error: "Couldn't read that file — make sure it's a valid .xlsx workbook." };
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { error: "The workbook has no worksheet." };
  }

  const columnIndex = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const key = String(cell.value ?? "").trim().toLowerCase();
    if (key) columnIndex.set(key, colNumber);
  });
  if (!columnIndex.has("name") || !columnIndex.has("email")) {
    return { error: 'The first row must have "Name" and "Email" column headers.' };
  }

  function cellValue(row: Row, name: string): string {
    const idx = columnIndex.get(name);
    if (!idx) return "";
    const value = row.getCell(idx).value;
    if (value === null || value === undefined) return "";
    if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "").trim();
    return String(value).trim();
  }

  const [companies, departments] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true } }),
    prisma.department.findMany({ select: { id: true, name: true, companyId: true } }),
  ]);

  const created: { email: string; password: string }[] = [];
  const updated: string[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;

    const name = cellValue(row, "name");
    const email = cellValue(row, "email");
    if (!name && !email) continue;

    if (!name) {
      errors.push({ row: rowNumber, message: "Missing name — row skipped." });
      continue;
    }
    if (!EMAIL_PATTERN.test(email)) {
      errors.push({ row: rowNumber, message: "Missing or invalid email — row skipped." });
      continue;
    }

    const roleRaw = cellValue(row, "role").toUpperCase();
    if (roleRaw && !ROLES.includes(roleRaw as Role)) {
      errors.push({ row: rowNumber, message: `Unknown role "${roleRaw}" — row skipped.` });
      continue;
    }
    const role: Role = (roleRaw as Role) || Role.USER;

    const statusRaw = cellValue(row, "status").toUpperCase();
    if (statusRaw && !STATUSES.includes(statusRaw as UserStatus)) {
      errors.push({ row: rowNumber, message: `Unknown status "${statusRaw}" — row skipped.` });
      continue;
    }
    const status: UserStatus = (statusRaw as UserStatus) || "ACTIVE";

    const companyName = cellValue(row, "company");
    let companyId: string | null = null;
    if (companyName) {
      const company = companies.find((c) => c.name.toLowerCase() === companyName.toLowerCase());
      if (!company) {
        errors.push({ row: rowNumber, message: `Company "${companyName}" not found — row skipped.` });
        continue;
      }
      companyId = company.id;
    }

    const departmentName = cellValue(row, "department");
    let departmentId: string | null = null;
    if (departmentName) {
      const department = departments.find(
        (d) => d.name.toLowerCase() === departmentName.toLowerCase() && d.companyId === companyId
      );
      if (!department) {
        errors.push({
          row: rowNumber,
          message: `Department "${departmentName}" not found in that company — row skipped.`,
        });
        continue;
      }
      departmentId = department.id;
    }

    const telephone = cellValue(row, "telephone") || null;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name, role, status, companyId, departmentId, telephone },
      });
      updated.push(email);
    } else {
      const password = randomBytes(9).toString("base64url");
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: { name, email, passwordHash, role, status, companyId, departmentId, telephone },
      });
      created.push({ email, password });
    }
  }

  revalidatePath("/master/user");
  return { created, updated, errors };
}
