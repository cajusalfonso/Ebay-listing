import type { ComplianceInput } from './types';

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

/**
 * GPSR (EU General Product Safety Regulation, §12) requires the manufacturer
 * name, physical address, and at least one electronic means of contact for
 * every product sold. Missing fields are hard blockers — no GPSR data, no publish.
 */
export function checkGpsr(product: ComplianceInput): string[] {
  const blockers: string[] = [];
  const gpsr = product.gpsrData;

  if (gpsr === null || isBlank(gpsr.manufacturerName)) {
    blockers.push('gpsr_manufacturer_name_missing');
  }
  if (gpsr === null || isBlank(gpsr.manufacturerAddress)) {
    blockers.push('gpsr_manufacturer_address_missing');
  }
  if (gpsr === null || isBlank(gpsr.manufacturerEmail)) {
    blockers.push('gpsr_manufacturer_email_missing');
  }
  return blockers;
}
