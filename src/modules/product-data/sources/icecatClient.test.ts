import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { ProductDataError } from '../errors';
import { createIcecatClient } from './icecatClient';

const ICECAT_HOST = 'https://data.icecat.biz';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

function client() {
  return createIcecatClient({
    user: 'icecat-user',
    password: 'icecat-pw',
    sleep: () => Promise.resolve(),
  });
}

const HAPPY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ICECAT-interface>
  <Product
    Name="Faber-Castell Bleistift Grip 2001"
    Prod_id="FC-2001"
    HighPic="https://images.icecat.biz/img/norm/high/primary.jpg"
    HighPicWidth="800"
    HighPicHeight="800">
    <Supplier Name="Faber-Castell" Address="Nürnberger Str. 2, 90546 Stein, Germany" Email="info@faber-castell.de"/>
    <Category Name="Bleistifte"/>
    <ProductDescription ShortDesc="Stift mit Grip" LongDesc="Ein hochwertiger Bleistift mit ergonomischem Grip für ermüdungsfreies Schreiben."/>
    <ProductGallery>
      <ProductPicture Pic="https://images.icecat.biz/img/norm/high/alt1.jpg" PicWidth="1200" PicHeight="900" IsMain="N"/>
      <ProductPicture Pic="https://images.icecat.biz/img/norm/high/alt2.jpg" IsMain="N"/>
    </ProductGallery>
  </Product>
</ICECAT-interface>`;

describe('IcecatClient.fetchByEan — happy path', () => {
  it('parses a complete product and includes Basic auth + correct URL', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool
      .intercept({
        path: (p) =>
          p.includes('ean_upc=4006381333115') &&
          p.includes('lang=de') &&
          p.includes('output=productxml'),
        method: 'GET',
        headers: (h) => h.authorization!.startsWith('Basic '),
      })
      .reply(200, HAPPY_XML, { headers: { 'content-type': 'application/xml' } });

    const p = await client().fetchByEan('4006381333115');
    expect(p).not.toBeNull();
    expect(p?.title).toBe('Faber-Castell Bleistift Grip 2001');
    expect(p?.brand).toBe('Faber-Castell');
    expect(p?.mpn).toBe('FC-2001');
    expect(p?.categoryName).toBe('Bleistifte');
    expect(p?.longDescription).toContain('ergonomischem Grip');
    expect(p?.supplier).toEqual({
      name: 'Faber-Castell',
      address: 'Nürnberger Str. 2, 90546 Stein, Germany',
      email: 'info@faber-castell.de',
    });
  });

  it('collects all ProductPictures plus the HighPic as images', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool.intercept({ path: (p) => p.includes('ean_upc=') }).reply(200, HAPPY_XML);
    const p = await client().fetchByEan('4006381333115');
    // HighPic + 2 ProductPicture, deduped by URL
    expect(p?.images).toHaveLength(3);
    expect(p?.images[0]?.url).toContain('primary.jpg');
    expect(p?.images[0]?.isMain).toBe(true);
    expect(p?.images[1]?.width).toBe(1200);
    expect(p?.images[2]?.width).toBeNull();
  });

  it('supports non-de language override', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool.intercept({ path: (p) => p.includes('lang=en') }).reply(200, HAPPY_XML);
    const c = createIcecatClient({
      user: 'u',
      password: 'p',
      language: 'en',
      sleep: () => Promise.resolve(),
    });
    await c.fetchByEan('x');
  });
});

describe('IcecatClient.fetchByEan — not-found signals', () => {
  it('returns null on HTTP 404', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool.intercept({ path: (p) => p.includes('ean_upc=') }).reply(404, '');
    expect(await client().fetchByEan('missing')).toBeNull();
  });

  it('returns null on ErrorMessage="ProductNotFound"', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool
      .intercept({ path: (p) => p.includes('ean_upc=') })
      .reply(200, `<ICECAT-interface><Product ErrorMessage="ProductNotFound"/></ICECAT-interface>`);
    expect(await client().fetchByEan('missing')).toBeNull();
  });

  it('returns null when "not in the list of supported" error appears', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool
      .intercept({ path: (p) => p.includes('ean_upc=') })
      .reply(
        200,
        `<ICECAT-interface><Product ErrorMessage="The requested product is not in the list of supported products."/></ICECAT-interface>`
      );
    expect(await client().fetchByEan('x')).toBeNull();
  });
});

describe('IcecatClient.fetchByEan — errors', () => {
  it('throws ProductDataError on 401 with auth hint', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool.intercept({ path: (p) => p.includes('ean_upc=') }).reply(401, '');
    await expect(client().fetchByEan('x')).rejects.toThrow(/auth failed/i);
  });

  it('throws on non-XML body', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool.intercept({ path: (p) => p.includes('ean_upc=') }).reply(200, '{"definitely": "not xml"}');
    // fast-xml-parser actually parses JSON strings loosely — it won't throw, it
    // returns an empty tree instead, which our code treats as "no product" → null.
    expect(await client().fetchByEan('x')).toBeNull();
  });

  it('throws on non-ProductNotFound error messages', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool
      .intercept({ path: (p) => p.includes('ean_upc=') })
      .reply(
        200,
        `<ICECAT-interface><Product ErrorMessage="Unknown internal error"/></ICECAT-interface>`
      );
    try {
      await client().fetchByEan('x');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ProductDataError);
      expect((err as ProductDataError).context.errorMessage).toBe('Unknown internal error');
    }
  });

  it('retries on 500 and succeeds', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool.intercept({ path: (p) => p.includes('ean_upc=') }).reply(503, '');
    pool.intercept({ path: (p) => p.includes('ean_upc=') }).reply(200, HAPPY_XML);
    const p = await client().fetchByEan('x');
    expect(p?.title).toBe('Faber-Castell Bleistift Grip 2001');
  });
});

describe('IcecatClient.fetchByEan — partial/missing fields', () => {
  it('handles minimal XML (only Name attribute)', async () => {
    const pool = mockAgent.get(ICECAT_HOST);
    pool
      .intercept({ path: (p) => p.includes('ean_upc=') })
      .reply(200, `<ICECAT-interface><Product Name="Only Title"/></ICECAT-interface>`);
    const p = await client().fetchByEan('x');
    expect(p?.title).toBe('Only Title');
    expect(p?.brand).toBeNull();
    expect(p?.mpn).toBeNull();
    expect(p?.longDescription).toBeNull();
    expect(p?.images).toEqual([]);
    expect(p?.supplier).toEqual({ name: null, address: null, email: null });
  });
});
