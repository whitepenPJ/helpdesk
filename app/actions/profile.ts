"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";

export type ProfileFormValues = {
  name: string;
  telephone: string;
};

export type ProfileFormState =
  | {
      errors?: Record<string, string[]>;
      values?: ProfileFormValues;
      success?: boolean;
    }
  | undefined;

// Self-service profile edit — any signed-in user updates their own name and
// telephone. Company/Department are admin-managed only (Master User) — this
// never touches those, nor email/role/status/password — and always targets
// the caller's own id (never a route param), so there's no authorization
// check to get wrong.
export async function updateProfile(_prevState: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const session = await requireUser();

  const name = formData.get("name");
  const telephone = formData.get("telephone");

  const values: ProfileFormValues = {
    name: typeof name === "string" ? name : "",
    telephone: typeof telephone === "string" ? telephone : "",
  };

  const errors: Record<string, string[]> = {};
  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: (name as string).trim(),
      telephone: typeof telephone === "string" && telephone.trim() ? telephone.trim() : null,
    },
  });

  revalidatePath("/profile");
  // The header/sidebar (name, company-scoped counts) live in the shared
  // dashboard layout, not under /profile itself.
  revalidatePath("/dashboard", "layout");

  return { success: true, values };
}

export type ChangePasswordState =
  | {
      errors?: Record<string, string[]>;
      success?: boolean;
    }
  | undefined;

// Self-service password change — only ever targets the caller's own id.
// Only meaningful for Credentials accounts (a null passwordHash means the
// user only ever signs in via Microsoft Entra ID); the modal that calls this
// is itself disabled for those accounts, but re-checked here since a form
// post is a public endpoint, not just whatever the button's state implies.
export async function changePassword(_prevState: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const session = await requireUser();

  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmNewPassword = formData.get("confirmNewPassword");

  const errors: Record<string, string[]> = {};

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    errors.currentPassword = ["Enter your current password."];
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    errors.newPassword = ["Password must be at least 8 characters."];
  }
  if (newPassword !== confirmNewPassword) {
    errors.confirmNewPassword = ["Passwords do not match."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!user?.passwordHash) {
    return { errors: { currentPassword: ["This account doesn't sign in with a password."] } };
  }

  const currentMatches = await bcrypt.compare(currentPassword as string, user.passwordHash);
  if (!currentMatches) {
    return { errors: { currentPassword: ["Current password is incorrect."] } };
  }

  const passwordHash = await bcrypt.hash(newPassword as string, 10);
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });

  return { success: true };
}
