import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { EnvValidationError } from './errors';

/**
 * 32-byte key in hex encoding (64 hex chars). Generate via `openssl rand -hex 32`.
 * Used by `src/lib/encryption.ts` for AES-256-GCM token storage.
 */
const hex32ByteKey = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, '32-byte hex required (64 hex chars) — run `openssl rand -hex 32`');

const percent = z.coerce.number().min(0).max(1);
const nonNegativeEur = z.coerce.number().nonnegative();
const positiveNumber = z.coerce.number().positive();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('postgresql://') || url.startsWith('postgres://'), {
      message: 'DATABASE_URL must start with postgresql:// or postgres://',
    }),

  EBAY_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  EBAY_APP_ID: z.string().min(1, 'EBAY_APP_ID required'),
  EBAY_CERT_ID: z.string().min(1, 'EBAY_CERT_ID required'),
  EBAY_DEV_ID: z.string().min(1, 'EBAY_DEV_ID required'),
  EBAY_REDIRECT_URI_NAME: z.string().min(1, 'EBAY_REDIRECT_URI_NAME (RuName) required'),

  ICECAT_USER: z.string().min(1, 'ICECAT_USER required'),
  ICECAT_PASSWORD: z.string().min(1, 'ICECAT_PASSWORD required'),

  DISCORD_WEBHOOK_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://discord.com/api/webhooks/'), {
      message: 'DISCORD_WEBHOOK_URL must be a https://discord.com/api/webhooks/... URL',
    }),

  MIN_ABSOLUTE_PROFIT_EUR: nonNegativeEur.default(10),
  MIN_MARGIN_PERCENT: percent.default(0.08),
  DEFAULT_VAT_RATE: percent.default(0.19),
  DEFAULT_EBAY_FEE_PERCENT: percent.default(0.12),
  DEFAULT_EBAY_FIXED_FEE_EUR: nonNegativeEur.default(0.35),
  DEFAULT_RETURN_RESERVE_PERCENT: percent.default(0.03),
  UNDERCUT_AMOUNT_EUR: nonNegativeEur.default(0.5),
  TARGET_MARGIN_MULTIPLIER: positiveNumber.default(1.25),

  IMAGE_STORAGE_PATH: z.string().min(1).default('./storage/images'),

  TOKEN_ENCRYPTION_KEY: hex32ByteKey,
});

export type Env = z.infer<typeof envSchema>;

type RawEnv = Readonly<Record<string, string | undefined>>;

/**
 * Pure: validates a raw env record and returns the typed config.
 * Throws `EnvValidationError` with a grouped message of all issues.
 * Tests call this directly with fixtures — no dotenv side-effects.
 */
export function parseEnv(raw: RawEnv = process.env): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
    throw new EnvValidationError(`Env validation failed:\n${issues}`, {
      issues: result.error.issues,
    });
  }
  return result.data;
}

let cached: Env | undefined;

/**
 * Side-effect entry point: reads `.env` via dotenv, parses `process.env`, caches result.
 * Call once at CLI/API startup. Subsequent calls return the cached value.
 */
export function loadEnv(): Env {
  if (!cached) {
    loadDotenv();
    cached = parseEnv(process.env);
  }
  return cached;
}

/**
 * Test-only: reset the cache. Do not call from production code.
 */
export function resetEnvCache(): void {
  cached = undefined;
}
