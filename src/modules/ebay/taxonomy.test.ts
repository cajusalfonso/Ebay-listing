import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createEbayHttpClient } from './httpClient';
import { createTaxonomyClient } from './taxonomy';

const SANDBOX_API = 'https://api.sandbox.ebay.com';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

function taxonomy() {
  const http = createEbayHttpClient({
    environment: 'sandbox',
    getAccessToken: () => Promise.resolve('mock-token'),
    sleep: () => Promise.resolve(),
  });
  return createTaxonomyClient(http);
}

describe('getDefaultCategoryTreeId', () => {
  it('returns the treeId for the given marketplace', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_DE',
        method: 'GET',
      })
      .reply(200, { categoryTreeId: '77', categoryTreeVersion: '129' });

    const id = await taxonomy().getDefaultCategoryTreeId('EBAY_DE');
    expect(id).toBe('77');
  });
});

describe('getCategorySuggestions', () => {
  it('returns list of suggestions with ancestor path and relevancy', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/commerce/taxonomy/v1/category_tree/77/get_category_suggestions?q=Schraubendreher',
        method: 'GET',
      })
      .reply(200, {
        categorySuggestions: [
          {
            category: { categoryId: '42343', categoryName: 'Schraubendreher' },
            categoryTreeNodeAncestors: [
              { categoryId: '11700', categoryName: 'Heimwerker', categoryTreeNodeLevel: 0 },
              { categoryId: '631', categoryName: 'Werkzeuge', categoryTreeNodeLevel: 1 },
            ],
            relevancy: 'HIGH',
          },
          {
            category: { categoryId: '99999', categoryName: 'Andere' },
          },
        ],
      });

    const s = await taxonomy().getCategorySuggestions('77', 'Schraubendreher');
    expect(s).toHaveLength(2);
    expect(s[0]?.categoryId).toBe('42343');
    expect(s[0]?.categoryName).toBe('Schraubendreher');
    expect(s[0]?.ancestorPath).toEqual([
      { categoryId: '11700', categoryName: 'Heimwerker' },
      { categoryId: '631', categoryName: 'Werkzeuge' },
    ]);
    expect(s[0]?.relevancy).toBe('HIGH');
    expect(s[1]?.ancestorPath).toEqual([]);
    expect(s[1]?.relevancy).toBeNull();
  });

  it('returns empty array when no suggestions', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/commerce/taxonomy/v1/category_tree/77/get_category_suggestions?q=obscureXYZ',
        method: 'GET',
      })
      .reply(200, {});
    const s = await taxonomy().getCategorySuggestions('77', 'obscureXYZ');
    expect(s).toEqual([]);
  });

  it('URL-encodes tree id and preserves the query verbatim in params', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: (p) =>
          p.startsWith('/commerce/taxonomy/v1/category_tree/77/get_category_suggestions') &&
          p.includes('q=Haus+%26+Garten'),
        method: 'GET',
      })
      .reply(200, { categorySuggestions: [] });
    await taxonomy().getCategorySuggestions('77', 'Haus & Garten');
  });
});

describe('getItemAspectsForCategory', () => {
  it('returns aspects with name, required flag, and allowed values', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/commerce/taxonomy/v1/category_tree/77/get_item_aspects_for_category?category_id=42343',
        method: 'GET',
      })
      .reply(200, {
        aspects: [
          {
            localizedAspectName: 'Marke',
            aspectConstraint: { aspectRequired: true, itemToAspectCardinality: 'SINGLE' },
            aspectValues: [{ localizedValue: 'Bosch' }, { localizedValue: 'Makita' }],
          },
          {
            localizedAspectName: 'Farbe',
            aspectConstraint: { aspectRequired: false },
          },
        ],
      });

    const aspects = await taxonomy().getItemAspectsForCategory('77', '42343');
    expect(aspects).toHaveLength(2);
    expect(aspects[0]).toEqual({
      name: 'Marke',
      required: true,
      allowedValues: ['Bosch', 'Makita'],
      cardinality: 'SINGLE',
    });
    expect(aspects[1]).toEqual({
      name: 'Farbe',
      required: false,
      allowedValues: [],
      cardinality: null,
    });
  });

  it('returns empty array when category has no required aspects', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/commerce/taxonomy/v1/category_tree/77/get_item_aspects_for_category?category_id=1',
        method: 'GET',
      })
      .reply(200, {});
    const aspects = await taxonomy().getItemAspectsForCategory('77', '1');
    expect(aspects).toEqual([]);
  });
});
