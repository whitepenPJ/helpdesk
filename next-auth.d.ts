import type { DefaultSession } from "next-auth";
import type { Role } from "@/app/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

// @auth/core's own callback types import JWT from "@auth/core/jwt" directly
// (not through the "next-auth/jwt" re-export), so both must be augmented.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
