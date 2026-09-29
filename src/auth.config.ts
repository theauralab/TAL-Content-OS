import type { NextAuthConfig } from "next-auth";

// Edge-safe: no Prisma, no bcrypt. Used by middleware.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.organizationId = (user as any).organizationId;
        token.role = (user as any).role;
        token.clientId = (user as any).clientId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).role = token.role;
        (session.user as any).clientId = token.clientId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
