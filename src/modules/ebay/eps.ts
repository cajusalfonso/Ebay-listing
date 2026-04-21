import { randomBytes } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { request } from 'undici';
import { EBAY_BASE_URLS, HTTP_TIMEOUTS, type EbayEnvironment } from '../../config/constants';
import { EbayApiError } from './errors';

/**
 * eBay Site ID — 77 = Germany. Required by the Trading API EPS endpoint.
 * See https://developer.ebay.com/devzone/finding/CallRef/Enums/GlobalIdList.html
 */
const SITE_ID_DE = '77';

/**
 * Compatibility level for the Trading API. Pinned rather than defaulted so
 * XML payload semantics don't shift under us on a silent eBay upgrade.
 */
const COMPAT_LEVEL = '1193';

interface EpsParsedResponse {
  UploadSiteHostedPicturesResponse?: {
    Ack?: string;
    Errors?: { LongMessage?: string; ShortMessage?: string; ErrorCode?: string };
    SiteHostedPictureDetails?: {
      FullURL?: string;
      PictureSetMember?: { MemberURL?: string; PictureHeight?: string; PictureWidth?: string }[];
    };
  };
}

const parser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  isArray: (name) => name === 'PictureSetMember',
});

export interface EpsUploadConfig {
  readonly environment: EbayEnvironment;
  readonly devId: string;
  readonly appId: string;
  readonly certId: string;
  readonly siteId?: string;
  /** Must return a valid User Access Token — passed inside the XML `<eBayAuthToken>`. */
  readonly getAuthToken: () => Promise<string>;
}

export interface EpsUploadResult {
  readonly fullUrl: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface EpsClient {
  /**
   * Upload a processed image buffer. Returns the eBay-hosted URL suitable for
   * passing as `imageUrls` in the Inventory API. The URL is stable for the
   * product's lifetime, so persist it into `product_images.ebay_eps_url` and
   * reuse rather than re-uploading (EPS is metered at volume).
   */
  uploadPicture(buffer: Buffer, filename?: string): Promise<EpsUploadResult>;
}

function buildBoundary(): string {
  return `----EbayVolumeToolBoundary${randomBytes(12).toString('hex')}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildXmlPayload(authToken: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${escapeXml(authToken)}</eBayAuthToken>
  </RequesterCredentials>
  <PictureSet>Standard</PictureSet>
  <PictureUploadPolicy>Add</PictureUploadPolicy>
</UploadSiteHostedPicturesRequest>`;
}

function buildMultipartBody(
  xmlPayload: string,
  imageBuffer: Buffer,
  filename: string
): {
  body: Buffer;
  contentType: string;
} {
  const boundary = buildBoundary();
  const CRLF = '\r\n';

  const xmlPart = Buffer.from(
    `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="XML Payload"${CRLF}` +
      `Content-Type: text/xml; charset=utf-8${CRLF}${CRLF}` +
      xmlPayload +
      CRLF
  );

  const imagePartHeader = Buffer.from(
    `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="dummy"; filename="${filename}"${CRLF}` +
      `Content-Type: application/octet-stream${CRLF}` +
      `Content-Transfer-Encoding: binary${CRLF}${CRLF}`
  );

  const closing = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);

  return {
    body: Buffer.concat([xmlPart, imagePartHeader, imageBuffer, closing]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/**
 * eBay Picture Service (EPS) client — uploads a processed image via the legacy
 * Trading API (`UploadSiteHostedPictures`), returns the hosted URL.
 *
 * The Trading API is not the prettiest surface eBay offers, but it's stable,
 * auth'd with the same User Access Token as Inventory, and the EPS URLs it
 * returns are accepted by the Inventory API as `imageUrls`.
 *
 * NOTE: Has not yet been exercised against live sandbox in this MVP. If the
 * first real sandbox call reveals a shape difference (XML namespace, response
 * field), adjust here — all downstream code only depends on the returned URL.
 */
export function createEpsClient(config: EpsUploadConfig): EpsClient {
  const endpoint = `${EBAY_BASE_URLS[config.environment].api}/ws/api.dll`;
  const siteId = config.siteId ?? SITE_ID_DE;

  return {
    async uploadPicture(buffer, filename = 'image.jpg') {
      const authToken = await config.getAuthToken();
      const xml = buildXmlPayload(authToken);
      const multipart = buildMultipartBody(xml, buffer, filename);

      const { statusCode, body } = await request(endpoint, {
        method: 'POST',
        headers: {
          'content-type': multipart.contentType,
          'x-ebay-api-compatibility-level': COMPAT_LEVEL,
          'x-ebay-api-dev-name': config.devId,
          'x-ebay-api-app-name': config.appId,
          'x-ebay-api-cert-name': config.certId,
          'x-ebay-api-call-name': 'UploadSiteHostedPictures',
          'x-ebay-api-siteid': siteId,
        },
        body: multipart.body,
        bodyTimeout: HTTP_TIMEOUTS.ebayEpsUpload,
        headersTimeout: HTTP_TIMEOUTS.ebayEpsUpload,
      });

      const text = await body.text();

      if (statusCode !== 200) {
        throw new EbayApiError(`EPS upload HTTP ${statusCode}`, {
          statusCode,
          rawText: text.slice(0, 500),
        });
      }

      let parsed: EpsParsedResponse;
      try {
        parsed = parser.parse(text) as EpsParsedResponse;
      } catch (cause) {
        throw new EbayApiError(
          'EPS response is not valid XML',
          { rawText: text.slice(0, 500) },
          { cause }
        );
      }

      const response = parsed.UploadSiteHostedPicturesResponse;
      if (!response || response.Ack === 'Failure') {
        const errorMessage = response?.Errors?.LongMessage ?? response?.Errors?.ShortMessage;
        throw new EbayApiError(`EPS upload failed: ${errorMessage ?? 'unknown reason'}`, {
          ack: response?.Ack ?? 'missing',
          errorCode: response?.Errors?.ErrorCode ?? null,
        });
      }

      const fullUrl = response.SiteHostedPictureDetails?.FullURL;
      if (!fullUrl) {
        throw new EbayApiError('EPS response missing FullURL', { rawText: text.slice(0, 500) });
      }

      const firstMember = response.SiteHostedPictureDetails?.PictureSetMember?.[0];
      const width = firstMember?.PictureWidth
        ? Number.parseInt(firstMember.PictureWidth, 10)
        : null;
      const height = firstMember?.PictureHeight
        ? Number.parseInt(firstMember.PictureHeight, 10)
        : null;

      return {
        fullUrl,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
      };
    },
  };
}
