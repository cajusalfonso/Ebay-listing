'use server';

import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { users } from '../../src/db/schema';
import { signIn } from '../../lib/auth';
import { db } from '../../lib/db';

const signupSchema = z.object({
  email: z.string().email('Ungültige Email'),
  password: z.string().min(8, 'Passwort mindestens 8 Zeichen'),
  displayName: z.string().min(1).max(100).optional(),
});

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function signupAction(formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName') ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' };
  }
  const email = parsed.data.email.toLowerCase();

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return { ok: false, error: 'Email ist bereits registriert.' };
  }

  const passwordHash = await hash(parsed.data.password, 12);

  await db.insert(users).values({
    email,
    passwordHash,
    displayName: parsed.data.displayName ?? null,
  });

  // Auto-login after signup
  await signIn('credentials', {
    email,
    password: parsed.data.password,
    redirect: false,
  });

  redirect('/dashboard');
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Email oder Passwort ungültig.' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    return { ok: false, error: 'Login fehlgeschlagen. Prüfe Email + Passwort.' };
  }

  redirect('/dashboard');
}
