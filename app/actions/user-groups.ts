"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";

export type UserGroupFormState =
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

export async function createUserGroup(
  _prevState: UserGroupFormState,
  formData: FormData
): Promise<UserGroupFormState> {
  await requireAdmin();

  const { name, isActive } = readFields(formData);
  const values = { name: typeof name === "string" ? name : "", isActive };
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a group name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const existing = await prisma.userGroup.findUnique({ where: { name: (name as string).trim() } });
  if (existing) {
    return { errors: { name: ["A user group with this name already exists."] }, values };
  }

  await prisma.userGroup.create({
    data: {
      id: randomUUID(),
      name: (name as string).trim(),
      isActive,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/master/user-group");
  redirect("/master/user-group");
}

export async function updateUserGroup(
  id: string,
  _prevState: UserGroupFormState,
  formData: FormData
): Promise<UserGroupFormState> {
  await requireAdmin();

  const { name, isActive } = readFields(formData);
  const values = { name: typeof name === "string" ? name : "", isActive };
  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a group name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const existing = await prisma.userGroup.findUnique({ where: { name: (name as string).trim() } });
  if (existing && existing.id !== id) {
    return { errors: { name: ["A user group with this name already exists."] }, values };
  }

  await prisma.userGroup.update({
    where: { id },
    data: {
      name: (name as string).trim(),
      isActive,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/master/user-group");
  redirect("/master/user-group");
}

export async function deleteUserGroup(id: string) {
  await requireAdmin();

  const [userCount, ticketCount] = await Promise.all([
    prisma.user.count({ where: { userGroupId: id } }),
    prisma.ticket.count({ where: { assignedGroupId: id } }),
  ]);

  if (userCount > 0 || ticketCount > 0) {
    redirect("/master/user-group?error=group-in-use");
  }

  await prisma.userGroup.delete({ where: { id } });
  revalidatePath("/master/user-group");
  redirect("/master/user-group");
}

export type AddGroupMemberState =
  | {
      errors?: Record<string, string[]>;
      success?: boolean;
    }
  | undefined;

export async function addUserToGroup(
  groupId: string,
  _prevState: AddGroupMemberState,
  formData: FormData
): Promise<AddGroupMemberState> {
  await requireAdmin();

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) {
    return { errors: { userId: ["Select a user."] } };
  }

  await prisma.user.update({ where: { id: userId }, data: { userGroupId: groupId } });

  revalidatePath(`/master/user-group/${groupId}/edit`);
  return { success: true };
}

export async function removeUserFromGroup(groupId: string, userId: string) {
  await requireAdmin();

  await prisma.user.updateMany({ where: { id: userId, userGroupId: groupId }, data: { userGroupId: null } });
  revalidatePath(`/master/user-group/${groupId}/edit`);
}
