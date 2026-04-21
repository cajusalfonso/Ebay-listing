import { describe, expect, it } from 'vitest';
import { buildEmbedPayload } from './embed';
import type { PublishEvent } from './types';

function event(overrides: Partial<PublishEvent> = {}): PublishEvent {
  return {
    status: 'published',
    title: 'Faber-Castell Bleistift Grip 2001',
    ean: '4006381333115',
    categoryName: 'Bleistifte',
    categoryId: '1001',
    cogsEur: 3.5,
    sellPriceGrossEur: 9.9,
    profitEur: 2.14,
    marginPercent: 0.0812,
    competitorCount: 7,
    lowestCompetitorEur: 10.5,
    marketPosition: 'cheapest',
    ebayListingUrl: 'https://www.ebay.de/itm/225891234567',
    ebaySearchUrl: 'https://www.ebay.de/sch/i.html?_nkw=4006381333115&LH_BIN=1',
    environment: 'sandbox',
    failureReason: null,
    ...overrides,
  };
}

function embed(e: PublishEvent) {
  return buildEmbedPayload(e).embeds[0]!;
}

describe('buildEmbedPayload — colors', () => {
  it('green when published + cheapest', () => {
    expect(embed(event({ status: 'published', marketPosition: 'cheapest' })).color).toBe(0x2ecc71);
  });

  it('yellow when published but not cheapest', () => {
    expect(embed(event({ status: 'published', marketPosition: 'mid' })).color).toBe(0xf1c40f);
  });

  it('red when failed', () => {
    expect(embed(event({ status: 'failed', failureReason: 'compliance_failed' })).color).toBe(
      0xe74c3c
    );
  });

  it('gray for dry-run', () => {
    expect(embed(event({ status: 'would_publish_dry_run' })).color).toBe(0x95a5a6);
  });
});

describe('buildEmbedPayload — fields', () => {
  it('contains EAN, Kategorie, COGS, Sell Price, Profit/Margin, Competitors, Market Position', () => {
    const fields = embed(event()).fields.map((f) => f.name);
    expect(fields).toContain('EAN');
    expect(fields).toContain('Kategorie');
    expect(fields).toContain('COGS');
    expect(fields).toContain('Sell Price');
    expect(fields).toContain('Profit / Margin');
    expect(fields).toContain('Competitors');
    expect(fields).toContain('Market Position');
    expect(fields).toContain('eBay Search');
    expect(fields).toContain('eBay Listing');
  });

  it('formats EUR and percent consistently', () => {
    const e = embed(
      event({ cogsEur: 3.5, sellPriceGrossEur: 9.9, profitEur: 2.14, marginPercent: 0.0812 })
    );
    const profitField = e.fields.find((f) => f.name === 'Profit / Margin');
    expect(profitField?.value).toBe('€2.14 / 8.12%');
    const cogs = e.fields.find((f) => f.name === 'COGS');
    expect(cogs?.value).toBe('€3.50');
  });

  it('omits the eBay Listing field on failure (no URL yet)', () => {
    const fields = embed(
      event({
        status: 'failed',
        ebayListingUrl: null,
        failureReason: 'compliance_failed:gpsr_manufacturer_email_missing',
      })
    ).fields.map((f) => f.name);
    expect(fields).not.toContain('eBay Listing');
    expect(fields).toContain('Failure reason');
  });

  it('shows "no competition" when competitor count is zero', () => {
    const fields = embed(
      event({ competitorCount: 0, lowestCompetitorEur: null, marketPosition: 'no_competition' })
    ).fields;
    const competitors = fields.find((f) => f.name === 'Competitors');
    expect(competitors?.value).toContain('no competition');
  });
});

describe('buildEmbedPayload — title / truncation', () => {
  it('prefixes the title with a status indicator', () => {
    const published = embed(event({ status: 'published', environment: 'sandbox' }));
    expect(published.title).toContain('🧪 Sandbox');
    const prod = embed(event({ status: 'published', environment: 'production' }));
    expect(prod.title).toContain('🟢 Live');
    const dry = embed(event({ status: 'would_publish_dry_run' }));
    expect(dry.title).toContain('🔍 Dry Run');
  });

  it('truncates titles longer than 256 chars with an ellipsis', () => {
    const longTitle = 'a'.repeat(500);
    const e = embed(event({ title: longTitle }));
    expect(e.title.length).toBeLessThanOrEqual(256 + '🧪 Sandbox · '.length);
    expect(e.title.endsWith('…')).toBe(true);
  });
});

describe('buildEmbedPayload — footer and timestamp', () => {
  it('includes environment in footer', () => {
    expect(embed(event({ environment: 'production' })).footer.text).toContain('production');
    expect(embed(event({ environment: 'sandbox' })).footer.text).toContain('sandbox');
  });

  it('timestamp is ISO-8601', () => {
    const ts = embed(event()).timestamp;
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
