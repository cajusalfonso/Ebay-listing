import type { FeeRule, PricingSettings, PushThreshold } from './pricing/calc';

/**
 * Alle Einstellungen, die später im Dashboard änderbar sind.
 * Gespeichert als JSON in der Tabelle `settings` (Schlüssel "app").
 * Was dort fehlt, kommt aus diesen Standardwerten.
 */

export interface FeeCategory extends FeeRule {
  id: string;
  name: string;
  /** eBay-Kategorie-IDs, für die dieser Gebührensatz gilt. Leer = Standard. */
  ebayCategoryIds: string[];
}

export interface AppSettings {
  pricing: PricingSettings;
  pushThreshold: PushThreshold;
  fees: { defaultCategoryId: string; categories: FeeCategory[] };
  listing: {
    dailyLimit: number;
    handlingDays: number;
    quantity: number;
    /** eBay-Kategorie-IDs, die nie gelistet werden (Einschränkungen). */
    blockedEbayCategoryIds: string[];
  };
  rules: {
    requireAvailable: boolean;
    requirePrime: boolean;
    maxDeliveryDays: number;
    requireSoldByAmazon: boolean;
    maxPriceAgeHours: number;
    maxConsecutiveErrors: number;
  };
  nightMode: { enabled: boolean; offTime: string; checkTime: string; timezone: string };
  orders: { staleWarnHours: number; reminderHours: number };
}

export const DEFAULT_SETTINGS: AppSettings = {
  pricing: {
    vatRate: 0.19,
    returnBufferPct: 0.03,
    ownShippingNet: 5,
    minProfitNet: 15,
    minMarginPct: 0.1,
    feesIncludeVat: false,
    inputVatDeductible: true,
  },
  pushThreshold: { minAbs: 0.5, minPct: 0.01 },
  fees: {
    defaultCategoryId: 'standard',
    categories: [
      { id: 'standard', name: 'Standard (alle Kategorien)', percent: 0.11, fixed: 0.35, ebayCategoryIds: [] },
    ],
  },
  listing: { dailyLimit: 10, handlingDays: 2, quantity: 1, blockedEbayCategoryIds: [] },
  rules: {
    requireAvailable: true,
    requirePrime: true,
    maxDeliveryDays: 3,
    requireSoldByAmazon: true,
    maxPriceAgeHours: 12,
    maxConsecutiveErrors: 3,
  },
  nightMode: { enabled: true, offTime: '23:00', checkTime: '08:00', timezone: 'Europe/Berlin' },
  orders: { staleWarnHours: 2, reminderHours: 12 },
};

type Plain = Record<string, unknown>;
const isPlainObject = (v: unknown): v is Plain =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Gespeicherte Werte über die Standardwerte legen. Unbekannte oder falsch typisierte Werte werden ignoriert. */
export function mergeSettings<T>(defaults: T, stored: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) return defaults;
  const out: Plain = { ...defaults };
  for (const [key, defVal] of Object.entries(defaults)) {
    const val = stored[key];
    if (val === undefined) continue;
    if (isPlainObject(defVal)) out[key] = mergeSettings(defVal, val);
    else if (Array.isArray(defVal)) out[key] = Array.isArray(val) ? val : defVal;
    else if (typeof val === typeof defVal) out[key] = val;
  }
  return out as T;
}

export function feeRuleFor(settings: AppSettings, ebayCategoryId?: string | null): FeeCategory {
  const cats = settings.fees.categories;
  if (ebayCategoryId) {
    const hit = cats.find((c) => c.ebayCategoryIds.includes(ebayCategoryId));
    if (hit) return hit;
  }
  const def = cats.find((c) => c.id === settings.fees.defaultCategoryId) ?? cats[0];
  if (!def) throw new Error('Keine eBay-Gebührenkategorie konfiguriert.');
  return def;
}

export async function loadSettings(db: D1Database, envMaxPriceAgeHours?: string): Promise<AppSettings> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind('app')
    .first<{ value: string }>();
  const defaults = structuredClone(DEFAULT_SETTINGS);
  const envAge = Number(envMaxPriceAgeHours);
  if (Number.isFinite(envAge) && envAge > 0) defaults.rules.maxPriceAgeHours = envAge;
  if (!row) return defaults;
  try {
    return mergeSettings(defaults, JSON.parse(row.value));
  } catch {
    return defaults;
  }
}

export async function saveSettings(db: D1Database, settings: AppSettings): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('app', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(JSON.stringify(settings))
    .run();
}
