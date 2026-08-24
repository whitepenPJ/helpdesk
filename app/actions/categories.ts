"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";

export type StagedMemberInput = { id: string; label: string };

export type CategoryFormState =
  | {
      errors?: Record<string, string[]>;
      values?: {
        name: string;
        isActive: boolean;
        responsibleUsers?: StagedMemberInput[];
        responsibleGroups?: StagedMemberInput[];
      };
    }
  | undefined;

function readFields(formData: FormData) {
  return {
    name: formData.get("name"),
    // Checkbox: present (value "true") only when checked.
    isActive: formData.get("isActive") === "true",
  };
}

// The Create form stages responsible users/groups client-side (no
// categoryId exists yet to attach them to) and carries each staged list as
// one JSON hidden field — see staged-picker-button.tsx and category-form.tsx.
function parseStagedMembers(formData: FormData, key: string): StagedMemberInput[] {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is StagedMemberInput => m && typeof m === "object" && typeof m.id === "string");
  } catch {
    return [];
  }
}

export async function createCategory(_prevState: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  await requireAdmin();

  const { name, isActive } = readFields(formData);
  const responsibleUsers = parseStagedMembers(formData, "responsibleUsers");
  const responsibleGroups = parseStagedMembers(formData, "responsibleGroups");
  const values = { name: typeof name === "string" ? name : "", isActive, responsibleUsers, responsibleGroups };
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

  const categoryId = randomUUID();
  const now = new Date();
  await prisma.$transaction([
    prisma.category.create({
      data: { id: categoryId, name: (name as string).trim(), isActive, updatedAt: now },
    }),
    ...(responsibleUsers.length
      ? [
          prisma.categoryAdmin.createMany({
            data: responsibleUsers.map((u) => ({ id: randomUUID(), categoryId, adminId: u.id })),
          }),
        ]
      : []),
    ...(responsibleGroups.length
      ? [
          prisma.categoryUserGroup.createMany({
            data: responsibleGroups.map((g) => ({ id: randomUUID(), categoryId, userGroupId: g.id })),
          }),
        ]
      : []),
  ]);

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
  const responsibleUsers = parseStagedMembers(formData, "responsibleUsers");
  const responsibleGroups = parseStagedMembers(formData, "responsibleGroups");
  const values = { name: typeof name === "string" ? name : "", isActive, responsibleUsers, responsibleGroups };
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

  const now = new Date();
  await prisma.$transaction([
    prisma.category.update({
      where: { id },
      data: { name: (name as string).trim(), isActive, updatedAt: now },
    }),
    // Replace wholesale to match the staged lists exactly, same simplicity
    // trade-off as the ticket assignment reconciliation elsewhere in this
    // app: delete everything for this category, recreate from what's staged.
    prisma.categoryAdmin.deleteMany({ where: { categoryId: id } }),
    prisma.categoryUserGroup.deleteMany({ where: { categoryId: id } }),
    ...(responsibleUsers.length
      ? [
          prisma.categoryAdmin.createMany({
            data: responsibleUsers.map((u) => ({ id: randomUUID(), categoryId: id, adminId: u.id })),
          }),
        ]
      : []),
    ...(responsibleGroups.length
      ? [
          prisma.categoryUserGroup.createMany({
            data: responsibleGroups.map((g) => ({ id: randomUUID(), categoryId: id, userGroupId: g.id })),
          }),
        ]
      : []),
  ]);

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

export async function removeCategoryUserGroup(categoryId: string, userGroupId: string) {
  await requireAdmin();

  await prisma.categoryUserGroup.deleteMany({ where: { categoryId, userGroupId } });
  revalidatePath(`/master/category/${categoryId}/edit`);
}
