"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";

export type CompanyFormState =
  | {
      errors?: Record<string, string[]>;
      values?: { name: string; isActive: boolean };
    }
  | undefined;

function readFields(formData: FormData) {
  return {
    name: formData.get("name"),
    // Checkbox: present (value "true") only when checked.
    isActive: formData.get("isActive") === "true",
  };
}

export async function createCompany(_prevState: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  await requireAdmin();

  const { name, isActive } = readFields(formData);
  const values = { name: typeof name === "string" ? name : "", isActive };
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a company name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  await prisma.company.create({
    data: {
      id: randomUUID(),
      name: (name as string).trim(),
      isActive,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/master/company");
  redirect("/master/company");
}

export async function updateCompany(
  id: string,
  _prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  await requireAdmin();

  const { name, isActive } = readFields(formData);
  const values = { name: typeof name === "string" ? name : "", isActive };
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a company name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  await prisma.company.update({
    where: { id },
    data: {
      name: (name as string).trim(),
      isActive,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/master/company");
  redirect("/master/company");
}

export async function deleteCompany(id: string) {
  await requireAdmin();

  const [userCount, departmentCount, ticketCount] = await Promise.all([
    prisma.user.count({ where: { companyId: id } }),
    prisma.department.count({ where: { companyId: id } }),
    prisma.ticket.count({ where: { companyId: id } }),
  ]);

  if (userCount > 0 || departmentCount > 0 || ticketCount > 0) {
    redirect("/master/company?error=company-in-use");
  }

  await prisma.company.delete({ where: { id } });
  revalidatePath("/master/company");
  redirect("/master/company");
}

export type DepartmentFormState =
  | {
      errors?: Record<string, string[]>;
      success?: boolean;
    }
  | undefined;

export async function createDepartment(
  companyId: string,
  _prevState: DepartmentFormState,
  formData: FormData
): Promise<DepartmentFormState> {
  await requireAdmin();

  const name = formData.get("name");
  const supervisorId = formData.get("supervisorId");
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a department name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const supervisorIdValue = typeof supervisorId === "string" && supervisorId ? supervisorId : null;

  const existingName = await prisma.department.findUnique({
    where: { companyId_name: { companyId, name: (name as string).trim() } },
  });
  if (existingName) {
    return { errors: { name: ["A department with this name already exists in this company."] } };
  }

  if (supervisorIdValue) {
    const existingSupervisor = await prisma.department.findUnique({ where: { supervisorId: supervisorIdValue } });
    if (existingSupervisor) {
      return { errors: { supervisorId: ["This supervisor already manages another department."] } };
    }
  }

  await prisma.department.create({
    data: {
      id: randomUUID(),
      name: (name as string).trim(),
      companyId,
      supervisorId: supervisorIdValue,
      updatedAt: new Date(),
    },
  });

  revalidatePath(`/master/company/${companyId}/edit`);
  return { success: true };
}
