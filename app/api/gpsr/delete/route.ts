import { NextResponse } from 'next/server';
import { deleteGpsrOverrideAction } from '../../../(app)/settings/gpsr-actions';

export async function POST(req: Request) {
  const formData = await req.formData();
  const result = await deleteGpsrOverrideAction(formData);
  return NextResponse.json(result);
}
