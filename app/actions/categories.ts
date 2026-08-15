"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";

export type CategoryFormState =
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

export async function createCategory(_prevState: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  await requireAdmin();

  const { name, isActive } = readFields(formData);
  const values = { name: typeof name === "string" ? name : "", isActive };
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a category name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const existing = await prisma.category.findUnique({ where: { name: (name as string).trim() } });
  if (existing) {
    return { errors: { name: ["A category with this name already exists."] }, values };
  }

  await prisma.category.create({
    data: {
      id: randomUUID(),
      name: (name as string).trim(),
      isActive,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/master/category");
  redirect("/master/category");
}

export async function updateCategory(
  id: string,
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireAdmin();

  const { name, isActive } = readFields(formData);
  const values = { name: typeof name === "string" ? name : "", isActive };
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a category name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const existing = await prisma.category.findUnique({ where: { name: (name as string).trim() } });
  if (existing && existing.id !== id) {
    return { errors: { name: ["A category with this name already exists."] }, values };
  }

  await prisma.category.update({
    where: { id },
    data: {
      name: (name as string).trim(),
      isActive,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/master/category");
  redirect("/master/category");
}

export async function deleteCategory(id: string) {
  await requireAdmin();

  const ticketCount = await prisma.ticket.count({ where: { categoryId: id } });
  if (ticketCount > 0) {
    redirect("/master/category?error=category-in-use");
  }

  // CategoryAdmin rows cascade-delete at the DB level (onDelete: Cascade).
  await prisma.category.delete({ where: { id } });
  revalidatePath("/master/category");
  redirect("/master/category");
}

export type AddCategoryAdminState =
  | {
      errors?: Record<string, string[]>;
      success?: boolean;
    }
  | undefined;

export async function addCategoryAdmin(
  categoryId: string,
  _prevState: AddCategoryAdminState,
  formData: FormData
): Promise<AddCategoryAdminState> {
  await requireAdmin();

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) {
    return { errors: { userId: ["Select a user."] } };
  }

  const existing = await prisma.categoryAdmin.findUnique({
    where: { categoryId_adminId: { categoryId, adminId: userId } },
  });
  if (existing) {
    return { errors: { userId: ["This user is already responsible for this category."] } };
  }

  await prisma.categoryAdmin.create({
    data: { id: randomUUID(), categoryId, adminId: userId },
  });

  revalidatePath(`/master/category/${categoryId}/edit`);
  return { success: true };
}

export async function removeCategoryAdmin(categoryId: string, userId: string) {
  await requireAdmin();

  await prisma.categoryAdmin.deleteMany({ where: { categoryId, adminId: userId } });
  revalidatePath(`/master/category/${categoryId}/edit`);
}
