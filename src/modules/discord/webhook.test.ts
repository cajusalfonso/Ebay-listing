import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { DiscordError } from './errors';
import type { PublishEvent } from './types';
import { createDiscordNotifier } from './webhook';

const HOST = 'https://discord.com';
const WEBHOOK_PATH = '/api/webhooks/123/abc';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

function event(): PublishEvent {
  return {
    status: 'published',
    title: 't',
    ean: 'e',
    categoryName: 'c',
    categoryId: '1',
    cogsEur: 1,
    sellPriceGrossEur: 2,
    profitEur: 0.5,
    marginPercent: 0.1,
    competitorCount: 3,
    lowestCompetitorEur: 1.5,
    marketPosition: 'mid',
    ebayListingUrl: 'https://www.ebay.de/itm/1',
    ebaySearchUrl: 'https://www.ebay.de/sch/i.html?_nkw=e',
    environment: 'sandbox',
    failureReason: null,
  };
}

describe('createDiscordNotifier — live mode', () => {
  it('POSTs JSON embed to the webhook URL on success (204)', async () => {
    const pool = mockAgent.get(HOST);
    pool
      .intercept({
        path: WEBHOOK_PATH,
        method: 'POST',
        headers: (h) => h['content-type'] === 'application/json',
        body: (b) => {
          const p = JSON.parse(b);
          return Array.isArray(p.embeds) && p.embeds.length === 1;
        },
      })
      .reply(204, '');

    await createDiscordNotifier({ webhookUrl: `${HOST}${WEBHOOK_PATH}` }).publishEvent(event());
  });

  it('throws DiscordError with statusCode in context on 400', async () => {
    const pool = mockAgent.get(HOST);
    pool
      .intercept({ path: WEBHOOK_PATH, method: 'POST' })
      .reply(400, '{"message":"Invalid webhook"}');
    try {
      await createDiscordNotifier({ webhookUrl: `${HOST}${WEBHOOK_PATH}` }).publishEvent(event());
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(DiscordError);
      expect((err as DiscordError).context.statusCode).toBe(400);
    }
  });
});

describe('createDiscordNotifier — dry-run mode', () => {
  it('does NOT POST to the webhook; prints payload to provided printer', async () => {
    const printed: string[] = [];
    const notifier = createDiscordNotifier({
      webhookUrl: `${HOST}${WEBHOOK_PATH}`,
      dryRun: true,
      printer: (line) => printed.push(line),
    });
    // If a POST were made, MockAgent (with disableNetConnect) would throw.
    await notifier.publishEvent(event());
    expect(printed[0]).toContain('dry-run');
    expect(printed[1]).toContain('"embeds"');
  });

  it('falls back to stdout when no printer provided (smoke test)', async () => {
    const notifier = createDiscordNotifier({
      webhookUrl: `${HOST}${WEBHOOK_PATH}`,
      dryRun: true,
    });
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await notifier.publishEvent(event());
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
