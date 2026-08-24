import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // `newUser` only ever fires for OAuth/OIDC (and email/webauthn, unused
  // here) sign-ins that just created a brand-new User row — Credentials
  // sign-ins go through a separate code path in @auth/core that never
  // computes/consults `isNewUser`, so this only affects a first-time
  // Microsoft Entra ID ("365") login, sending them to fill in their profile
  // (telephone/company/department, which an OAuth signup never collects).
  pages: { signIn: "/login", newUser: "/profile" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || user.status !== "ACTIVE") {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      // "organizations" accepts any Microsoft work/school account from any
      // Azure AD tenant (not just one specific tenant, and not personal
      // Microsoft accounts — that would be "common"). The App Registration
      // itself must also be switched to multi-tenant in Azure Portal
      // (Authentication > Supported account types), or Microsoft still
      // rejects the sign-in before this even matters.
      issuer: "https://login.microsoftonline.com/organizations/v2.0",
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});
