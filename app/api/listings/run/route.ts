import { NextResponse } from 'next/server';
import { createListingAction } from '../../../(app)/dashboard/actions';

/**
 * POST /api/listings/run
 *
 * Robust alternative to the `useActionState`-bound Server Action. Accepts
 * JSON body { ean, cogs, publish }, calls the shared server logic, and
 * returns the `ListingActionResult` as JSON. The form uses this so the
 * client never depends on Server-Action reference binding.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { ean, cogs, publish } = (body ?? {}) as {
    ean?: unknown;
    cogs?: unknown;
    publish?: unknown;
  };

  const formData = new FormData();
  formData.set('ean', String(ean ?? ''));
  formData.set('cogs', String(cogs ?? ''));
  if (publish === true || publish === 'true' || publish === 'on') {
    formData.set('publish', 'true');
  }

  try {
    const result = await createListingAction(formData);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: `Server error: ${message}` }, { status: 500 });
  }
}
