"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";

export type CompanyFormState =
  | {
      errors?: Record<string, string[]>;
      values?: { name: string; code: string; isActive: boolean };
    }
  | undefined;

function readFields(formData: FormData) {
  return {
    name: formData.get("name"),
    code: formData.get("code"),
    // Checkbox: present (value "true") only when checked.
    isActive: formData.get("isActive") === "true",
  };
}

export async function createCompany(_prevState: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  await requireAdmin();

  const { name, code, isActive } = readFields(formData);
  const codeValue = typeof code === "string" && code.trim() ? code.trim() : null;
  const values = { name: typeof name === "string" ? name : "", code: codeValue ?? "", isActive };
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a company name."];
  }

  if (codeValue) {
    const existingCode = await prisma.company.findUnique({ where: { code: codeValue } });
    if (existingCode) {
      errors.code = ["This company code is already in use."];
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  await prisma.company.create({
    data: {
      id: randomUUID(),
      name: (name as string).trim(),
      code: codeValue,
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

  const { name, code, isActive } = readFields(formData);
  const codeValue = typeof code === "string" && code.trim() ? code.trim() : null;
  const values = { name: typeof name === "string" ? name : "", code: codeValue ?? "", isActive };
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a company name."];
  }

  if (codeValue) {
    const existingCode = await prisma.company.findUnique({ where: { code: codeValue } });
    if (existingCode && existingCode.id !== id) {
      errors.code = ["This company code is already in use."];
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  await prisma.company.update({
    where: { id },
    data: {
      name: (name as string).trim(),
      code: codeValue,
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
  const code = formData.get("code");
  const approverIds = formData.getAll("approverIds").filter((v): v is string => typeof v === "string" && v.length > 0);
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a department name."];
  }

  const codeValue = typeof code === "string" && code.trim() ? code.trim() : null;

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const existingName = await prisma.department.findUnique({
    where: { companyId_name: { companyId, name: (name as string).trim() } },
  });
  if (existingName) {
    return { errors: { name: ["A department with this name already exists in this company."] } };
  }

  if (codeValue) {
    const existingCode = await prisma.department.findUnique({
      where: { companyId_code: { companyId, code: codeValue } },
    });
    if (existingCode) {
      return { errors: { code: ["A department with this code already exists in this company."] } };
    }
  }

  await prisma.department.create({
    data: {
      id: randomUUID(),
      name: (name as string).trim(),
      code: codeValue,
      companyId,
      updatedAt: new Date(),
      DepartmentApprover: approverIds.length
        ? { create: approverIds.map((userId) => ({ id: randomUUID(), userId })) }
        : undefined,
    },
  });

  revalidatePath(`/master/company/${companyId}/edit`);
  return { success: true };
}

export type UpdateDepartmentState = { errors?: Record<string, string[]>; success?: boolean } | undefined;

export async function updateDepartment(
  departmentId: string,
  _prevState: UpdateDepartmentState,
  formData: FormData
): Promise<UpdateDepartmentState> {
  await requireAdmin();

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) return { errors: { code: ["Department not found."] } };

  const code = formData.get("code");
  const approverIds = formData.getAll("approverIds").filter((v): v is string => typeof v === "string" && v.length > 0);
  const codeValue = typeof code === "string" && code.trim() ? code.trim() : null;

  if (codeValue) {
    const existingCode = await prisma.department.findUnique({
      where: { companyId_code: { companyId: department.companyId, code: codeValue } },
    });
    if (existingCode && existingCode.id !== departmentId) {
      return { errors: { code: ["A department with this code already exists in this company."] } };
    }
  }

  await prisma.$transaction([
    prisma.departmentApprover.deleteMany({ where: { departmentId } }),
    prisma.department.update({
      where: { id: departmentId },
      data: {
        code: codeValue,
        updatedAt: new Date(),
        DepartmentApprover: approverIds.length
          ? { create: approverIds.map((userId) => ({ id: randomUUID(), userId })) }
          : undefined,
      },
    }),
  ]);

  revalidatePath(`/master/company/${department.companyId}/edit`);
  return { success: true };
}

export async function deleteDepartment(departmentId: string) {
  await requireAdmin();

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) return;

  const userCount = await prisma.user.count({ where: { departmentId } });
  if (userCount > 0) {
    redirect(`/master/company/${department.companyId}/edit?error=department-in-use`);
  }

  await prisma.department.delete({ where: { id: departmentId } });
  revalidatePath(`/master/company/${department.companyId}/edit`);
  redirect(`/master/company/${department.companyId}/edit`);
}
