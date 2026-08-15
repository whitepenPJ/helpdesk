"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import type { Role, UserStatus } from "@/app/generated/prisma/client";

export type UserFormValues = {
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  companyId: string;
  departmentId: string;
};

export type UserFormState =
  | {
      errors?: Record<string, string[]>;
      values?: UserFormValues;
    }
  | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: Role[] = ["ADMIN", "SUPERVISOR", "USER"];

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
  const { name, email, role, status, companyId, departmentId } = fields;
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");
  const values = toFormValues(fields);

  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
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
  const { name, email, role, status, companyId, departmentId } = fields;
  const values = toFormValues(fields);

  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
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
    },
  });

  revalidatePath("/master/user");
  redirect("/master/user");
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) {
    redirect("/master/user?error=cannot-delete-self");
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/master/user");
  redirect("/master/user");
}
