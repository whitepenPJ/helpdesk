"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/dal";
import { saveAttachments } from "@/app/lib/attachments";
import { stripHtml } from "@/app/lib/text";

export type LessonLearnedFormValues = {
  title: string;
  description: string;
  isActive: boolean;
};

export type LessonLearnedFormState =
  | {
      errors?: Record<string, string[]>;
      values?: LessonLearnedFormValues;
    }
  | undefined;

function readCommonFields(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    // Checkbox: present (value "true") only when checked, absent when
    // unchecked — there's no invalid state to validate against.
    isActive: formData.get("isActive") === "true",
  };
}

function toFormValues(fields: ReturnType<typeof readCommonFields>): LessonLearnedFormValues {
  return {
    title: typeof fields.title === "string" ? fields.title : "",
    description: typeof fields.description === "string" ? fields.description : "",
    isActive: fields.isActive,
  };
}

function validate(fields: ReturnType<typeof readCommonFields>): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (typeof fields.title !== "string" || fields.title.trim().length === 0) {
    errors.title = ["Enter a title."];
  }
  if (typeof fields.description !== "string" || stripHtml(fields.description).length === 0) {
    errors.description = ["Enter a description."];
  }
  return errors;
}

function stringValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string");
}

function fileValues(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((f) => f instanceof File) as File[];
}

export async function createLessonLearned(
  _prevState: LessonLearnedFormState,
  formData: FormData
): Promise<LessonLearnedFormState> {
  const session = await requireAdmin();

  const fields = readCommonFields(formData);
  const values = toFormValues(fields);
  const errors = validate(fields);
  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const id = randomUUID();
  const [newImages, newAttachments] = await Promise.all([
    saveAttachments("lesson-learned-images", id, fileValues(formData, "images")),
    saveAttachments("lesson-learned-attachments", id, fileValues(formData, "attachments")),
  ]);

  await prisma.lessonLearned.create({
    data: {
      id,
      title: (fields.title as string).trim(),
      description: fields.description as string,
      images: newImages,
      attachments: newAttachments,
      isActive: fields.isActive,
      createdById: session.user.id,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/master/lesson-learned");
  redirect("/master/lesson-learned");
}

export async function updateLessonLearned(
  id: string,
  _prevState: LessonLearnedFormState,
  formData: FormData
): Promise<LessonLearnedFormState> {
  await requireAdmin();

  const fields = readCommonFields(formData);
  const values = toFormValues(fields);
  const errors = validate(fields);
  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const [newImages, newAttachments] = await Promise.all([
    saveAttachments("lesson-learned-images", id, fileValues(formData, "images")),
    saveAttachments("lesson-learned-attachments", id, fileValues(formData, "attachments")),
  ]);

  await prisma.lessonLearned.update({
    where: { id },
    data: {
      title: (fields.title as string).trim(),
      description: fields.description as string,
      images: [...stringValues(formData, "imagesExisting"), ...newImages],
      attachments: [...stringValues(formData, "attachmentsExisting"), ...newAttachments],
      isActive: fields.isActive,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/master/lesson-learned");
  redirect("/master/lesson-learned");
}

export async function deleteLessonLearned(id: string) {
  await requireAdmin();

  await prisma.lessonLearned.delete({ where: { id } });
  revalidatePath("/master/lesson-learned");
  redirect("/master/lesson-learned");
}
