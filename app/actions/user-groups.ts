"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { isNonEmptyString } from "@/app/lib/text";

export type StagedMemberInput = { id: string; label: string };

export type UserGroupFormState =
  | {
      errors?: Record<string, string[]>;
      values?: { name: string; isActive: boolean; members?: StagedMemberInput[] };
    }
  | undefined;

function readFields(formData: FormData) {
  return {
    name: formData.get("name"),
    // Checkbox: present (value "true") only when checked.
    isActive: formData.get("isActive") === "true",
  };
}

// The Create form stages members client-side (no groupId exists yet to
// attach them to) and carries the whole staged list as one JSON hidden
// field — see staged-picker-button.tsx and user-group-form.tsx.
function parseStagedMembers(formData: FormData): StagedMemberInput[] {
  const raw = formData.get("members");
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is StagedMemberInput => m && typeof m === "object" && typeof m.id === "string");
  } catch {
    return [];
  }
}

export async function createUserGroup(
  _prevState: UserGroupFormState,
  formData: FormData
): Promise<UserGroupFormState> {
  await requireAdmin();

  const { name, isActive } = readFields(formData);
  const members = parseStagedMembers(formData);
  const values = { name: typeof name === "string" ? name : "", isActive, members };
  const errors: Record<string, string[]> = {};

  if (!isNonEmptyString(name)) {
    errors.name = ["Enter a group name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const existing = await prisma.userGroup.findUnique({ where: { name: (name as string).trim() } });
  if (existing) {
    return { errors: { name: ["A user group with this name already exists."] }, values };
  }

  const memberIds = members.map((m) => m.id);
  const groupId = randomUUID();
  const now = new Date();
  await prisma.$transaction([
    prisma.userGroup.create({
      data: { id: groupId, name: (name as string).trim(), isActive, updatedAt: now },
    }),
    ...(memberIds.length
      ? [
          prisma.userGroupMember.createMany({
            data: memberIds.map((userId) => ({ id: randomUUID(), userGroupId: groupId, userId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

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
  const members = parseStagedMembers(formData);
  const values = { name: typeof name === "string" ? name : "", isActive, members };
  const errors: Record<string, string[]> = {};

  if (!isNonEmptyString(name)) {
    errors.name = ["Enter a group name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const existing = await prisma.userGroup.findUnique({ where: { name: (name as string).trim() } });
  if (existing && existing.id !== id) {
    return { errors: { name: ["A user group with this name already exists."] }, values };
  }

  const memberIds = members.map((m) => m.id);
  const now = new Date();
  await prisma.$transaction([
    prisma.userGroup.update({
      where: { id },
      data: { name: (name as string).trim(), isActive, updatedAt: now },
    }),
    // Replace membership wholesale to match the staged list exactly: drop
    // every current row, then re-add the staged set.
    prisma.userGroupMember.deleteMany({ where: { userGroupId: id } }),
    ...(memberIds.length
      ? [
          prisma.userGroupMember.createMany({
            data: memberIds.map((userId) => ({ id: randomUUID(), userGroupId: id, userId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  revalidatePath("/master/user-group");
  redirect("/master/user-group");
}

export async function deleteUserGroup(id: string) {
  await requireAdmin();

  const [userCount, ticketCount] = await Promise.all([
    prisma.userGroupMember.count({ where: { userGroupId: id } }),
    prisma.ticketAssignedGroup.count({ where: { userGroupId: id } }),
  ]);

  if (userCount > 0 || ticketCount > 0) {
    redirect("/master/user-group?error=group-in-use");
  }

  await prisma.userGroup.delete({ where: { id } });
  revalidatePath("/master/user-group");
  redirect("/master/user-group");
}
