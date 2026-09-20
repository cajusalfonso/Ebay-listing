export const SALES_CHANNELS = [
  "Shopify",
  "Idealo",
  "Geizhals",
  "billiger.de",
  "testsieger.de",
  "Sonstige",
] as const;

export type SalesChannel = (typeof SALES_CHANNELS)[number];

export const ORDER_STATUSES = [
  "bestellt",
  "versendet",
  "verkauft",
  "retourniert",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FIXED_COST_CATEGORIES = [
  "Werbung",
  "Software/Tools",
  "Personal",
  "Miete",
  "Sonstiges",
] as const;

export type FixedCostCategory = (typeof FIXED_COST_CATEGORIES)[number];

export const FIXED_COST_RHYTHMS = ["einmalig", "monatlich"] as const;

export type FixedCostRhythm = (typeof FIXED_COST_RHYTHMS)[number];

export const CURRENCIES = ["EUR", "USD", "GBP", "CNY", "CHF"] as const;

export const DEFAULT_MARGIN_THRESHOLD = 10;
export const DEFAULT_VAT_RATE = 19;
