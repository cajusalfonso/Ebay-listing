'use server';

import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { userCredentials } from '../../../src/db/schema';
import { encrypt, decrypt } from '../../../src/lib/encryption';
import { createUserTokenStore } from '../../../src/modules/ebay/userTokenStore';
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

  // Check if row already exists — determines INSERT vs partial UPDATE.
  const existing = await db
    .select()
    .from(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.ebayEnv, data.ebayEnv)))
    .limit(1);

  const updatedLabels: string[] = [];
  const isNew = existing.length === 0;

  if (isNew) {
    const toInsert = {
      userId,
      ebayEnv: data.ebayEnv,
      ebayAppIdEncrypted: enc(key, data.ebayAppId),
      ebayCertIdEncrypted: enc(key, data.ebayCertId),
      ebayDevIdEncrypted: enc(key, data.ebayDevId),
      ebayRedirectUriName: data.ebayRedirectUriName || null,
      icecatUserEncrypted: enc(key, data.icecatUser),
      icecatPasswordEncrypted: enc(key, data.icecatPassword),
      discordWebhookUrlEncrypted: enc(key, data.discordWebhookUrl),
      merchantLocationKey: data.merchantLocationKey || null,
    };
    await db.insert(userCredentials).values(toInsert);

    if (toInsert.ebayAppIdEncrypted) updatedLabels.push('App ID');
    if (toInsert.ebayCertIdEncrypted) updatedLabels.push('Cert ID');
    if (toInsert.ebayDevIdEncrypted) updatedLabels.push('Dev ID');
    if (toInsert.ebayRedirectUriName) updatedLabels.push('RuName');
    if (toInsert.merchantLocationKey) updatedLabels.push('Location Key');
    if (toInsert.icecatUserEncrypted) updatedLabels.push('Icecat User');
    if (toInsert.icecatPasswordEncrypted) updatedLabels.push('Icecat Password');
    if (toInsert.discordWebhookUrlEncrypted) updatedLabels.push('Discord Webhook');
  } else {
    // UPDATE: only set fields where the user provided a new value.
    // Empty input means "keep existing" (matches the "Leerlassen zum Beibehalten" placeholder).
    const updateSet: Record<string, unknown> = {};

    const newAppId = enc(key, data.ebayAppId);
    if (newAppId) {
      updateSet.ebayAppIdEncrypted = newAppId;
      updatedLabels.push('App ID');
    }
    const newCertId = enc(key, data.ebayCertId);
    if (newCertId) {
      updateSet.ebayCertIdEncrypted = newCertId;
      updatedLabels.push('Cert ID');
    }
    const newDevId = enc(key, data.ebayDevId);
    if (newDevId) {
      updateSet.ebayDevIdEncrypted = newDevId;
      updatedLabels.push('Dev ID');
    }
    const newIcecatUser = enc(key, data.icecatUser);
    if (newIcecatUser) {
      updateSet.icecatUserEncrypted = newIcecatUser;
      updatedLabels.push('Icecat User');
    }
    const newIcecatPassword = enc(key, data.icecatPassword);
    if (newIcecatPassword) {
      updateSet.icecatPasswordEncrypted = newIcecatPassword;
      updatedLabels.push('Icecat Password');
    }
    const newDiscord = enc(key, data.discordWebhookUrl);
    if (newDiscord) {
      updateSet.discordWebhookUrlEncrypted = newDiscord;
      updatedLabels.push('Discord Webhook');
    }
    // Plain-text fields: always update (the form pre-populates them with existing
    // value via defaultValue, so an empty submit means the user explicitly cleared).
    if (data.ebayRedirectUriName !== undefined) {
      const v = data.ebayRedirectUriName || null;
      if (v !== existing[0]!.ebayRedirectUriName) {
        updateSet.ebayRedirectUriName = v;
        updatedLabels.push('RuName');
      }
    }
    if (data.merchantLocationKey !== undefined) {
      const v = data.merchantLocationKey || null;
      if (v !== existing[0]!.merchantLocationKey) {
        updateSet.merchantLocationKey = v;
        updatedLabels.push('Location Key');
      }
    }

    if (Object.keys(updateSet).length > 0) {
      await db
        .update(userCredentials)
        .set(updateSet)
        .where(and(eq(userCredentials.userId, userId), eq(userCredentials.ebayEnv, data.ebayEnv)));
    }
  }

  revalidatePath('/settings');

  if (updatedLabels.length === 0) {
    return { ok: true, message: 'Keine Änderungen — alle Felder leer gelassen.' };
  }
  return {
    ok: true,
    message: `Gespeichert: ${updatedLabels.join(', ')} (AES-256-GCM verschlüsselt).`,
  };
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

/**
 * Escape hatch for eBay OAuth setup issues. Lets the user paste tokens
 * generated manually via developer.ebay.com's "Get a User Token Here" page
 * (OAuth flow), bypassing our own connect/callback roundtrip. Useful when
 * the RuName's OAuth redirect URL refuses to persist in eBay's portal.
 *
 * Access tokens live 2h on Sandbox, refresh tokens live 18 months. We use
 * those as defaults if the user doesn't provide explicit expiry times.
 */
const manualTokensSchema = z.object({
  ebayEnv: z.enum(['sandbox', 'production']),
  accessToken: z.string().trim().min(20, 'Access Token zu kurz.'),
  refreshToken: z.string().trim().min(20, 'Refresh Token zu kurz.'),
  accessTokenExpiresInSeconds: z.coerce.number().int().positive().optional(),
  refreshTokenExpiresInSeconds: z.coerce.number().int().positive().optional(),
});

export async function importManualEbayTokensAction(
  formData: FormData
): Promise<CredentialsSaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Nicht eingeloggt.' };
  const userId = Number.parseInt(session.user.id, 10);

  const parsed = manualTokensSchema.safeParse({
    ebayEnv: formData.get('ebayEnv'),
    accessToken: formData.get('accessToken'),
    refreshToken: formData.get('refreshToken'),
    accessTokenExpiresInSeconds: formData.get('accessTokenExpiresInSeconds') || undefined,
    refreshTokenExpiresInSeconds: formData.get('refreshTokenExpiresInSeconds') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' };
  }

  const accessExpiresInSec = parsed.data.accessTokenExpiresInSeconds ?? 7200; // 2h default
  const refreshExpiresInSec = parsed.data.refreshTokenExpiresInSeconds ?? 60 * 60 * 24 * 547; // 18mo default
  const now = Date.now();

  const key = getEncryptionKey();
  const store = createUserTokenStore(db, userId, key);
  await store.save(parsed.data.ebayEnv, {
    accessToken: parsed.data.accessToken,
    refreshToken: parsed.data.refreshToken,
    accessTokenExpiresAt: new Date(now + accessExpiresInSec * 1000),
    refreshTokenExpiresAt: new Date(now + refreshExpiresInSec * 1000),
  });

  revalidatePath('/settings');
  return {
    ok: true,
    message: `Tokens gespeichert (${parsed.data.ebayEnv}). Access gültig ${Math.floor(accessExpiresInSec / 60)} min, Refresh ${Math.floor(refreshExpiresInSec / 86400)} Tage.`,
  };
}

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
