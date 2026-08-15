"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export type LoginFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      formError?: string;
      email?: string;
      remember?: boolean;
    }
  | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only allow same-site relative paths — an unvalidated callbackUrl would be
// an open-redirect vector (e.g. "https://evil.example"). "/" isn't a real
// page in this app (see proxy.ts), so treat it the same as no callback.
function safeRedirectTarget(callbackUrl: FormDataEntryValue | null): string {
  if (
    typeof callbackUrl === "string" &&
    callbackUrl.startsWith("/") &&
    !callbackUrl.startsWith("//") &&
    callbackUrl !== "/"
  ) {
    return callbackUrl;
  }
  return "/dashboard";
}

export async function login(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = safeRedirectTarget(formData.get("callbackUrl"));
  const remember = formData.get("remember") === "on";
  const emailValue = typeof email === "string" ? email : undefined;

  const errors: NonNullable<LoginFormState>["errors"] = {};

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    errors.email = ["Enter a valid email address."];
  }
  if (typeof password !== "string" || password.length === 0) {
    errors.password = ["Enter your password."];
  }

  if (Object.keys(errors).length > 0) {
    return { errors, email: emailValue, remember };
  }

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { formError: "Incorrect email or password.", email: emailValue, remember };
        default:
          return {
            formError: "Something went wrong signing you in. Please try again.",
            email: emailValue,
            remember,
          };
      }
    }
    throw error;
  }
}

export async function loginWithMicrosoft(formData: FormData) {
  const redirectTo = safeRedirectTarget(formData.get("callbackUrl"));
  await signIn("microsoft-entra-id", { redirectTo });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
