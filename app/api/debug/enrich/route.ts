import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import {
  buildUserHttpClient,
  loadUserIcecatCredentials,
  MissingCredentialsError,
} from '../../../../lib/user-clients';
import { createIcecatClient } from '../../../../src/modules/product-data/sources/icecatClient';

/**
 * Debug endpoint for product enrichment. Bypasses the orchestrator and
 * calls each source directly so we can see exactly what's returned
 * (and why `data_missing` keeps triggering). Gated behind auth.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const userId = Number.parseInt(session.user.id, 10);

  const url = new URL(req.url);
  const ean = url.searchParams.get('ean');
  if (!ean) {
    return NextResponse.json(
      { error: 'missing_ean', hint: 'Add ?ean=... to the URL' },
      { status: 400 }
    );
  }

  const ebayEnv: 'sandbox' | 'production' = 'sandbox';
  const result: Record<string, unknown> = { ean };

  // --- eBay Catalog ---
  try {
    const clients = await buildUserHttpClient(userId, ebayEnv);
    try {
      const catalogHits = await clients.catalog.searchByGtin(ean);
      result.ebayCatalog = {
        ok: true,
        productFound: catalogHits.length > 0,
        count: catalogHits.length,
        data: catalogHits,
      };
    } catch (catalogError) {
      result.ebayCatalog = {
        ok: false,
        error: (catalogError as Error).message,
      };
    }
  } catch (error) {
    if (error instanceof MissingCredentialsError) {
      result.ebayCatalog = { ok: false, error: 'missing_credentials', missing: error.missing };
    } else {
      result.ebayCatalog = { ok: false, error: (error as Error).message };
    }
  }

  // --- Icecat ---
  const icecatCreds = await loadUserIcecatCredentials(userId, ebayEnv);
  if (!icecatCreds) {
    result.icecat = { ok: false, error: 'no_icecat_credentials_stored' };
  } else {
    const icecat = createIcecatClient({
      user: icecatCreds.user,
      password: icecatCreds.password,
    });
    try {
      const product = await icecat.fetchByEan(ean);
      result.icecat = {
        ok: true,
        userUsed: icecatCreds.user,
        productFound: product !== null,
        data: product,
      };
    } catch (icecatError) {
      result.icecat = {
        ok: false,
        userUsed: icecatCreds.user,
        error: (icecatError as Error).message,
      };
    }
  }

  // --- Raw Icecat response for deep debugging ---
  if (icecatCreds) {
    try {
      const rawUrl = `https://data.icecat.biz/xml_s3/xml_server3.cgi?${new URLSearchParams({
        ean_upc: ean,
        lang: 'de',
        output: 'productxml',
      }).toString()}`;
      const basicAuth = `Basic ${Buffer.from(`${icecatCreds.user}:${icecatCreds.password}`).toString('base64')}`;
      const rawResp = await fetch(rawUrl, {
        headers: { authorization: basicAuth, accept: 'application/xml' },
      });
      const rawText = await rawResp.text();
      result.icecatRaw = {
        status: rawResp.status,
        url: rawUrl,
        bodySnippet: rawText.slice(0, 500),
      };
    } catch (error) {
      result.icecatRaw = { error: (error as Error).message };
    }
  }

  return NextResponse.json(result, { status: 200 });
}
