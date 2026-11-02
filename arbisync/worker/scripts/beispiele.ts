/**
 * Zeigt eine Beispieltabelle mit den Standard-Einstellungen.
 * Aufruf:  npm run beispiel            → Standardpreise
 *          npm run beispiel -- 89 249  → eigene Amazon-Preise
 */
import { recommendPrice } from '../src/pricing/calc';
import { DEFAULT_SETTINGS, feeRuleFor } from '../src/settings';

const s = DEFAULT_SETTINGS;
const fee = feeRuleFor(s);
const args = (process.argv as string[]).slice(2).map((a: string) => Number(a.replace(',', '.'))).filter((n: number) => n > 0);
const prices = args.length ? args : [19.99, 49.99, 119, 299, 595, 999];

const eur = (n: number) => n.toFixed(2).replace('.', ',') + ' €';
const pct = (n: number) => (n * 100).toFixed(1).replace('.', ',') + ' %';

console.log('\nArbiSync – Beispielrechnung mit Standard-Einstellungen');
console.log(
  `Gebühr ${pct(fee.percent)} + ${eur(fee.fixed)}, Retourenpuffer ${pct(s.pricing.returnBufferPct)}, ` +
    `Eigenversand ${eur(s.pricing.ownShippingNet)}, Regel: Gewinn ≥ ${eur(s.pricing.minProfitNet)} UND Marge ≥ ${pct(s.pricing.minMarginPct)}\n`,
);

const rows = prices.map((p) => {
  const r = recommendPrice(p, fee, s.pricing);
  if (!r.reachable) return { 'Amazon brutto': eur(p), Ergebnis: r.reason };
  const b = r.breakdown;
  return {
    'Amazon brutto': eur(b.amazonPriceGross),
    'EK netto': eur(b.ekNet),
    'eBay-VK brutto': eur(b.vkGross),
    USt: eur(b.vat),
    'eBay-Gebühr': eur(b.ebayFees),
    Retouren: eur(b.returnBuffer),
    Versand: eur(b.ownShipping),
    'Gewinn netto': eur(b.profitNet),
    Marge: pct(b.marginPct),
    Aufschlag: pct(b.markupPct),
  };
});
console.table(rows);
