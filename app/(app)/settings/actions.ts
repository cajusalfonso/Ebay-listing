'use server';

import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { userCredentials } from '../../../src/db/schema';
import { encrypt, decrypt } from '../../../src/lib/encryption';
import { auth } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { getEncryptionKey } from '../../../lib/encryption-key';

const credentialsSchema = z.object({
  ebayEnv: z.enum(['sandbox', 'production']),
  ebayAppId: z.string().trim().min(1).optional().or(z.literal('')),
  ebayCertId: z.string().trim().min(1).optional().or(z.literal('')),
  ebayDevId: z.string().trim().min(1).optional().or(z.literal('')),
  ebayRedirectUriName: z.string().trim().optional().or(z.literal('')),
  icecatUser: z.string().trim().optional().or(z.literal('')),
  icecatPassword: z.string().trim().optional().or(z.literal('')),
  discordWebhookUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || v.startsWith('https://discord.com/api/webhooks/'),
      'Discord-Webhook-URL muss mit https://discord.com/api/webhooks/ beginnen.'
    ),
  merchantLocationKey: z.string().trim().optional().or(z.literal('')),
});

export interface CredentialsSaveResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function enc(key: Buffer, value: string | undefined): string | null {
  if (!value || value.trim() === '') return null;
  return encrypt(value.trim(), key);
}

export async function saveCredentialsAction(
  formData: FormData
): Promise<CredentialsSaveResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: 'Nicht eingeloggt.' };
  }
  const userId = Number.parseInt(session.user.id, 10);

  const parsed = credentialsSchema.safeParse({
    ebayEnv: formData.get('ebayEnv'),
    ebayAppId: formData.get('ebayAppId') ?? '',
    ebayCertId: formData.get('ebayCertId') ?? '',
    ebayDevId: formData.get('ebayDevId') ?? '',
    ebayRedirectUriName: formData.get('ebayRedirectUriName') ?? '',
    icecatUser: formData.get('icecatUser') ?? '',
    icecatPassword: formData.get('icecatPassword') ?? '',
    discordWebhookUrl: formData.get('discordWebhookUrl') ?? '',
    merchantLocationKey: formData.get('merchantLocationKey') ?? '',
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' };
  }

  const key = getEncryptionKey();
  const data = parsed.data;

  const toInsert = {
    userId,
    ebayEnv: data.ebayEnv,
    ebayAppIdEncrypted: enc(key, data.ebayAppId),
    ebayCertIdEncrypted: enc(key, data.ebayCertId),
    ebayDevIdEncrypted: enc(key, data.ebayDevId),
    ebayRedirectUriName: data.ebayRedirectUriName ?? null,
    icecatUserEncrypted: enc(key, data.icecatUser),
    icecatPasswordEncrypted: enc(key, data.icecatPassword),
    discordWebhookUrlEncrypted: enc(key, data.discordWebhookUrl),
    merchantLocationKey: data.merchantLocationKey ?? null,
  };

  await db
    .insert(userCredentials)
    .values(toInsert)
    .onConflictDoUpdate({
      target: [userCredentials.userId, userCredentials.ebayEnv],
      set: {
        ebayAppIdEncrypted: toInsert.ebayAppIdEncrypted,
        ebayCertIdEncrypted: toInsert.ebayCertIdEncrypted,
        ebayDevIdEncrypted: toInsert.ebayDevIdEncrypted,
        ebayRedirectUriName: toInsert.ebayRedirectUriName,
        icecatUserEncrypted: toInsert.icecatUserEncrypted,
        icecatPasswordEncrypted: toInsert.icecatPasswordEncrypted,
        discordWebhookUrlEncrypted: toInsert.discordWebhookUrlEncrypted,
        merchantLocationKey: toInsert.merchantLocationKey,
      },
    });

  revalidatePath('/settings');
  return { ok: true, message: 'Credentials gespeichert (AES-256-GCM verschlüsselt).' };
}

export async function getCredentialsMaskedForUser(
  ebayEnv: 'sandbox' | 'production'
): Promise<{
  hasEbayAppId: boolean;
  hasEbayCertId: boolean;
  hasEbayDevId: boolean;
  hasIcecatUser: boolean;
  hasIcecatPassword: boolean;
  hasDiscordWebhook: boolean;
  ebayRedirectUriName: string;
  merchantLocationKey: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = Number.parseInt(session.user.id, 10);

  const rows = await db
    .select()
    .from(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.ebayEnv, ebayEnv)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return {
      hasEbayAppId: false,
      hasEbayCertId: false,
      hasEbayDevId: false,
      hasIcecatUser: false,
      hasIcecatPassword: false,
      hasDiscordWebhook: false,
      ebayRedirectUriName: '',
      merchantLocationKey: '',
    };
  }
  return {
    hasEbayAppId: row.ebayAppIdEncrypted !== null,
    hasEbayCertId: row.ebayCertIdEncrypted !== null,
    hasEbayDevId: row.ebayDevIdEncrypted !== null,
    hasIcecatUser: row.icecatUserEncrypted !== null,
    hasIcecatPassword: row.icecatPasswordEncrypted !== null,
    hasDiscordWebhook: row.discordWebhookUrlEncrypted !== null,
    ebayRedirectUriName: row.ebayRedirectUriName ?? '',
    merchantLocationKey: row.merchantLocationKey ?? '',
  };
}

export type RevealableField =
  | 'ebayAppId'
  | 'ebayCertId'
  | 'ebayDevId'
  | 'icecatUser'
  | 'icecatPassword'
  | 'discordWebhookUrl';

const FIELD_TO_COLUMN: Record<RevealableField, keyof typeof userCredentials.$inferSelect> = {
  ebayAppId: 'ebayAppIdEncrypted',
  ebayCertId: 'ebayCertIdEncrypted',
  ebayDevId: 'ebayDevIdEncrypted',
  icecatUser: 'icecatUserEncrypted',
  icecatPassword: 'icecatPasswordEncrypted',
  discordWebhookUrl: 'discordWebhookUrlEncrypted',
};

export async function revealCredentialAction(
  ebayEnv: 'sandbox' | 'production',
  field: RevealableField
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Nicht eingeloggt.' };
  const userId = Number.parseInt(session.user.id, 10);

  const rows = await db
    .select()
    .from(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.ebayEnv, ebayEnv)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, error: 'Keine Credentials gespeichert.' };

  const column = FIELD_TO_COLUMN[field];
  const encrypted = row[column] as string | null;
  if (!encrypted) return { ok: false, error: 'Feld ist leer.' };

  try {
    const key = getEncryptionKey();
    const plain = decrypt(encrypted, key);
    return { ok: true, value: plain };
  } catch {
    return { ok: false, error: 'Entschlüsselung fehlgeschlagen.' };
  }
}
