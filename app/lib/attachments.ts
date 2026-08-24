import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Writes uploaded files to public/uploads/{scope}/{id}/... and returns the
// public paths to store on the owning record's `attachments` column. The
// on-disk filename is sanitized/randomized to be filesystem- and URL-safe,
// but the user's original filename (which may contain spaces, unicode, or
// punctuation the sanitizer strips) is preserved in a `?name=` query
// param so the UI can still show exactly what the user uploaded — see
// `getAttachmentName` below. Query strings don't affect how Next.js
// resolves a static file under public/, so this is free to add.
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
    paths.push(`/uploads/${scope}/${id}/${storedName}?name=${encodeURIComponent(file.name)}`);
  }
  return paths;
}

// Recovers the filename to display for a stored attachment URL: the
// original upload name if present (`?name=`), falling back to the stored
// (sanitized/prefixed) filename for attachments saved before this existed.
export function getAttachmentName(url: string): string {
  const queryIndex = url.indexOf("?");
  const path = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const fallback = path.split("/").pop() ?? url;
  if (queryIndex === -1) return fallback;
  const params = new URLSearchParams(url.slice(queryIndex + 1));
  return params.get("name") ?? fallback;
}
