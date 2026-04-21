/**
 * Subset of a ProductData (from modules/product-data) that the compliance gate needs.
 * Defined here so compliance stays independent of the product-data module during
 * testing — any ProductData with these fields is structurally assignable.
 */
export interface ComplianceImage {
  readonly source: string;
  readonly licensed: boolean;
}

export interface ComplianceGpsrData {
  readonly manufacturerName: string | null;
  readonly manufacturerAddress: string | null;
  readonly manufacturerEmail: string | null;
}

export interface ComplianceInput {
  readonly ean: string;
  readonly title: string;
  readonly brand: string | null;
  readonly description: string | null;
  readonly specs: Readonly<Record<string, string>>;
  readonly images: readonly ComplianceImage[];
  readonly gpsrData: ComplianceGpsrData | null;
}

/**
 * Stable machine-readable codes. Blocker strings follow `<code>[:<detail>]` —
 * detail is human-facing context (the matched keyword, the missing aspect name, …).
 */
export type ComplianceBlockerCode =
  | 'category_not_in_whitelist'
  | 'keyword_blacklist_match'
  | 'required_aspect_missing'
  | 'required_aspect_value_not_allowed'
  | 'gpsr_manufacturer_name_missing'
  | 'gpsr_manufacturer_address_missing'
  | 'gpsr_manufacturer_email_missing'
  | 'no_licensed_image_available';

export type ComplianceWarningCode =
  | 'only_one_licensed_image'
  | 'description_very_short'
  | 'brand_not_set';

export interface ComplianceResult {
  readonly passed: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export interface CheckComplianceParams {
  readonly product: ComplianceInput;
  readonly categoryId: string;
  /**
   * Map of eBay-required aspect names → allowed values from the Taxonomy API.
   * Empty array in the value means "any non-empty value is acceptable".
   */
  readonly requiredAspects: Readonly<Record<string, readonly string[]>>;
  readonly approvedCategoryIds: ReadonlySet<string>;
  /** Pre-compiled RegExp array. Compile once via `compileKeywordPatterns`. */
  readonly keywordBlacklist: readonly RegExp[];
}
