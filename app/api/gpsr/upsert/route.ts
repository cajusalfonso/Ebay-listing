import { NextResponse } from 'next/server';
import { upsertGpsrOverrideAction } from '../../../(app)/settings/gpsr-actions';

export async function POST(req: Request) {
  const formData = await req.formData();
  const result = await upsertGpsrOverrideAction(formData);
  return NextResponse.json(result);
}
