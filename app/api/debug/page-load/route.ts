import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { auth } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { isEbayConnected } from '../../../../lib/user-clients';
import { listings, needsReview } from '../../../../src/db/schema';
import { getCredentialsMaskedForUser } from '../../../(app)/settings/actions';
import { getEncryptionKey } from '../../../../lib/encryption-key';

export const dynamic = 'force-dynamic';

type StepResult =
  | { step: string; ok: true; result: unknown }
  | { step: string; ok: false; error: string; stack?: string | undefined };

async function runStep<T>(step: string, fn: () => Promise<T>): Promise<StepResult> {
  try {
    const result = await fn();
    return {
      step,
      ok: true,
      result:
        result === undefined
          ? '(void)'
          : typeof result === 'object' && result !== null
            ? JSON.parse(JSON.stringify(result))
            : result,
    };
  } catch (error) {
    const e = error as Error;
    return {
      step,
      ok: false,
      error: e.message || String(e),
      stack: e.stack,
    };
  }
}

export async function GET() {
  const steps: StepResult[] = [];

  steps.push(await runStep('getEncryptionKey', async () => {
    const key = getEncryptionKey();
    return { keyLength: key.length, keyFirstByte: key[0] };
  }));

  const sessionStep = await runStep('auth()', async () => {
    const session = await auth();
    return {
      hasSession: Boolean(session),
      userId: session?.user?.id,
      email: session?.user?.email,
    };
  });
  steps.push(sessionStep);

  const userId =
    sessionStep.ok && sessionStep.result && typeof sessionStep.result === 'object'
      ? Number.parseInt(
          (sessionStep.result as { userId?: string }).userId ?? '0',
          10
        )
      : 0;

  steps.push(await runStep('db.ping (listings count)', async () => {
    const [row] = await db
      .select({ total: count() })
      .from(listings)
      .where(and(eq(listings.userId, userId), eq(listings.status, 'published')));
    return { total: row?.total ?? 0 };
  }));

  steps.push(await runStep('needsReview count', async () => {
    const [row] = await db
      .select({ total: count() })
      .from(needsReview)
      .where(eq(needsReview.userId, userId));
    return { total: row?.total ?? 0 };
  }));

  steps.push(await runStep('isEbayConnected(sandbox)', async () => {
    return await isEbayConnected(userId, 'sandbox');
  }));

  steps.push(await runStep('getCredentialsMaskedForUser(sandbox)', async () => {
    return await getCredentialsMaskedForUser('sandbox');
  }));

  const anyFailed = steps.some((s) => !s.ok);
  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      anyFailed,
      steps,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasAuthSecret: Boolean(process.env.AUTH_SECRET),
        hasTokenEncryptionKey: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
        tokenEncryptionKeyLength: process.env.TOKEN_ENCRYPTION_KEY?.length,
        authUrl: process.env.AUTH_URL,
      },
    },
    { status: anyFailed ? 500 : 200 }
  );
}
