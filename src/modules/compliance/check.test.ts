import { describe, expect, it } from 'vitest';
import { checkCompliance } from './check';
import { ComplianceError } from './errors';
import { compileKeywordPatterns } from './keywords';
import type { CheckComplianceParams, ComplianceInput } from './types';

function product(overrides: Partial<ComplianceInput> = {}): ComplianceInput {
  return {
    ean: '4006381333115',
    title: 'Stabiler Schraubendreher mit ergonomischem Griff',
    brand: 'Bosch',
    description:
      'Ein hochwertiger Schraubendreher aus gehärtetem Stahl mit rutschfestem Griff. Perfekt für den professionellen Einsatz im Handwerk.',
    specs: { Brand: 'Bosch', Marke: 'Bosch', Farbe: 'Blau' },
    images: [
      { source: 'ebay_catalog', licensed: true },
      { source: 'icecat', licensed: true },
    ],
    gpsrData: {
      manufacturerName: 'Robert Bosch GmbH',
      manufacturerAddress: 'Robert-Bosch-Platz 1, 70839 Gerlingen, Germany',
      manufacturerEmail: 'contact@bosch.com',
    },
    ...overrides,
  };
}

function params(overrides: Partial<CheckComplianceParams> = {}): CheckComplianceParams {
  return {
    product: product(),
    categoryId: '11700',
    requiredAspects: { Marke: [], Farbe: [] },
    approvedCategoryIds: new Set(['11700', '159912']),
    keywordBlacklist: compileKeywordPatterns([
      '\\b(batterie|akku|li-?ion)\\b',
      '\\b(creme|lotion|parfum)\\b',
    ]),
    ...overrides,
  };
}

describe('checkCompliance — happy path', () => {
  it('passes with no blockers when every check clears', () => {
    const r = checkCompliance(params());
    expect(r.passed).toBe(true);
    expect(r.blockers).toEqual([]);
  });
});

describe('checkCompliance — category whitelist', () => {
  it('blocks when categoryId is not in whitelist', () => {
    const r = checkCompliance(params({ categoryId: '99999' }));
    expect(r.passed).toBe(false);
    expect(r.blockers).toContain('category_not_in_whitelist:99999');
  });

  it('passes category check when id is on the whitelist', () => {
    const r = checkCompliance(params({ categoryId: '159912' }));
    expect(r.blockers.some((b) => b.startsWith('category_not_in_whitelist'))).toBe(false);
  });
});

describe('checkCompliance — keyword blacklist', () => {
  it('blocks when a banned term appears in the title', () => {
    const r = checkCompliance(
      params({ product: product({ title: 'Ersatzteil mit Lithium Akku 3000mAh' }) })
    );
    expect(r.blockers.some((b) => b.startsWith('keyword_blacklist_match:'))).toBe(true);
  });

  it('blocks when a banned term appears in the description', () => {
    const r = checkCompliance(
      params({ product: product({ description: 'Enthält eine feine Creme für die Pflege.' }) })
    );
    expect(r.blockers.some((b) => b.startsWith('keyword_blacklist_match:creme'))).toBe(true);
  });

  it('blocks when a banned term appears in the brand', () => {
    // "Premium Akku GmbH" has "Akku" as its own word so \b-bounded regex matches.
    const r = checkCompliance(params({ product: product({ brand: 'Premium Akku GmbH' }) }));
    expect(r.blockers.some((b) => b.startsWith('keyword_blacklist_match:akku'))).toBe(true);
  });

  it('is case-insensitive', () => {
    const r = checkCompliance(params({ product: product({ title: 'Grosse PARFUM-Flasche' }) }));
    expect(r.blockers.some((b) => b.startsWith('keyword_blacklist_match:parfum'))).toBe(true);
  });

  it('reports every matched blacklist entry (not short-circuited)', () => {
    const r = checkCompliance(
      params({
        product: product({
          title: 'Bundle mit Akku, Creme und Lithium',
          description: 'Enthält auch ein Parfum-Pröbchen.',
        }),
      })
    );
    const matches = r.blockers.filter((b) => b.startsWith('keyword_blacklist_match:'));
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('checkCompliance — required aspects', () => {
  it('blocks when a required aspect key is absent', () => {
    const r = checkCompliance(
      params({ product: product({ specs: { Farbe: 'Blau' } }), requiredAspects: { Marke: [] } })
    );
    expect(r.blockers).toContain('required_aspect_missing:Marke');
  });

  it('blocks when the required aspect value is an empty string', () => {
    const r = checkCompliance(
      params({
        product: product({ specs: { Marke: '   ', Farbe: 'Blau' } }),
        requiredAspects: { Marke: [] },
      })
    );
    expect(r.blockers).toContain('required_aspect_missing:Marke');
  });

  it('blocks when the value is not among allowed taxonomy values', () => {
    const r = checkCompliance(
      params({
        product: product({ specs: { Marke: 'Bosch', Farbe: 'Türkis' } }),
        requiredAspects: { Farbe: ['Blau', 'Rot', 'Grün'] },
      })
    );
    expect(r.blockers).toContain('required_aspect_value_not_allowed:Farbe=Türkis');
  });

  it('passes the allowed-values check when value is in the list', () => {
    const r = checkCompliance(
      params({
        product: product({ specs: { Marke: 'Bosch', Farbe: 'Blau' } }),
        requiredAspects: { Farbe: ['Blau', 'Rot'] },
      })
    );
    expect(r.blockers.some((b) => b.startsWith('required_aspect'))).toBe(false);
  });

  it('empty allowed-values array accepts any non-empty value', () => {
    const r = checkCompliance(
      params({
        product: product({ specs: { Marke: 'Bosch' } }),
        requiredAspects: { Marke: [] },
      })
    );
    expect(r.blockers.some((b) => b.startsWith('required_aspect'))).toBe(false);
  });
});

describe('checkCompliance — GPSR', () => {
  it('emits all three GPSR blockers when gpsrData is null', () => {
    const r = checkCompliance(params({ product: product({ gpsrData: null }) }));
    expect(r.blockers).toContain('gpsr_manufacturer_name_missing');
    expect(r.blockers).toContain('gpsr_manufacturer_address_missing');
    expect(r.blockers).toContain('gpsr_manufacturer_email_missing');
  });

  it('emits only name-missing when only name is absent', () => {
    const r = checkCompliance(
      params({
        product: product({
          gpsrData: {
            manufacturerName: null,
            manufacturerAddress: 'Somewhere 1',
            manufacturerEmail: 'c@x.de',
          },
        }),
      })
    );
    expect(r.blockers).toContain('gpsr_manufacturer_name_missing');
    expect(r.blockers).not.toContain('gpsr_manufacturer_address_missing');
    expect(r.blockers).not.toContain('gpsr_manufacturer_email_missing');
  });

  it('emits only address-missing when only address is absent', () => {
    const r = checkCompliance(
      params({
        product: product({
          gpsrData: {
            manufacturerName: 'Bosch',
            manufacturerAddress: null,
            manufacturerEmail: 'c@x.de',
          },
        }),
      })
    );
    expect(r.blockers).toContain('gpsr_manufacturer_address_missing');
    expect(r.blockers).not.toContain('gpsr_manufacturer_name_missing');
  });

  it('emits only email-missing when only email is absent', () => {
    const r = checkCompliance(
      params({
        product: product({
          gpsrData: {
            manufacturerName: 'Bosch',
            manufacturerAddress: 'Somewhere 1',
            manufacturerEmail: null,
          },
        }),
      })
    );
    expect(r.blockers).toContain('gpsr_manufacturer_email_missing');
  });

  it('treats whitespace-only strings as missing', () => {
    const r = checkCompliance(
      params({
        product: product({
          gpsrData: {
            manufacturerName: '   ',
            manufacturerAddress: 'Somewhere 1',
            manufacturerEmail: 'c@x.de',
          },
        }),
      })
    );
    expect(r.blockers).toContain('gpsr_manufacturer_name_missing');
  });
});

describe('checkCompliance — licensed image', () => {
  it('blocks when there are no images', () => {
    const r = checkCompliance(params({ product: product({ images: [] }) }));
    expect(r.blockers).toContain('no_licensed_image_available');
  });

  it('blocks when all images are unlicensed (manual or upcitemdb)', () => {
    const r = checkCompliance(
      params({
        product: product({
          images: [
            { source: 'manual', licensed: false },
            { source: 'upcitemdb', licensed: false },
          ],
        }),
      })
    );
    expect(r.blockers).toContain('no_licensed_image_available');
  });

  it('passes with exactly one licensed image, but warns', () => {
    const r = checkCompliance(
      params({ product: product({ images: [{ source: 'icecat', licensed: true }] }) })
    );
    expect(r.blockers).not.toContain('no_licensed_image_available');
    expect(r.warnings).toContain('only_one_licensed_image');
  });

  it('no image-count warning when two or more are licensed', () => {
    const r = checkCompliance(params());
    expect(r.warnings).not.toContain('only_one_licensed_image');
  });
});

describe('checkCompliance — warnings (soft signals, not blocking)', () => {
  it('warns on very short description', () => {
    const r = checkCompliance(params({ product: product({ description: 'Toll!' }) }));
    expect(r.warnings).toContain('description_very_short');
    expect(r.passed).toBe(true); // still passes; warnings are advisory
  });

  it('warns on missing brand', () => {
    const r = checkCompliance(params({ product: product({ brand: null }) }));
    expect(r.warnings).toContain('brand_not_set');
  });
});

describe('checkCompliance — aggregation (non-short-circuit)', () => {
  it('collects blockers from ALL 5 checks simultaneously in a single call', () => {
    const bad = product({
      title: 'Creme mit Akku',
      brand: null,
      description: 'x', // triggers short-description warning too
      specs: {}, // fails required aspect
      images: [{ source: 'manual', licensed: false }],
      gpsrData: null,
    });
    const r = checkCompliance({
      product: bad,
      categoryId: '99999',
      requiredAspects: { Marke: [] },
      approvedCategoryIds: new Set(['11700']),
      keywordBlacklist: compileKeywordPatterns(['\\bakku\\b', '\\bcreme\\b']),
    });
    expect(r.passed).toBe(false);
    expect(r.blockers.some((b) => b.startsWith('category_not_in_whitelist'))).toBe(true);
    expect(r.blockers.some((b) => b.startsWith('keyword_blacklist_match'))).toBe(true);
    expect(r.blockers).toContain('required_aspect_missing:Marke');
    expect(r.blockers).toContain('gpsr_manufacturer_name_missing');
    expect(r.blockers).toContain('gpsr_manufacturer_address_missing');
    expect(r.blockers).toContain('gpsr_manufacturer_email_missing');
    expect(r.blockers).toContain('no_licensed_image_available');
  });
});

describe('compileKeywordPatterns', () => {
  it('compiles valid patterns into case-insensitive RegExp', () => {
    const patterns = compileKeywordPatterns(['\\bakku\\b', 'creme']);
    expect(patterns).toHaveLength(2);
    expect(patterns[0]?.flags).toContain('i');
  });

  it('throws ComplianceError on invalid regex with offending pattern in context', () => {
    expect(() => compileKeywordPatterns(['(unbalanced'])).toThrow(ComplianceError);
    try {
      compileKeywordPatterns(['(unbalanced']);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ComplianceError);
      expect((err as ComplianceError).context.pattern).toBe('(unbalanced');
    }
  });

  it('returns empty array for empty input', () => {
    expect(compileKeywordPatterns([])).toEqual([]);
  });
});
