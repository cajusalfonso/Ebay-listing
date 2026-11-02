import { Hono } from 'hono';
import { requireApiKey } from './auth';
import { readConfig, type Env } from './env';
import { logError } from './log';
import { recommendPrice, breakdownAt } from './pricing/calc';
import { RECHNER_HTML } from './routes/rechner';
import { feeRuleFor, loadSettings } from './settings';

export const VERSION = '0.1.0';

export const app = new Hono<{ Bindings: Env }>();

/** Öffentlich: zeigt nur, dass der Server läuft – keine Daten. */
app.get('/health', (c) => {
  const cfg = readConfig(c.env);
  return c.json({
    ok: true,
    name: 'ArbiSync',
    version: VERSION,
    dataProvider: cfg.dataProvider,
    dryRun: cfg.dryRun,
    ebayEnv: cfg.ebayEnv,
  });
});

/** Test-Rechner im Browser (öffentlich, enthält keine Daten). */
app.get('/', (c) => c.html(RECHNER_HTML));

// Alles unter /api braucht den API-Key.
app.use('/api/*', requireApiKey);

app.get('/api/settings', async (c) => {
  const settings = await loadSettings(c.env.DB, c.env.MAX_PRICE_AGE_HOURS);
  return c.json(settings);
});

/**
 * Rechner: POST /api/calc
 * Body: { "amazonPriceGross": 119, "ebayCategoryId": "9355" (optional), "vkGross": 179 (optional) }
 * Ohne vkGross: empfohlener VK. Mit vkGross: Aufschlüsselung für genau diesen VK.
 */
app.post('/api/calc', async (c) => {
  let body: { amazonPriceGross?: unknown; ebayCategoryId?: unknown; vkGross?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Body ist kein gültiges JSON.' }, 400);
  }
  const price = Number(body.amazonPriceGross);
  if (!Number.isFinite(price) || price <= 0) {
    return c.json({ error: 'amazonPriceGross muss eine Zahl > 0 sein.' }, 400);
  }
  const settings = await loadSettings(c.env.DB, c.env.MAX_PRICE_AGE_HOURS);
  const fee = feeRuleFor(settings, typeof body.ebayCategoryId === 'string' ? body.ebayCategoryId : null);

  if (body.vkGross !== undefined) {
    const vk = Number(body.vkGross);
    if (!Number.isFinite(vk) || vk <= 0) return c.json({ error: 'vkGross muss eine Zahl > 0 sein.' }, 400);
    return c.json({ feeCategory: fee.name, breakdown: breakdownAt(vk, price, fee, settings.pricing) });
  }
  return c.json({ feeCategory: fee.name, ...recommendPrice(price, fee, settings.pricing) });
});

app.notFound((c) => c.json({ error: 'Nicht gefunden.' }, 404));

app.onError(async (err, c) => {
  const msg = err instanceof Error ? err.message : String(err);
  await logError(c.env.DB, `api ${c.req.method} ${c.req.path}`, msg);
  return c.json({ error: msg }, 500);
});
