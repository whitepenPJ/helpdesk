import "server-only";
import { randomBytes, createHash } from "node:crypto";

const TOKEN_PREFIX = "hd_";

export function generateApiToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

// A personal access token has high entropy by construction (unlike a
// user-chosen password), so a plain fast hash — not bcrypt — is the right
// tool here: verification needs to be cheap on every request, and there's
// nothing to protect against offline guessing the way there is for passwords.
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
