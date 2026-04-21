import { describe, expect, it } from 'vitest';
import { getCorrelationId, newCorrelationId, withCorrelation } from './correlation';

describe('correlation context', () => {
  it('newCorrelationId returns a UUID-shaped string', () => {
    const id = newCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('getCorrelationId is undefined outside any context', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('withCorrelation exposes the id to nested sync callers', () => {
    withCorrelation('abc-123', () => {
      expect(getCorrelationId()).toBe('abc-123');
    });
  });

  it('the id propagates across await boundaries', async () => {
    await withCorrelation('async-id', async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCorrelationId()).toBe('async-id');
    });
  });

  it('nested withCorrelation overrides the outer id for the inner scope', () => {
    withCorrelation('outer', () => {
      expect(getCorrelationId()).toBe('outer');
      withCorrelation('inner', () => {
        expect(getCorrelationId()).toBe('inner');
      });
      expect(getCorrelationId()).toBe('outer');
    });
  });

  it('context does not leak out after the block returns', () => {
    withCorrelation('scoped', () => undefined);
    expect(getCorrelationId()).toBeUndefined();
  });
});
