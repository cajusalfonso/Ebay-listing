import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings';
import { breakdownAt, recommendPrice, shouldPushPrice, type FeeRule, type PricingSettings } from './calc';

const S: PricingSettings = DEFAULT_SETTINGS.pricing; // 19 % USt, 3 % Retouren, 5 € Versand, 15 € / 10 %
const FEE: FeeRule = { percent: 0.11, fixed: 0.35 };

function ok(amazon: number, fee = FEE, s = S) {
  const r = recommendPrice(amazon, fee, s);
  if (!r.reachable) throw new Error(r.reason);
  return r.breakdown;
}

describe('Beispielrechnung 1: Amazon 119,00 € brutto (Mindestgewinn 15 € ist die harte Grenze)', () => {
  const b = ok(119);

  it('EK netto = 119 / 1,19 = 100,00 €, Vorsteuer 19,00 €', () => {
    expect(b.ekNet).toBe(100);
    expect(b.inputVat).toBe(19);
  });

  it('empfohlener eBay-VK brutto = 170,68 €', () => {
    // (100 + 5 + 0,35 + 15) / (1/1,19 · 0,97 − 0,11) = 170,676… → aufgerundet 170,68
    expect(b.vkGross).toBe(170.68);
  });

  it('Aufschlüsselung stimmt', () => {
    expect(b.vkNet).toBe(143.43);
    expect(b.vat).toBe(27.25);
    expect(b.ebayFees).toBe(19.12); // 11 % × 170,68 + 0,35
    expect(b.returnBuffer).toBe(4.3);
    expect(b.ownShipping).toBe(5);
    expect(b.profitNet).toBe(15);
    expect(b.marginPct).toBeGreaterThanOrEqual(0.1);
    expect(b.meetsRules).toBe(true);
  });

  it('ein Cent weniger erfüllt die Regel nicht mehr', () => {
    expect(breakdownAt(170.67, 119, FEE, S).meetsRules).toBe(false);
  });
});

describe('Beispielrechnung 2: Amazon 595,00 € brutto (Mindestmarge 10 % ist die harte Grenze)', () => {
  const b = ok(595);

  it('EK netto 500,00 €, VK 813,65 €, Gewinn ≥ 15 € und Marge genau ~10 %', () => {
    expect(b.ekNet).toBe(500);
    expect(b.vkGross).toBe(813.65);
    expect(b.profitNet).toBeGreaterThan(15);
    expect(b.marginPct).toBeGreaterThanOrEqual(0.1);
    expect(b.marginPct).toBeLessThan(0.1001);
    expect(breakdownAt(813.64, 595, FEE, S).meetsRules).toBe(false);
  });
});

describe('Beispielrechnung 3: billiger Artikel, Amazon 19,99 €', () => {
  it('braucht mehr als doppelten Preis – zeigt, warum Kleinkram selten lohnt', () => {
    const b = ok(19.99);
    expect(b.vkGross).toBe(52.69);
    expect(b.markupPct).toBeGreaterThan(1.6);
    expect(b.profitNet).toBe(15);
  });
});

describe('Gebühren-Varianten', () => {
  it('Brutto-Gebühren (USt als Vorsteuer) senken den nötigen VK', () => {
    const net = ok(119);
    const gross = ok(119, FEE, { ...S, feesIncludeVat: true });
    expect(gross.vkGross).toBeLessThan(net.vkGross);
    expect(gross.meetsRules).toBe(true);
  });

  it('ohne Vorsteuerabzug ist EK = Bruttopreis', () => {
    const b = ok(119, FEE, { ...S, inputVatDeductible: false });
    expect(b.ekNet).toBe(119);
    expect(b.inputVat).toBe(0);
  });

  it('unerreichbar, wenn Gebühren alles auffressen', () => {
    const r = recommendPrice(100, { percent: 0.85, fixed: 0 }, S);
    expect(r.reachable).toBe(false);
  });

  it('unerreichbar, wenn die Mindestmarge zu hoch ist', () => {
    const r = recommendPrice(100, FEE, { ...S, minMarginPct: 0.85 });
    expect(r.reachable).toBe(false);
    if (!r.reachable) expect(r.reason).toContain('Mindestmarge');
  });

  it('lehnt ungültige Preise ab', () => {
    expect(() => recommendPrice(0, FEE, S)).toThrow();
    expect(() => recommendPrice(Number.NaN, FEE, S)).toThrow();
  });
});

describe('Erfüllt jeder empfohlene Preis beide Regeln? (100 Stichproben)', () => {
  it('ja, und immer der kleinste Cent-Betrag', () => {
    for (let p = 5; p < 2000; p += 19.97) {
      const amazon = Math.round(p * 100) / 100;
      const b = ok(amazon);
      expect(b.meetsRules).toBe(true);
      expect(b.profitNet).toBeGreaterThanOrEqual(15);
      expect(breakdownAt(b.vkGross - 0.01, amazon, FEE, S).meetsRules).toBe(false);
    }
  });
});

describe('Preis-Push-Schwelle (> 1 % ODER > 0,50 €)', () => {
  const t = DEFAULT_SETTINGS.pushThreshold;

  it('kein Push bei kleiner Änderung', () => {
    expect(shouldPushPrice(50, 50.4, t)).toBe(false); // 0,40 € = 0,8 %
  });

  it('Push, wenn über 1 % (auch unter 0,50 €)', () => {
    expect(shouldPushPrice(20, 20.3, t)).toBe(true); // 0,30 € = 1,5 %
  });

  it('Push, wenn über 0,50 € (auch unter 1 %)', () => {
    expect(shouldPushPrice(200, 200.6, t)).toBe(true); // 0,60 € = 0,3 %
  });

  it('kein Push bei 0,40 € auf 200 € (0,2 %)', () => {
    expect(shouldPushPrice(200, 200.4, t)).toBe(false);
  });

  it('Push auch bei Preissenkung', () => {
    expect(shouldPushPrice(200, 198, t)).toBe(true);
  });

  it('immer Push, wenn noch kein Preis auf eBay steht', () => {
    expect(shouldPushPrice(null, 100, t)).toBe(true);
  });
});
