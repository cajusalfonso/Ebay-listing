import { ComplianceError } from './errors';
import type { ComplianceInput } from './types';

/**
 * Compile blacklist pattern strings into case-insensitive RegExp once, upfront.
 * Throws ComplianceError with the offending pattern if any is invalid regex.
 */
export function compileKeywordPatterns(patterns: readonly string[]): RegExp[] {
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, 'i');
    } catch (cause) {
      throw new ComplianceError(
        `Invalid keyword-blacklist regex: ${pattern}`,
        { pattern },
        { cause }
      );
    }
  });
}

/**
 * Check product text (title + description + brand) against the compiled blacklist.
 * Each matching pattern yields a separate blocker so the operator sees every
 * hit in one pass. The blocker includes the first match substring as detail.
 */
export function checkKeywordBlacklist(
  product: ComplianceInput,
  patterns: readonly RegExp[]
): string[] {
  const haystack = [product.title, product.description ?? '', product.brand ?? '']
    .join(' ')
    .toLowerCase();
  const blockers: string[] = [];
  for (const pattern of patterns) {
    const match = pattern.exec(haystack);
    if (match) {
      blockers.push(`keyword_blacklist_match:${match[0]}`);
    }
  }
  return blockers;
}
