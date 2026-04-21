import type { ComplianceInput } from './types';

/**
 * Require at least one image flagged `licensed: true`. The licensed flag is
 * set upstream by the product-data enrichment layer and is only set for
 * `ebay_catalog` or `icecat` sources. Manual or UPCitemDB images are
 * unlicensed until a human reviewer flips the flag by hand.
 */
export function checkLicensedImage(product: ComplianceInput): {
  blockers: string[];
  warnings: string[];
} {
  const licensedCount = product.images.filter((img) => img.licensed).length;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (licensedCount === 0) {
    blockers.push('no_licensed_image_available');
  } else if (licensedCount === 1) {
    warnings.push('only_one_licensed_image');
  }
  return { blockers, warnings };
}
