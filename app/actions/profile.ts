"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { validateDepartmentBelongsToCompany } from "./users";

export type ProfileFormValues = {
  name: string;
  telephone: string;
  companyId: string;
  departmentId: string;
};

export type ProfileFormState =
  | {
      errors?: Record<string, string[]>;
      values?: ProfileFormValues;
      success?: boolean;
    }
  | undefined;

// Self-service profile edit — any signed-in user updates their own name,
// telephone, company, and department. Unlike the admin User form, this never
// touches email/role/status/password, and always targets the caller's own
// id (never a route param), so there's no authorization check to get wrong.
export async function updateProfile(_prevState: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const session = await requireUser();

  const name = formData.get("name");
  const telephone = formData.get("telephone");
  const companyId = formData.get("companyId");
  const departmentId = formData.get("departmentId");

  const values: ProfileFormValues = {
    name: typeof name === "string" ? name : "",
    telephone: typeof telephone === "string" ? telephone : "",
    companyId: typeof companyId === "string" ? companyId : "",
    departmentId: typeof departmentId === "string" ? departmentId : "",
  };

  const errors: Record<string, string[]> = {};
  if (typeof name !== "string" || name.trim().length === 0) {
    errors.name = ["Enter a name."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const companyIdValue = typeof companyId === "string" && companyId ? companyId : null;
  const departmentIdValue = typeof departmentId === "string" && departmentId ? departmentId : null;

  const departmentError = await validateDepartmentBelongsToCompany(companyIdValue, departmentIdValue);
  if (departmentError) {
    return { errors: { departmentId: [departmentError] }, values };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: (name as string).trim(),
      telephone: typeof telephone === "string" && telephone.trim() ? telephone.trim() : null,
      companyId: companyIdValue,
      departmentId: departmentIdValue,
    },
  });

  revalidatePath("/profile");
  // The header/sidebar (name, company-scoped counts) live in the shared
  // dashboard layout, not under /profile itself.
  revalidatePath("/dashboard", "layout");

  return { success: true, values };
}
