import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { users } from '../src/db/schema';
import { db } from './db';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * Auth.js v5 configuration.
 * - Credentials provider with bcrypt-hashed passwords
 * - JWT sessions (no DB session table needed — sessions table kept for
 *   future toggle to database sessions)
 * - `user.id` flows into the session so server actions can scope queries
 *   to the authenticated tenant.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const rows = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email.toLowerCase()))
          .limit(1);
        const user = rows[0];
        if (!user) return null;

        const ok = await compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        return {
          id: String(user.id),
          email: user.email,
          name: user.displayName ?? user.email,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
