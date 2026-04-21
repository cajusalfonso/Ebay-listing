import { describe, expect, it } from 'vitest';
import { AppError } from './errors';

class TestError extends AppError {
  public override readonly code = 'TEST_ERROR';
}

class AnotherError extends AppError {
  public override readonly code = 'ANOTHER_ERROR';
}

describe('AppError', () => {
  it('preserves the subclass name via new.target', () => {
    const err = new TestError('boom');
    expect(err.name).toBe('TestError');
  });

  it('attaches the subclass-defined code', () => {
    expect(new TestError('x').code).toBe('TEST_ERROR');
    expect(new AnotherError('y').code).toBe('ANOTHER_ERROR');
  });

  it('defaults context to an empty object', () => {
    const err = new TestError('x');
    expect(err.context).toEqual({});
  });

  it('stores structured context for logging', () => {
    const err = new TestError('boom', { ean: '4006381333115', stage: 'compliance' });
    expect(err.context).toEqual({ ean: '4006381333115', stage: 'compliance' });
  });

  it('forwards the cause chain', () => {
    const cause = new Error('underlying');
    const err = new TestError('wrapped', {}, { cause });
    expect(err.cause).toBe(cause);
  });

  it('remains instanceof Error and AppError', () => {
    const err = new TestError('x');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(TestError);
  });
});
