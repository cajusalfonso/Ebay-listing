import { XMLParser } from 'fast-xml-parser';
import { request } from 'undici';
import { HTTP_TIMEOUTS, RETRY_CONFIG } from '../../../config/constants';
import { withRetry } from '../../../lib/retry';
import { ProductDataError } from '../errors';

/** URL template per spec — semicolon-separated query parameters (Icecat convention). */
const DEFAULT_BASE_URL = 'https://data.icecat.biz/xml_s3/xml_server3.cgi';

export interface IcecatClientConfig {
  readonly user: string;
  readonly password: string;
  readonly baseUrl?: string;
  /** Language code for the ProductDescription / Feature translations (ISO short code). */
  readonly language?: string;
  /** Test-only: skip real backoff delays during retry. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface IcecatImage {
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly isMain: boolean;
}

export interface IcecatSupplier {
  readonly name: string | null;
  readonly address: string | null;
  readonly email: string | null;
}

export interface IcecatProduct {
  readonly ean: string;
  readonly title: string | null;
  readonly brand: string | null;
  readonly mpn: string | null;
  readonly shortDescription: string | null;
  readonly longDescription: string | null;
  readonly categoryName: string | null;
  readonly supplier: IcecatSupplier;
  readonly images: readonly IcecatImage[];
}

export interface IcecatClient {
  fetchByEan(ean: string): Promise<IcecatProduct | null>;
}

function isArrayField(name: string): boolean {
  return name === 'ProductPicture';
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => isArrayField(name),
  parseAttributeValue: false, // keep everything as string, coerce explicitly below
  trimValues: true,
});

interface RawSupplier {
  '@_Name'?: string;
  '@_Address'?: string;
  '@_Email'?: string;
}

interface RawCategory {
  '@_Name'?: string;
}

interface RawProductDescription {
  '@_ShortDesc'?: string;
  '@_LongDesc'?: string;
}

interface RawProductPicture {
  '@_Pic'?: string;
  '@_PicHeight'?: string;
  '@_PicWidth'?: string;
  '@_IsMain'?: string;
}

interface RawGallery {
  ProductPicture?: RawProductPicture[];
}

interface RawProduct {
  '@_Name'?: string;
  '@_Prod_id'?: string;
  '@_ErrorMessage'?: string;
  '@_HighPic'?: string;
  '@_HighPicWidth'?: string;
  '@_HighPicHeight'?: string;
  Supplier?: RawSupplier;
  Category?: RawCategory;
  ProductDescription?: RawProductDescription;
  ProductGallery?: RawGallery;
}

interface RawResponse {
  'ICECAT-interface'?: {
    Product?: RawProduct;
  };
}

function parseIntOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullIfEmpty(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractImages(product: RawProduct): IcecatImage[] {
  const images: IcecatImage[] = [];
  const highPic = nullIfEmpty(product['@_HighPic']);
  if (highPic) {
    images.push({
      url: highPic,
      width: parseIntOrNull(product['@_HighPicWidth']),
      height: parseIntOrNull(product['@_HighPicHeight']),
      isMain: true,
    });
  }
  const pictures = product.ProductGallery?.ProductPicture ?? [];
  for (const pic of pictures) {
    const url = nullIfEmpty(pic['@_Pic']);
    if (!url || url === highPic) continue;
    images.push({
      url,
      width: parseIntOrNull(pic['@_PicWidth']),
      height: parseIntOrNull(pic['@_PicHeight']),
      isMain: pic['@_IsMain'] === 'Y',
    });
  }
  return images;
}

function toIcecatProduct(ean: string, product: RawProduct): IcecatProduct {
  return {
    ean,
    title: nullIfEmpty(product['@_Name']),
    brand: nullIfEmpty(product.Supplier?.['@_Name']),
    mpn: nullIfEmpty(product['@_Prod_id']),
    shortDescription: nullIfEmpty(product.ProductDescription?.['@_ShortDesc']),
    longDescription: nullIfEmpty(product.ProductDescription?.['@_LongDesc']),
    categoryName: nullIfEmpty(product.Category?.['@_Name']),
    supplier: {
      name: nullIfEmpty(product.Supplier?.['@_Name']),
      address: nullIfEmpty(product.Supplier?.['@_Address']),
      email: nullIfEmpty(product.Supplier?.['@_Email']),
    },
    images: extractImages(product),
  };
}

function isNotFoundMessage(message: string | null): boolean {
  if (message === null) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('productnotfound') ||
    normalized.includes('product not found') ||
    normalized.includes('not in the list of supported')
  );
}

/**
 * Icecat Open Catalog XML client. Returns `null` on 404 or `ErrorMessage="ProductNotFound"`
 * responses — those are legitimate "no match" signals, not infrastructure failures.
 * Throws `ProductDataError` for auth failures (401), 5xx, or malformed XML.
 */
export function createIcecatClient(config: IcecatClientConfig): IcecatClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const language = config.language ?? 'de';
  const basicAuth = `Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}`;

  return {
    async fetchByEan(ean) {
      // Icecat docs show ;-separated params, but their parser accepts &-separated too.
      // We use & because Node's URL class re-encodes ; as %3B, which Icecat then
      // sees as a single literal value. URLSearchParams handles encoding correctly.
      const url = `${baseUrl}?${new URLSearchParams({
        ean_upc: ean,
        lang: language,
        output: 'productxml',
      }).toString()}`;

      return withRetry(
        async () => {
          const { statusCode, body } = await request(url, {
            method: 'GET',
            headers: { authorization: basicAuth, accept: 'application/xml' },
            bodyTimeout: HTTP_TIMEOUTS.default,
            headersTimeout: HTTP_TIMEOUTS.default,
          });
          const text = await body.text();

          if (statusCode === 404) return null;
          if (statusCode === 401 || statusCode === 403) {
            throw new ProductDataError('Icecat auth failed — check ICECAT_USER / ICECAT_PASSWORD', {
              statusCode,
              source: 'icecat',
            });
          }
          if (statusCode >= 500) {
            throw new ProductDataError(`Icecat server error ${statusCode}`, {
              statusCode,
              source: 'icecat',
            });
          }
          if (statusCode !== 200) {
            throw new ProductDataError(`Unexpected Icecat status ${statusCode}`, {
              statusCode,
              source: 'icecat',
            });
          }

          let parsed: RawResponse;
          try {
            parsed = parser.parse(text) as RawResponse;
          } catch (cause) {
            throw new ProductDataError(
              'Icecat response is not valid XML',
              { source: 'icecat', snippet: text.slice(0, 200) },
              { cause }
            );
          }

          const product = parsed['ICECAT-interface']?.Product;
          if (!product) return null;

          const errorMessage = nullIfEmpty(product['@_ErrorMessage']);
          if (isNotFoundMessage(errorMessage)) return null;
          if (errorMessage !== null) {
            throw new ProductDataError(`Icecat returned error: ${errorMessage}`, {
              source: 'icecat',
              errorMessage,
            });
          }

          return toIcecatProduct(ean, product);
        },
        {
          maxAttempts: RETRY_CONFIG.maxAttempts,
          initialDelayMs: RETRY_CONFIG.initialDelayMs,
          backoffMultiplier: RETRY_CONFIG.backoffMultiplier,
          shouldRetry: (err) => {
            if (!(err instanceof ProductDataError)) return false;
            const status = err.context.statusCode;
            return typeof status === 'number' && status >= 500;
          },
          ...(config.sleep ? { sleep: config.sleep } : {}),
        }
      );
    },
  };
}
