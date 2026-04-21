import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';
import { EnvValidationError } from './errors';

const VALID_HEX_KEY = 'a'.repeat(64);

/**
 * Minimal valid env fixture. Tests override individual keys via spread.
 * Every required key present, defaults omitted intentionally so tests exercise them.
 */
function validEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ebay_tool',
    EBAY_APP_ID: 'app-id',
    EBAY_CERT_ID: 'cert-id',
    EBAY_DEV_ID: 'dev-id',
    EBAY_REDIRECT_URI_NAME: 'RuName',
    ICECAT_USER: 'icecat-user',
    ICECAT_PASSWORD: 'icecat-pw',
    DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
    TOKEN_ENCRYPTION_KEY: VALID_HEX_KEY,
    ...overrides,
  };
}

describe('parseEnv', () => {
  it('parses a minimal valid env and applies defaults', () => {
    const env = parseEnv(validEnv());
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.EBAY_ENV).toBe('sandbox');
    expect(env.MIN_ABSOLUTE_PROFIT_EUR).toBe(10);
    expect(env.MIN_MARGIN_PERCENT).toBeCloseTo(0.08);
    expect(env.DEFAULT_VAT_RATE).toBeCloseTo(0.19);
    expect(env.IMAGE_STORAGE_PATH).toBe('./storage/images');
  });

  it('throws EnvValidationError when DATABASE_URL is missing', () => {
    expect(() => parseEnv(validEnv({ DATABASE_URL: undefined }))).toThrow(EnvValidationError);
  });

  it('throws when DATABASE_URL does not start with postgresql://', () => {
    expect(() => parseEnv(validEnv({ DATABASE_URL: 'mysql://user:pw@localhost:3306/db' }))).toThrow(
      /postgresql:\/\//
    );
  });

  it('accepts both postgresql:// and postgres:// schemes', () => {
    expect(() =>
      parseEnv(validEnv({ DATABASE_URL: 'postgres://postgres@localhost:5432/ebay_tool' }))
    ).not.toThrow();
  });

  it('rejects TOKEN_ENCRYPTION_KEY that is not 64 hex chars', () => {
    expect(() => parseEnv(validEnv({ TOKEN_ENCRYPTION_KEY: 'tooshort' }))).toThrow(/32-byte hex/);
    expect(() => parseEnv(validEnv({ TOKEN_ENCRYPTION_KEY: 'g'.repeat(64) }))).toThrow(
      /32-byte hex/
    );
    expect(() => parseEnv(validEnv({ TOKEN_ENCRYPTION_KEY: 'a'.repeat(63) }))).toThrow(
      /32-byte hex/
    );
  });

  it('accepts both upper- and lower-case hex in TOKEN_ENCRYPTION_KEY', () => {
    expect(() => parseEnv(validEnv({ TOKEN_ENCRYPTION_KEY: 'A'.repeat(64) }))).not.toThrow();
    expect(() =>
      parseEnv(validEnv({ TOKEN_ENCRYPTION_KEY: '0123456789abcdefABCDEF'.repeat(3).slice(0, 64) }))
    ).not.toThrow();
  });

  it('rejects invalid DISCORD_WEBHOOK_URL domain', () => {
    expect(() => parseEnv(validEnv({ DISCORD_WEBHOOK_URL: 'https://example.com/hook' }))).toThrow(
      /discord\.com/
    );
  });

  it('coerces numeric pricing rules from strings (env vars are always strings)', () => {
    const env = parseEnv(
      validEnv({
        MIN_ABSOLUTE_PROFIT_EUR: '15',
        MIN_MARGIN_PERCENT: '0.10',
        DEFAULT_EBAY_FEE_PERCENT: '0.14',
      })
    );
    expect(env.MIN_ABSOLUTE_PROFIT_EUR).toBe(15);
    expect(env.MIN_MARGIN_PERCENT).toBeCloseTo(0.1);
    expect(env.DEFAULT_EBAY_FEE_PERCENT).toBeCloseTo(0.14);
  });

  it('rejects out-of-range percent values (MIN_MARGIN_PERCENT > 1)', () => {
    expect(() => parseEnv(validEnv({ MIN_MARGIN_PERCENT: '1.5' }))).toThrow(EnvValidationError);
  });

  it('rejects negative pricing values', () => {
    expect(() => parseEnv(validEnv({ MIN_ABSOLUTE_PROFIT_EUR: '-5' }))).toThrow(EnvValidationError);
    expect(() => parseEnv(validEnv({ UNDERCUT_AMOUNT_EUR: '-0.10' }))).toThrow(EnvValidationError);
  });

  it('EBAY_ENV accepts sandbox and production, rejects anything else', () => {
    expect(parseEnv(validEnv({ EBAY_ENV: 'sandbox' })).EBAY_ENV).toBe('sandbox');
    expect(parseEnv(validEnv({ EBAY_ENV: 'production' })).EBAY_ENV).toBe('production');
    expect(() => parseEnv(validEnv({ EBAY_ENV: 'prod' }))).toThrow(EnvValidationError);
  });

  it('error message lists all failing keys, not just the first', () => {
    try {
      parseEnv(
        validEnv({
          EBAY_APP_ID: '',
          EBAY_CERT_ID: '',
          TOKEN_ENCRYPTION_KEY: 'invalid',
        })
      );
      expect.fail('expected parseEnv to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const msg = (err as EnvValidationError).message;
      expect(msg).toContain('EBAY_APP_ID');
      expect(msg).toContain('EBAY_CERT_ID');
      expect(msg).toContain('TOKEN_ENCRYPTION_KEY');
    }
  });

  it('EnvValidationError exposes Zod issues in context', () => {
    try {
      parseEnv(validEnv({ DATABASE_URL: 'not-a-url' }));
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const ctx = (err as EnvValidationError).context;
      expect(Array.isArray(ctx.issues)).toBe(true);
    }
  });

  it('TARGET_MARGIN_MULTIPLIER must be strictly positive', () => {
    expect(() => parseEnv(validEnv({ TARGET_MARGIN_MULTIPLIER: '0' }))).toThrow(EnvValidationError);
    expect(parseEnv(validEnv({ TARGET_MARGIN_MULTIPLIER: '0.01' })).TARGET_MARGIN_MULTIPLIER).toBe(
      0.01
    );
  });
});
