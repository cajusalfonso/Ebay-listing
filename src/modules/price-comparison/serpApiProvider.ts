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
  // Google returns prices like "€ 89,99" or "89,99 €" or "$ 99.99" (only when
  // locale is wrong). Strip non-numeric, swap "," for "." if needed.
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

export interface SerpApiConfig {
  readonly apiKey: string;
  /** Override the fetch endpoint (test-only). */
  readonly endpoint?: string;
  /** Max results per country (default 10). */
  readonly perCountryLimit?: number;
}

export interface SerpApiProvider {
  fetchByEan(ean: string): Promise<readonly PriceComparisonOffer[]>;
}

export function createSerpApiProvider(config: SerpApiConfig): SerpApiProvider {
  const endpoint = config.endpoint ?? SERP_API_ENDPOINT;
  const perCountryLimit = config.perCountryLimit ?? 10;

  async function fetchCountry(ean: string, country: 'DE' | 'FR'): Promise<PriceComparisonOffer[]> {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: ean,
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
    async fetchByEan(ean: string): Promise<readonly PriceComparisonOffer[]> {
      // Fetch both countries in parallel. If one throws, we still want to
      // return the other — so we catch per-country.
      const [deResult, frResult] = await Promise.allSettled([
        fetchCountry(ean, 'DE'),
        fetchCountry(ean, 'FR'),
      ]);
      const offers: PriceComparisonOffer[] = [];
      if (deResult.status === 'fulfilled') offers.push(...deResult.value);
      if (frResult.status === 'fulfilled') offers.push(...frResult.value);
      // Bubble up errors only if BOTH failed — partial data is still useful.
      if (deResult.status === 'rejected' && frResult.status === 'rejected') {
        const dErr = deResult.reason instanceof Error ? deResult.reason.message : 'DE failed';
        const fErr = frResult.reason instanceof Error ? frResult.reason.message : 'FR failed';
        throw new Error(`SerpAPI failed: ${dErr} | ${fErr}`);
      }
      return offers;
    },
  };
}
