import { request } from 'undici';
import { z } from 'zod';
import type { PriceComparisonOffer } from './types';

const SERP_API_ENDPOINT = 'https://serpapi.com/search.json';

/**
 * Minimal subset of the SerpAPI Google Shopping response we rely on.
 * Shape varies: sometimes `shopping_results`, sometimes `inline_shopping_results`,
 * sometimes nested under `product_results`. We accept and normalize below.
 */
const shoppingItemSchema = z.object({
  position: z.number().optional(),
  title: z.string().optional(),
  source: z.string().optional(),
  link: z.string().optional(),
  product_link: z.string().optional(),
  thumbnail: z.string().optional(),
  extracted_price: z.number().optional(),
  price: z.string().optional(),
});

const serpApiResponseSchema = z
  .object({
    shopping_results: z.array(shoppingItemSchema).optional(),
    inline_shopping_results: z.array(shoppingItemSchema).optional(),
  })
  .passthrough();

type ShoppingItem = z.infer<typeof shoppingItemSchema>;

function normalizePriceToEur(raw: string | undefined, extracted: number | undefined): number | null {
  if (typeof extracted === 'number' && Number.isFinite(extracted)) return extracted;
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '');
  const asNumber = Number(cleaned.replace(',', '.'));
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null;
}

function itemToOffer(item: ShoppingItem, country: 'DE' | 'FR'): PriceComparisonOffer | null {
  const priceEur = normalizePriceToEur(item.price, item.extracted_price);
  if (priceEur === null) return null;
  const seller = item.source?.trim() ?? '';
  const title = item.title?.trim() ?? '';
  const link = item.link ?? item.product_link ?? '';
  if (seller === '' || link === '') return null;
  return {
    seller,
    title,
    priceEur,
    link,
    thumbnail: item.thumbnail ?? null,
    country,
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const STOP_WORDS = new Set([
  'case',
  'cover',
  'hülle',
  'schutzhülle',
  'handyhülle',
  'schutz',
  'folie',
  'panzerglas',
  'displayschutz',
  'displayfolie',
  'schutzfolie',
  'glas',
  'charger',
  'ladegerät',
  'kabel',
  'cable',
  'adapter',
  'zubehör',
  'accessory',
  'accessories',
  'sticker',
  'skin',
  'étui',
  'coque',
  'chargeur',
  'câble',
  'protection',
  'verre',
  'pour',
]);

function containsAccessoryKeyword(title: string): boolean {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/);
  return words.some((w) => STOP_WORDS.has(w));
}

export interface ProductQuery {
  /** EAN/GTIN — used as a last-resort query. */
  readonly ean: string;
  /** Product title from Icecat/Catalog (e.g. "Galaxy S21 Ultra 5G 128 GB"). */
  readonly title: string | null;
  /** Brand (e.g. "Samsung"). Used both as a query term and as a sanity filter. */
  readonly brand: string | null;
  /** Manufacturer part number (e.g. "SM-G998B"). Best query signal when present. */
  readonly mpn: string | null;
}

export interface SerpApiConfig {
  readonly apiKey: string;
  /** Override the fetch endpoint (test-only). */
  readonly endpoint?: string;
  /** Max results per country (default 15). */
  readonly perCountryLimit?: number;
  /**
   * Offers priced below this fraction of the median price are discarded as
   * obvious mismatches (cases, cables, accessories listing the EAN). Default
   * 0.3 — i.e. anything under 30% of the median is dropped.
   */
  readonly outlierFloor?: number;
}

export interface SerpApiProvider {
  fetchForProduct(query: ProductQuery): Promise<readonly PriceComparisonOffer[]>;
}

function buildQueryString(q: ProductQuery): string {
  // Prefer brand + mpn — highly specific, rarely matches accessories.
  if (q.brand && q.mpn) return `${q.brand} ${q.mpn}`;
  // Next: brand + title (less precise but still mostly right).
  if (q.brand && q.title) return `${q.brand} ${q.title}`;
  // Title alone works for well-known products.
  if (q.title) return q.title;
  // EAN as the last resort — will over-match accessories.
  return q.ean;
}

function looksLikeSameProduct(offer: PriceComparisonOffer, q: ProductQuery): boolean {
  if (containsAccessoryKeyword(offer.title)) return false;
  const title = offer.title.toLowerCase();
  // Brand must appear in the offer title (case-insensitive) when we know it.
  if (q.brand && !title.includes(q.brand.toLowerCase())) return false;
  // If MPN is known and reasonably unique (≥5 chars), require it in the title.
  if (q.mpn && q.mpn.length >= 5 && !title.includes(q.mpn.toLowerCase())) {
    // Soft: allow if any 2+ words of the product title match (accommodates
    // sellers who drop the MPN but list the product name).
    if (q.title) {
      const productWords = q.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      const matches = productWords.filter((w) => title.includes(w)).length;
      if (matches < 2) return false;
    } else {
      return false;
    }
  }
  return true;
}

function removePriceOutliers(
  offers: readonly PriceComparisonOffer[],
  floor: number
): PriceComparisonOffer[] {
  if (offers.length < 3) return [...offers];
  const med = median(offers.map((o) => o.priceEur));
  if (med === null) return [...offers];
  const threshold = med * floor;
  return offers.filter((o) => o.priceEur >= threshold);
}

export function createSerpApiProvider(config: SerpApiConfig): SerpApiProvider {
  const endpoint = config.endpoint ?? SERP_API_ENDPOINT;
  const perCountryLimit = config.perCountryLimit ?? 15;
  const outlierFloor = config.outlierFloor ?? 0.3;

  async function fetchCountry(
    q: string,
    country: 'DE' | 'FR'
  ): Promise<PriceComparisonOffer[]> {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q,
      gl: country.toLowerCase(),
      hl: country === 'DE' ? 'de' : 'fr',
      num: String(perCountryLimit),
      api_key: config.apiKey,
    });
    const url = `${endpoint}?${params.toString()}`;
    const { statusCode, body } = await request(url, { method: 'GET' });
    const json: unknown = await body.json();
    if (statusCode !== 200) {
      const message =
        json && typeof json === 'object' && 'error' in json
          ? String((json as { error: unknown }).error)
          : `SerpAPI ${country} returned ${statusCode}`;
      throw new Error(message);
    }
    const parsed = serpApiResponseSchema.safeParse(json);
    if (!parsed.success) return [];
    const items = [
      ...(parsed.data.shopping_results ?? []),
      ...(parsed.data.inline_shopping_results ?? []),
    ];
    const offers: PriceComparisonOffer[] = [];
    for (const item of items) {
      const offer = itemToOffer(item, country);
      if (offer) offers.push(offer);
    }
    return offers;
  }

  return {
    async fetchForProduct(q: ProductQuery): Promise<readonly PriceComparisonOffer[]> {
      const queryStr = buildQueryString(q);
      const [deResult, frResult] = await Promise.allSettled([
        fetchCountry(queryStr, 'DE'),
        fetchCountry(queryStr, 'FR'),
      ]);
      const raw: PriceComparisonOffer[] = [];
      if (deResult.status === 'fulfilled') raw.push(...deResult.value);
      if (frResult.status === 'fulfilled') raw.push(...frResult.value);
      if (deResult.status === 'rejected' && frResult.status === 'rejected') {
        const dErr = deResult.reason instanceof Error ? deResult.reason.message : 'DE failed';
        const fErr = frResult.reason instanceof Error ? frResult.reason.message : 'FR failed';
        throw new Error(`SerpAPI failed: ${dErr} | ${fErr}`);
      }
      // Two-pass filter: first drop accessories + off-brand titles, then drop
      // price outliers from whatever survives. Keeps raw signal for products
      // without brand/MPN info (fallback: still drops cases + outliers).
      const matched = raw.filter((o) => looksLikeSameProduct(o, q));
      // If filtering was too aggressive and we lost everything, fall back to
      // just outlier-filtering the raw results — better to show something
      // approximate than nothing.
      const base = matched.length >= 2 ? matched : raw;
      return removePriceOutliers(base, outlierFloor);
    },
  };
}
