import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import type { Env } from '../src/env';
import { readConfig } from '../src/env';
import { safeEqual } from '../src/auth';
import { DEFAULT_SETTINGS, feeRuleFor, mergeSettings } from '../src/settings';
import { fakeD1 } from './fake-d1';

const KEY = 'a'.repeat(64);

function env(over: Partial<Env> = {}, stored?: unknown) {
  const f = fakeD1(stored);
  return { env: { DB: f.db, API_KEY: KEY, ...over } as Env, fake: f };
}

const calc = (e: Env, body: unknown, key = KEY) =>
  app.request(
    '/api/calc',
    { method: 'POST', headers: { 'X-API-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    e,
  );

describe('Konfiguration', () => {
  it('Standard: extension, Dry-Run an, Sandbox', () => {
    const cfg = readConfig({} as Env);
    expect(cfg).toMatchObject({ dataProvider: 'extension', dryRun: true, ebayEnv: 'sandbox' });
  });

  it('Dry-Run geht nur mit exakt "false" aus', () => {
    expect(readConfig({ DRY_RUN: 'false' } as Env).dryRun).toBe(false);
    expect(readConfig({ DRY_RUN: 'nein' } as Env).dryRun).toBe(true);
    expect(readConfig({ DRY_RUN: '' } as Env).dryRun).toBe(true);
  });

  it('falscher DATA_PROVIDER wird klar gemeldet', () => {
    expect(() => readConfig({ DATA_PROVIDER: 'amazon' } as Env)).toThrow(/DATA_PROVIDER/);
  });
});

describe('API-Key', () => {
  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('/health ist ohne Key erreichbar', async () => {
    const res = await app.request('/health', {}, env().env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, dryRun: true });
  });

  it('/api ohne Key → 401', async () => {
    const res = await app.request('/api/settings', {}, env().env);
    expect(res.status).toBe(401);
  });

  it('/api mit falschem Key → 401', async () => {
    const res = await calc(env().env, { amazonPriceGross: 119 }, 'b'.repeat(64));
    expect(res.status).toBe(401);
  });

  it('zu kurzer API_KEY auf dem Server → klare Fehlermeldung', async () => {
    const res = await app.request('/api/settings', { headers: { 'X-API-Key': 'kurz' } }, env({ API_KEY: 'kurz' }).env);
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toContain('API_KEY');
  });
});

describe('/api/calc', () => {
  it('empfiehlt 170,68 € für Amazon 119 €', async () => {
    const res = await calc(env().env, { amazonPriceGross: 119 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reachable: boolean; breakdown: { vkGross: number } };
    expect(body.reachable).toBe(true);
    expect(body.breakdown.vkGross).toBe(170.68);
  });

  it('rechnet einen vorgegebenen VK durch', async () => {
    const res = await calc(env().env, { amazonPriceGross: 119, vkGross: 150 });
    const body = (await res.json()) as { breakdown: { meetsRules: boolean } };
    expect(body.breakdown.meetsRules).toBe(false);
  });

  it('nutzt gespeicherte Einstellungen (z. B. Mindestgewinn 10 €)', async () => {
    const res = await calc(env({}, { pricing: { minProfitNet: 10 } }).env, { amazonPriceGross: 119 });
    const body = (await res.json()) as { breakdown: { vkGross: number; profitNet: number } };
    expect(body.breakdown.vkGross).toBeLessThan(170.68);
    expect(body.breakdown.profitNet).toBeGreaterThanOrEqual(10);
  });

  it('ungültiger Preis → 400', async () => {
    const res = await calc(env().env, { amazonPriceGross: 'abc' });
    expect(res.status).toBe(400);
  });
});

describe('Einstellungen', () => {
  it('gespeicherte Werte überschreiben Standard, falsche Typen werden ignoriert', () => {
    const m = mergeSettings(DEFAULT_SETTINGS, { pricing: { minProfitNet: 20, vatRate: 'x' }, unbekannt: 1 });
    expect(m.pricing.minProfitNet).toBe(20);
    expect(m.pricing.vatRate).toBe(0.19);
    expect((m as unknown as Record<string, unknown>).unbekannt).toBeUndefined();
  });

  it('Gebührenkategorie nach eBay-Kategorie-ID, sonst Standard', () => {
    const s = mergeSettings(DEFAULT_SETTINGS, {
      fees: {
        defaultCategoryId: 'standard',
        categories: [
          ...DEFAULT_SETTINGS.fees.categories,
          { id: 'handy', name: 'Handys', percent: 0.065, fixed: 0.35, ebayCategoryIds: ['9355'] },
        ],
      },
    });
    expect(feeRuleFor(s, '9355').id).toBe('handy');
    expect(feeRuleFor(s, '1234').id).toBe('standard');
    expect(feeRuleFor(s).id).toBe('standard');
  });
});
