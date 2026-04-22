'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { gpsrManufacturerOverrides } from '../../../src/db/schema';

const gpsrSchema = z.object({
  brand: z.string().trim().min(1, 'Brand-Name fehlt').max(100),
  name: z.string().trim().max(200).optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  email: z.string().trim().email('Ungültige Email').optional().or(z.literal('')),
});

export interface GpsrActionResult {
  ok: boolean;
  error?: string;
}

export async function upsertGpsrOverrideAction(formData: FormData): Promise<GpsrActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Nicht eingeloggt.' };

  const parsed = gpsrSchema.safeParse({
    brand: formData.get('brand'),
    name: formData.get('name'),
    address: formData.get('address'),
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' };
  }

  const { brand, name, address, email } = parsed.data;

  await db
    .insert(gpsrManufacturerOverrides)
    .values({
      brand,
      name: name || null,
      address: address || null,
      email: email || null,
    })
    .onConflictDoUpdate({
      target: gpsrManufacturerOverrides.brand,
      set: {
        name: name || null,
        address: address || null,
        email: email || null,
      },
    });

  revalidatePath('/settings');
  return { ok: true };
}

export async function deleteGpsrOverrideAction(formData: FormData): Promise<GpsrActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Nicht eingeloggt.' };

  const brand = String(formData.get('brand') ?? '').trim();
  if (!brand) return { ok: false, error: 'Brand fehlt.' };

  await db.delete(gpsrManufacturerOverrides).where(eq(gpsrManufacturerOverrides.brand, brand));
  revalidatePath('/settings');
  return { ok: true };
}

export interface GpsrOverrideRow {
  brand: string;
  name: string | null;
  address: string | null;
  email: string | null;
}

export async function listGpsrOverrides(): Promise<GpsrOverrideRow[]> {
  const rows = await db
    .select({
      brand: gpsrManufacturerOverrides.brand,
      name: gpsrManufacturerOverrides.name,
      address: gpsrManufacturerOverrides.address,
      email: gpsrManufacturerOverrides.email,
    })
    .from(gpsrManufacturerOverrides)
    .orderBy(gpsrManufacturerOverrides.brand);
  return rows;
}
