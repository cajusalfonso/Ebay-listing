import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createEpsClient, type EpsUploadConfig } from './eps';
import { EbayApiError } from './errors';

const SANDBOX_API = 'https://api.sandbox.ebay.com';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

function config(overrides: Partial<EpsUploadConfig> = {}): EpsUploadConfig {
  return {
    environment: 'sandbox',
    devId: 'dev-id',
    appId: 'app-id',
    certId: 'cert-id',
    getAuthToken: () => Promise.resolve('user-token'),
    ...overrides,
  };
}

const SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<UploadSiteHostedPicturesResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <SiteHostedPictureDetails>
    <FullURL>https://i.ebayimg.com/00/s/MTYwMFgxNjAw/z/abc/$_57.JPG</FullURL>
    <PictureSetMember>
      <MemberURL>https://i.ebayimg.com/00/s/thumb/abc.jpg</MemberURL>
      <PictureHeight>1600</PictureHeight>
      <PictureWidth>1600</PictureWidth>
    </PictureSetMember>
  </SiteHostedPictureDetails>
</UploadSiteHostedPicturesResponse>`;

describe('EpsClient.uploadPicture — happy path', () => {
  it('POSTs multipart to /ws/api.dll with required Trading-API headers and returns FullURL', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/ws/api.dll',
        method: 'POST',
        headers: (h) =>
          h['x-ebay-api-call-name'] === 'UploadSiteHostedPictures' &&
          h['x-ebay-api-siteid'] === '77' &&
          h['x-ebay-api-dev-name'] === 'dev-id' &&
          h['x-ebay-api-app-name'] === 'app-id' &&
          h['x-ebay-api-cert-name'] === 'cert-id' &&
          h['content-type']!.startsWith('multipart/form-data; boundary=--'),
      })
      .reply(200, SUCCESS_XML, { headers: { 'content-type': 'text/xml' } });

    const client = createEpsClient(config());
    const result = await client.uploadPicture(Buffer.from('fake-jpeg-bytes'), 'photo.jpg');
    expect(result.fullUrl).toContain('i.ebayimg.com');
    expect(result.width).toBe(1600);
    expect(result.height).toBe(1600);
  });

  it('includes the auth token inside the XML payload', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/ws/api.dll',
        method: 'POST',
        body: (b) => b.includes('<eBayAuthToken>user-token</eBayAuthToken>'),
      })
      .reply(200, SUCCESS_XML);
    await createEpsClient(config()).uploadPicture(Buffer.from('x'));
  });
});

describe('EpsClient.uploadPicture — error responses', () => {
  it('throws EbayApiError on Ack=Failure with eBay error message', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/ws/api.dll', method: 'POST' }).reply(
      200,
      `<UploadSiteHostedPicturesResponse>
          <Ack>Failure</Ack>
          <Errors>
            <ErrorCode>21916614</ErrorCode>
            <ShortMessage>Invalid picture</ShortMessage>
            <LongMessage>The picture could not be uploaded — unsupported format.</LongMessage>
          </Errors>
        </UploadSiteHostedPicturesResponse>`
    );
    try {
      await createEpsClient(config()).uploadPicture(Buffer.from('x'));
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayApiError);
      expect((err as EbayApiError).message).toContain('unsupported format');
      // fast-xml-parser auto-parses numeric strings → ErrorCode comes through as number.
      expect(String((err as EbayApiError).context.errorCode)).toBe('21916614');
    }
  });

  it('throws on HTTP 500', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/ws/api.dll', method: 'POST' }).reply(500, 'oops');
    await expect(createEpsClient(config()).uploadPicture(Buffer.from('x'))).rejects.toThrow(
      /HTTP 500/
    );
  });

  it('throws when FullURL is missing from Success response (malformed)', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: '/ws/api.dll', method: 'POST' })
      .reply(
        200,
        `<UploadSiteHostedPicturesResponse><Ack>Success</Ack></UploadSiteHostedPicturesResponse>`
      );
    await expect(createEpsClient(config()).uploadPicture(Buffer.from('x'))).rejects.toThrow(
      /missing FullURL/
    );
  });
});

describe('EpsClient — routing', () => {
  it('uses api.ebay.com on production', async () => {
    const pool = mockAgent.get('https://api.ebay.com');
    pool.intercept({ path: '/ws/api.dll', method: 'POST' }).reply(200, SUCCESS_XML);
    const c = createEpsClient(config({ environment: 'production' }));
    await c.uploadPicture(Buffer.from('x'));
  });
});
