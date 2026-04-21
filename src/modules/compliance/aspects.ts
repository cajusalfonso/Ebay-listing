import type { ComplianceInput } from './types';

/**
 * Verify every required aspect is populated on the product, and — if the
 * required entry lists allowed values — that the product's value is one of them.
 *
 * `requiredAspects: { "Brand": ["Bosch","Makita"], "Color": [] }` means:
 *   - Product.specs MUST have a non-empty "Brand" string AND its value must be
 *     one of {Bosch, Makita}.
 *   - Product.specs MUST have a non-empty "Color" string; any value accepted
 *     (empty allowed-list ⇒ unrestricted).
 */
export function checkRequiredAspects(
  product: ComplianceInput,
  requiredAspects: Readonly<Record<string, readonly string[]>>
): string[] {
  const blockers: string[] = [];
  for (const [aspectName, allowedValues] of Object.entries(requiredAspects)) {
    const value = product.specs[aspectName];
    if (value === undefined || value.trim() === '') {
      blockers.push(`required_aspect_missing:${aspectName}`);
      continue;
    }
    if (allowedValues.length > 0 && !allowedValues.includes(value)) {
      blockers.push(`required_aspect_value_not_allowed:${aspectName}=${value}`);
    }
  }
  return blockers;
}
