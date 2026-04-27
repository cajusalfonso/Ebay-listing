import { NextResponse } from 'next/server';
import { savePricingSettingsAction } from '../../../(app)/settings/pricing-actions';

export async function POST(req: Request) {
  const formData = await req.formData();
  const result = await savePricingSettingsAction(formData);
  return NextResponse.json(result);
}
