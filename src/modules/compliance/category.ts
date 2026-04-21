/**
 * Check whether the resolved eBay category ID is on the configured whitelist.
 * Returns a blocker string when not — caller should halt publish.
 */
export function checkCategoryWhitelist(
  categoryId: string,
  approvedCategoryIds: ReadonlySet<string>
): string[] {
  if (!approvedCategoryIds.has(categoryId)) {
    return [`category_not_in_whitelist:${categoryId}`];
  }
  return [];
}
