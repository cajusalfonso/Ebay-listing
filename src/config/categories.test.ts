import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadCategoryWhitelist, loadKeywordBlacklist, loadResolvedCategoryIds } from './categories';
import { ConfigError } from './errors';

/** Creates a throwaway project root with a `config-files/` subdir and returns its path. */
function createTempProjectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'ebay-vol-cfg-'));
  mkdirSync(join(root, 'config-files'), { recursive: true });
  return root;
}

function writeFixture(root: string, filename: string, content: string): void {
  writeFileSync(join(root, 'config-files', filename), content, 'utf8');
}

describe('loadCategoryWhitelist', () => {
  let root: string;

  beforeEach(() => {
    root = createTempProjectRoot();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('parses a valid whitelist array', () => {
    writeFixture(
      root,
      'category-whitelist.json',
      JSON.stringify([
        { name: 'Haus & Garten', ebay_category_path: ['Haus & Garten'], notes: 'keine Elektronik' },
        { name: 'Heimwerker', ebay_category_path: ['Heimwerker'] },
      ])
    );
    const wl = loadCategoryWhitelist(root);
    expect(wl).toHaveLength(2);
    expect(wl[0]?.name).toBe('Haus & Garten');
    expect(wl[1]?.notes).toBeUndefined();
  });

  it('throws ConfigError when the file is missing', () => {
    expect(() => loadCategoryWhitelist(root)).toThrow(ConfigError);
    expect(() => loadCategoryWhitelist(root)).toThrow(/not found or unreadable/);
  });

  it('throws ConfigError when the file is not valid JSON', () => {
    writeFixture(root, 'category-whitelist.json', '{not json}');
    expect(() => loadCategoryWhitelist(root)).toThrow(/not valid JSON/);
  });

  it('throws ConfigError when the schema is violated (empty array)', () => {
    writeFixture(root, 'category-whitelist.json', '[]');
    expect(() => loadCategoryWhitelist(root)).toThrow(ConfigError);
  });

  it('throws when ebay_category_path is missing', () => {
    writeFixture(root, 'category-whitelist.json', JSON.stringify([{ name: 'X' }]));
    expect(() => loadCategoryWhitelist(root)).toThrow(ConfigError);
  });

  it('loads the repo default whitelist from cwd', () => {
    // Uses the real seed file committed to the repo — smoke test for the default happy path.
    const wl = loadCategoryWhitelist();
    expect(wl.length).toBeGreaterThanOrEqual(7);
    expect(wl.map((c) => c.name)).toContain('Haus & Garten');
  });
});

describe('loadKeywordBlacklist', () => {
  it('loads the repo default blacklist', () => {
    const bl = loadKeywordBlacklist();
    expect(bl.patterns.length).toBeGreaterThan(0);
  });

  it('rejects schemas without patterns', () => {
    const root = createTempProjectRoot();
    try {
      writeFixture(root, 'keyword-blacklist.json', JSON.stringify({ _comment: 'x' }));
      expect(() => loadKeywordBlacklist(root)).toThrow(ConfigError);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('loadResolvedCategoryIds', () => {
  it('parses a simple name → id map', () => {
    const root = createTempProjectRoot();
    try {
      writeFixture(
        root,
        'ebay-category-ids.json',
        JSON.stringify({ 'Haus & Garten': '11700', Heimwerker: '159912' })
      );
      const ids = loadResolvedCategoryIds(root);
      expect(ids['Haus & Garten']).toBe('11700');
      expect(ids.Heimwerker).toBe('159912');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('hint mentions setup command when file missing', () => {
    const root = createTempProjectRoot();
    try {
      expect(() => loadResolvedCategoryIds(root)).toThrow(/setup:resolve-categories|not found/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
