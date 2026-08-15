import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Writes uploaded files to public/uploads/{scope}/{id}/... and returns the
// public paths to store on the owning record's `attachments` column.
export async function saveAttachments(scope: string, id: string, files: File[]): Promise<string[]> {
  const validFiles = files.filter((file) => file instanceof File && file.size > 0);
  if (validFiles.length === 0) return [];

  const dir = path.join(process.cwd(), "public", "uploads", scope, id);
  await mkdir(dir, { recursive: true });

  const paths: string[] = [];
  for (const file of validFiles) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${randomUUID().slice(0, 8)}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, storedName), buffer);
    paths.push(`/uploads/${scope}/${id}/${storedName}`);
  }
  return paths;
}
