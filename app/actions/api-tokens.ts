"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/dal";
import { generateApiToken, hashApiToken } from "@/app/lib/api-tokens";
import { isNonEmptyString } from "@/app/lib/text";

export type CreateApiTokenState =
  | {
      errors?: Record<string, string[]>;
      // Only ever populated immediately after creation — the raw token is
      // never stored, so there's no way to show it again later.
      token?: string;
    }
  | undefined;

export async function createApiToken(
  _prevState: CreateApiTokenState,
  formData: FormData
): Promise<CreateApiTokenState> {
  const session = await requireUser();

  const name = formData.get("name");
  if (!isNonEmptyString(name)) {
    return { errors: { name: ["Enter a name for this token."] } };
  }

  const token = generateApiToken();
  await prisma.apiToken.create({
    data: {
      id: randomUUID(),
      userId: session.user.id,
      name: name.trim(),
      tokenHash: hashApiToken(token),
    },
  });

  revalidatePath("/profile");
  return { token };
}

export async function deleteApiToken(id: string): Promise<void> {
  const session = await requireUser();

  // Scoped to the caller's own id — a user can only ever revoke their own
  // tokens, never someone else's by guessing an id.
  await prisma.apiToken.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/profile");
  redirect("/profile");
}
