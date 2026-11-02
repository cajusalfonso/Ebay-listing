/**
 * Preislogik ArbiSync.
 *
 * Grundidee (alles netto gerechnet, weil wir vorsteuerabzugsberechtigt sind):
 *
 *   VK netto        = VK brutto / (1 + USt)
 *   eBay-Gebühr     = Prozent × VK brutto + Fixbetrag   (eBay rechnet auf den Gesamtbetrag)
 *   Retourenpuffer  = Puffer-% × VK netto
 *   EK netto        = Amazon-Preis brutto / (1 + USt)
 *   Gewinn netto    = VK netto − Gebühr − Retourenpuffer − EK netto − Eigenversand
 *   Marge           = Gewinn netto / VK netto
 *
 * Gewinn ist linear im VK brutto (B):  Gewinn = a·B − c
 * Daraus lässt sich der kleinste VK direkt ausrechnen, der beide Regeln erfüllt:
 *   Gewinn ≥ Mindestgewinn   →  B ≥ (c + Mindestgewinn) / a
 *   Marge  ≥ Mindestmarge    →  B ≥ c / (a − Mindestmarge/(1+USt))
 */

export interface PricingSettings {
  /** Umsatzsteuersatz, z. B. 0.19 */
  vatRate: number;
  /** Retourenpuffer als Anteil vom Netto-VK, z. B. 0.03 */
  returnBufferPct: number;
  /** Eigene Versandkosten netto pro Bestellung (Amazon → du → Käufer), z. B. 5 */
  ownShippingNet: number;
  /** Mindestgewinn netto in €, z. B. 15 */
  minProfitNet: number;
  /** Mindestmarge vom Netto-VK, z. B. 0.10 */
  minMarginPct: number;
  /**
   * true  = die eBay-Gebührensätze sind Bruttobeträge (inkl. USt) → USt-Anteil ist Vorsteuer.
   * false = die Sätze sind die tatsächlichen Kosten (netto). Sicherer Standard.
   */
  feesIncludeVat: boolean;
  /** true = EK netto = Amazon brutto / (1+USt) (Amazon Business mit Vorsteuerabzug). */
  inputVatDeductible: boolean;
}

export interface FeeRule {
  /** Anteil vom VK brutto, z. B. 0.11 für 11 % */
  percent: number;
  /** Fixbetrag pro Verkauf in €, z. B. 0.35 */
  fixed: number;
}

export interface Breakdown {
  amazonPriceGross: number;
  ekNet: number;
  inputVat: number;
  vkGross: number;
  vkNet: number;
  vat: number;
  ebayFees: number;
  returnBuffer: number;
  ownShipping: number;
  profitNet: number;
  /** Marge vom Netto-VK als Anteil (0.1 = 10 %) */
  marginPct: number;
  /** Aufschlag VK brutto gegenüber Amazon brutto als Anteil */
  markupPct: number;
  /** Erfüllt dieser VK beide Regeln (Mindestgewinn UND Mindestmarge)? */
  meetsRules: boolean;
}

export type Recommendation =
  | { reachable: true; breakdown: Breakdown }
  | { reachable: false; reason: string };

const EPS = 1e-9;

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function assertValidInput(amazonPriceGross: number, fee: FeeRule, s: PricingSettings): void {
  if (!Number.isFinite(amazonPriceGross) || amazonPriceGross <= 0) {
    throw new Error(`Ungültiger Amazon-Preis: ${amazonPriceGross}`);
  }
  if (fee.percent < 0 || fee.percent >= 1 || fee.fixed < 0) {
    throw new Error('Ungültige eBay-Gebühr (Prozent muss zwischen 0 und 100 % liegen).');
  }
  if (s.vatRate < 0 || s.returnBufferPct < 0 || s.ownShippingNet < 0) {
    throw new Error('Ungültige Preis-Einstellungen (negative Werte).');
  }
}

export function ekNetFromAmazonGross(amazonPriceGross: number, s: PricingSettings): number {
  return s.inputVatDeductible ? amazonPriceGross / (1 + s.vatRate) : amazonPriceGross;
}

/** Kostenfaktor der Gebühr: bei Brutto-Gebühren ist der USt-Anteil Vorsteuer. */
function feeCostFactor(s: PricingSettings): number {
  return s.feesIncludeVat ? 1 / (1 + s.vatRate) : 1;
}

/** Komplette Aufschlüsselung für einen gegebenen eBay-VK brutto. */
export function breakdownAt(
  vkGross: number,
  amazonPriceGross: number,
  fee: FeeRule,
  s: PricingSettings,
): Breakdown {
  assertValidInput(amazonPriceGross, fee, s);
  const k = feeCostFactor(s);
  const vkNet = vkGross / (1 + s.vatRate);
  const ebayFees = (fee.percent * vkGross + fee.fixed) * k;
  const returnBuffer = s.returnBufferPct * vkNet;
  const ekNet = ekNetFromAmazonGross(amazonPriceGross, s);
  const profitNet = vkNet - ebayFees - returnBuffer - ekNet - s.ownShippingNet;
  const marginPct = vkNet > 0 ? profitNet / vkNet : 0;
  const meetsRules = profitNet >= s.minProfitNet - EPS && marginPct >= s.minMarginPct - EPS;

  return {
    amazonPriceGross: round2(amazonPriceGross),
    ekNet: round2(ekNet),
    inputVat: round2(amazonPriceGross - ekNet),
    vkGross: round2(vkGross),
    vkNet: round2(vkNet),
    vat: round2(vkGross - vkNet),
    ebayFees: round2(ebayFees),
    returnBuffer: round2(returnBuffer),
    ownShipping: round2(s.ownShippingNet),
    profitNet: round2(profitNet),
    marginPct: Math.round(marginPct * 10000) / 10000,
    markupPct: Math.round((vkGross / amazonPriceGross - 1) * 10000) / 10000,
    meetsRules,
  };
}

/**
 * Kleinster eBay-VK brutto (auf den Cent aufgerundet), der
 * Mindestgewinn UND Mindestmarge erfüllt.
 */
export function recommendPrice(
  amazonPriceGross: number,
  fee: FeeRule,
  s: PricingSettings,
): Recommendation {
  assertValidInput(amazonPriceGross, fee, s);
  const k = feeCostFactor(s);
  const netFactor = 1 / (1 + s.vatRate);

  // Gewinn = a·B − c
  const a = netFactor * (1 - s.returnBufferPct) - fee.percent * k;
  const c = fee.fixed * k + ekNetFromAmazonGross(amazonPriceGross, s) + s.ownShippingNet;

  if (a <= EPS) {
    return {
      reachable: false,
      reason: 'Gebühren und Retourenpuffer sind zu hoch – bei keinem Preis bleibt Gewinn übrig.',
    };
  }
  const marginDenominator = a - s.minMarginPct * netFactor;
  if (marginDenominator <= EPS) {
    return {
      reachable: false,
      reason: `Mindestmarge ${(s.minMarginPct * 100).toFixed(1)} % ist mit diesen Gebühren nicht erreichbar.`,
    };
  }

  const byProfit = (c + s.minProfitNet) / a;
  const byMargin = c / marginDenominator;
  let vk = Math.ceil(Math.max(byProfit, byMargin) * 100 - 1e-6) / 100;

  // Absicherung gegen Rundungsfehler: notfalls centweise erhöhen.
  let b = breakdownAt(vk, amazonPriceGross, fee, s);
  for (let i = 0; i < 10 && !b.meetsRules; i++) {
    vk = round2(vk + 0.01);
    b = breakdownAt(vk, amazonPriceGross, fee, s);
  }
  if (!b.meetsRules) {
    return { reachable: false, reason: 'Kein gültiger Preis gefunden (Rundungsproblem).' };
  }
  return { reachable: true, breakdown: b };
}

export interface PushThreshold {
  /** Mindestabweichung in €, z. B. 0.5 */
  minAbs: number;
  /** Mindestabweichung als Anteil, z. B. 0.01 */
  minPct: number;
}

/** Preis nur zu eBay pushen, wenn er um mehr als 0,50 € ODER mehr als 1 % abweicht. */
export function shouldPushPrice(
  currentVk: number | null,
  newVk: number,
  t: PushThreshold,
): boolean {
  if (currentVk === null || currentVk <= 0) return true;
  const diff = Math.abs(newVk - currentVk);
  return diff > t.minAbs + EPS || diff / currentVk > t.minPct + EPS;
}
