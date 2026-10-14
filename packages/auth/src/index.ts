import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { UserRole } from "@schoolos/types";
import type { SessionUser } from "@schoolos/types";
import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }

  interface User extends SessionUser {}
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).trim().toLowerCase();
        const password = credentials.password as string;

        // Minimum password length of 8 characters
        if (password.length < 8) return null;

        const ip =
          (request as any)?.headers
            ?.get?.("x-forwarded-for")
            ?.split(",")[0]
            ?.trim() || "127.0.0.1";

        const ipAllowed = checkRateLimit(
          `auth:login:ip:${ip}`,
          15,
          15 * 60 * 1000,
        );
        const emailAllowed = checkRateLimit(
          `auth:login:email:${email}`,
          5,
          15 * 60 * 1000,
        );

        if (!ipAllowed || !emailAllowed) {
          throw new Error(
            "Too many login attempts. Please try again in 15 minutes.",
          );
        }

        const { prisma } = await import("@schoolos/db");
        const user = await prisma.user.findUnique({
          where: { email },
          include: { school: true },
        });

        if (!user || !user.isActive) return null;
        if (user.school && !user.school.isActive) return null;

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) return null;

        loginAttempts.delete(`auth:login:email:${email}`);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Prisma's generated UserRole enum and @schoolos/types's UserRole
          // are structurally identical but nominally distinct types.
          role: user.role as unknown as UserRole,
          schoolId: user.schoolId,
          image: user.image,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.schoolId = user.schoolId;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.lastChecked = Date.now();
        token.issuedAt = Date.now();
      }

      if (!token.id) return token;

      const now = Date.now();
      const lastChecked = (token.lastChecked as number) || 0;
      // Re-read user and school status from DB every 2 minutes or on manual update (A6)
      if (trigger === "update" || now - lastChecked > 2 * 60 * 1000) {
        try {
          const { prisma } = await import("@schoolos/db");
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              isActive: true,
              role: true,
              schoolId: true,
              passwordChangedAt: true,
              mustChangePassword: true,
              school: { select: { isActive: true } },
            },
          });

          if (!dbUser || !dbUser.isActive) {
            token.invalid = true;
            delete token.id;
            return token;
          }

          if (dbUser.school && !dbUser.school.isActive) {
            token.invalid = true;
            delete token.id;
            return token;
          }

          if (
            dbUser.passwordChangedAt &&
            token.issuedAt &&
            dbUser.passwordChangedAt.getTime() > (token.issuedAt as number)
          ) {
            token.invalid = true;
            delete token.id;
            return token;
          }

          token.role = dbUser.role;
          token.schoolId = dbUser.schoolId;
          token.mustChangePassword = dbUser.mustChangePassword;
          token.lastChecked = now;
        } catch {
          // Allow cached token if DB is temporarily unreachable
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.invalid || !token.id) {
        return {
          ...session,
          user: null as any,
        };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.schoolId = token.schoolId as string | null;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days (reduced from default 30 days)
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export { UserRole };
