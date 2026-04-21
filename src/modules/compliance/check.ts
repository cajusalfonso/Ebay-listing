import { checkRequiredAspects } from './aspects';
import { checkCategoryWhitelist } from './category';
import { checkGpsr } from './gpsr';
import { checkLicensedImage } from './images';
import { checkKeywordBlacklist } from './keywords';
import type { CheckComplianceParams, ComplianceResult } from './types';

const MIN_DESCRIPTION_LEN = 40;

/**
 * Compliance Gate — runs every check and AGGREGATES all blockers. It never
 * short-circuits: the operator sees every problem in a single pass so they
 * can fix the product record or GPSR override in one step rather than
 * play whack-a-mole one blocker at a time.
 *
 * All five checks from the spec are pure and independent:
 *   1. Category whitelist
 *   2. Keyword blacklist
 *   3. Required eBay aspects (from Taxonomy API)
 *   4. GPSR completeness (manufacturer name + address + email)
 *   5. At least one licensed image
 *
 * Plus advisory warnings that do NOT fail the gate:
 *   - Only one licensed image (listings with 2+ convert better)
 *   - Very short description (≤ 40 chars)
 *   - Brand not set
 */
export function checkCompliance(params: CheckComplianceParams): ComplianceResult {
  const { product, categoryId, requiredAspects, approvedCategoryIds, keywordBlacklist } = params;

  const blockers: string[] = [];
  const warnings: string[] = [];

  blockers.push(...checkCategoryWhitelist(categoryId, approvedCategoryIds));
  blockers.push(...checkKeywordBlacklist(product, keywordBlacklist));
  blockers.push(...checkRequiredAspects(product, requiredAspects));
  blockers.push(...checkGpsr(product));

  const imageCheck = checkLicensedImage(product);
  blockers.push(...imageCheck.blockers);
  warnings.push(...imageCheck.warnings);

  if (product.description === null || product.description.trim().length < MIN_DESCRIPTION_LEN) {
    warnings.push('description_very_short');
  }
  if (product.brand === null || product.brand.trim() === '') {
    warnings.push('brand_not_set');
  }

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
  };
}

export type { ComplianceResult, CheckComplianceParams, ComplianceInput } from './types';
