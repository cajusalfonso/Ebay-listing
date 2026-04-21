import { describe, expect, it } from 'vitest';
import { createDbClient } from './client';

/**
 * Pure structural tests. postgres-js connections are lazy — no TCP handshake
 * happens until the first query — so constructing a client with a bogus URL
 * never touches the network. We exercise that lazy contract here.
 */
describe('createDbClient', () => {
  it('returns db + close handles without connecting', async () => {
    const client = createDbClient('postgresql://nobody@nowhere.invalid:5432/never');
    expect(client.db).toBeDefined();
    expect(typeof client.close).toBe('function');
    await client.close();
  });

  it('close() is idempotent-safe on unused clients', async () => {
    const client = createDbClient('postgresql://nobody@nowhere.invalid:5432/never');
    await expect(client.close()).resolves.toBeUndefined();
  });

  it('accepts custom pool options without throwing at construction', () => {
    const client = createDbClient('postgresql://nobody@nowhere.invalid:5432/never', {
      maxConnections: 1,
      idleTimeoutSeconds: 5,
      connectTimeoutSeconds: 2,
    });
    expect(client.db).toBeDefined();
    void client.close();
  });
});
