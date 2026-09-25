-- Synchronisiert den Verkaufspreis (sale_price_gross) im Dashboard mit den
-- tatsaechlich live auf Shopify (lumox.store) stehenden Preisen.
-- Gescraped am 25.09.2026 ueber den Shopify Admin API MCP-Connector.
-- Betrifft NUR die vier Smartphone-Produkte (S23, S24 Ultra, S25, S25 Ultra),
-- keine Zubehoerartikel (Huelle, Starlink, Ladegeraet) -- die sind aktuell
-- nicht als Modelle im Dashboard erfasst.
--
-- Ablauf:
--   1) Exakter Treffer auf Modell + Speicher + Farbe -> Preis wird direkt
--      uebernommen (case-insensitive, trim).
--   2) Zeilen ohne passende Farbe (z.B. Farbe = 'Alle Farben' oder leer)
--      -> guenstigster Shopify-Preis fuer Modell + Speicher wird gesetzt
--      (konservative Annahme).
-- Modellname wird sowohl mit als auch ohne "5G"-Suffix abgeglichen, weil
-- im Dashboard bisher ohne "5G" erfasst wurde (z.B. "Samsung Galaxy S25").
--
-- Einmal im Supabase SQL Editor ausfuehren. Aendert KEINE Einkaufspreise,
-- nur sale_price_gross.

with shopify_prices (model, storage, color, price) as (
  values
    ('Samsung Galaxy S23 5G', '128GB', 'Phantom Black', 400.00),
    ('Samsung Galaxy S23 5G', '256GB', 'Phantom Black', 520.00),
    ('Samsung Galaxy S23 5G', '128GB', 'Cream', 400.00),
    ('Samsung Galaxy S23 5G', '256GB', 'Cream', 520.00),
    ('Samsung Galaxy S23 5G', '128GB', 'Green', 400.00),
    ('Samsung Galaxy S23 5G', '256GB', 'Green', 520.00),
    ('Samsung Galaxy S23 5G', '128GB', 'Lavender', 400.00),
    ('Samsung Galaxy S23 5G', '256GB', 'Lavender', 520.00),

    ('Samsung Galaxy S24 Ultra 5G', '256GB', 'Titanium Black', 720.00),
    ('Samsung Galaxy S24 Ultra 5G', '512GB', 'Titanium Black', 800.00),
    ('Samsung Galaxy S24 Ultra 5G', '1TB', 'Titanium Black', 980.00),
    ('Samsung Galaxy S24 Ultra 5G', '256GB', 'Titanium Gray', 730.00),
    ('Samsung Galaxy S24 Ultra 5G', '512GB', 'Titanium Gray', 800.00),
    ('Samsung Galaxy S24 Ultra 5G', '1TB', 'Titanium Gray', 1100.00),
    ('Samsung Galaxy S24 Ultra 5G', '256GB', 'Titanium Violet', 730.00),
    ('Samsung Galaxy S24 Ultra 5G', '512GB', 'Titanium Violet', 800.00),
    ('Samsung Galaxy S24 Ultra 5G', '256GB', 'Titanium Yellow', 790.00),
    ('Samsung Galaxy S24 Ultra 5G', '512GB', 'Titanium Yellow', 800.00),

    ('Samsung Galaxy S25 5G', '128GB', 'Icyblue', 500.00),
    ('Samsung Galaxy S25 5G', '256GB', 'Icyblue', 560.00),
    ('Samsung Galaxy S25 5G', '512GB', 'Icyblue', 750.00),
    ('Samsung Galaxy S25 5G', '256GB', 'Mint', 560.00),
    ('Samsung Galaxy S25 5G', '512GB', 'Mint', 750.00),
    ('Samsung Galaxy S25 5G', '128GB', 'Navy', 500.00),
    ('Samsung Galaxy S25 5G', '256GB', 'Navy', 560.00),
    ('Samsung Galaxy S25 5G', '512GB', 'Navy', 750.00),
    ('Samsung Galaxy S25 5G', '128GB', 'Silver Shadow', 500.00),
    ('Samsung Galaxy S25 5G', '256GB', 'Silver Shadow', 560.00),
    ('Samsung Galaxy S25 5G', '512GB', 'Silver Shadow', 750.00),

    ('Samsung Galaxy S25 Ultra 5G', '256GB', 'Titanium Black', 760.00),
    ('Samsung Galaxy S25 Ultra 5G', '512GB', 'Titanium Black', 840.00),
    ('Samsung Galaxy S25 Ultra 5G', '1TB', 'Titanium Black', 1100.00),
    ('Samsung Galaxy S25 Ultra 5G', '256GB', 'Titanium Silverblue', 850.00),
    ('Samsung Galaxy S25 Ultra 5G', '512GB', 'Titanium Silverblue', 960.00),
    ('Samsung Galaxy S25 Ultra 5G', '1TB', 'Titanium Silverblue', 1100.00),
    ('Samsung Galaxy S25 Ultra 5G', '256GB', 'Titanium Whitesilver', 760.00),
    ('Samsung Galaxy S25 Ultra 5G', '512GB', 'Titanium Whitesilver', 840.00),
    ('Samsung Galaxy S25 Ultra 5G', '1TB', 'Titanium Whitesilver', 1050.00),
    ('Samsung Galaxy S25 Ultra 5G', '256GB', 'Titanium Gray', 760.00),
    ('Samsung Galaxy S25 Ultra 5G', '512GB', 'Titanium Gray', 840.00),
    ('Samsung Galaxy S25 Ultra 5G', '1TB', 'Titanium Gray', 1040.00)
),
-- Modellname auch ohne "5G"-Suffix anbieten, falls so im Dashboard erfasst
shopify_prices_both_names as (
  select model, storage, color, price from shopify_prices
  union all
  select regexp_replace(model, ' 5G$', ''), storage, color, price from shopify_prices
)

-- 1) Exakter Farb-Treffer
update public.product_models pm
set sale_price_gross = v.price
from shopify_prices_both_names v
where pm.storage = v.storage
  and pm.model = v.model
  and lower(trim(pm.color)) = lower(trim(v.color));

-- 2) Zeilen ohne passende Farbe: guenstigster Shopify-Preis je Modell+Speicher
with shopify_prices (model, storage, color, price) as (
  values
    ('Samsung Galaxy S23 5G', '128GB', 'Phantom Black', 400.00),
    ('Samsung Galaxy S23 5G', '256GB', 'Phantom Black', 520.00),
    ('Samsung Galaxy S23 5G', '128GB', 'Cream', 400.00),
    ('Samsung Galaxy S23 5G', '256GB', 'Cream', 520.00),
    ('Samsung Galaxy S23 5G', '128GB', 'Green', 400.00),
    ('Samsung Galaxy S23 5G', '256GB', 'Green', 520.00),
    ('Samsung Galaxy S23 5G', '128GB', 'Lavender', 400.00),
    ('Samsung Galaxy S23 5G', '256GB', 'Lavender', 520.00),

    ('Samsung Galaxy S24 Ultra 5G', '256GB', 'Titanium Black', 720.00),
    ('Samsung Galaxy S24 Ultra 5G', '512GB', 'Titanium Black', 800.00),
    ('Samsung Galaxy S24 Ultra 5G', '1TB', 'Titanium Black', 980.00),
    ('Samsung Galaxy S24 Ultra 5G', '256GB', 'Titanium Gray', 730.00),
    ('Samsung Galaxy S24 Ultra 5G', '512GB', 'Titanium Gray', 800.00),
    ('Samsung Galaxy S24 Ultra 5G', '1TB', 'Titanium Gray', 1100.00),
    ('Samsung Galaxy S24 Ultra 5G', '256GB', 'Titanium Violet', 730.00),
    ('Samsung Galaxy S24 Ultra 5G', '512GB', 'Titanium Violet', 800.00),
    ('Samsung Galaxy S24 Ultra 5G', '256GB', 'Titanium Yellow', 790.00),
    ('Samsung Galaxy S24 Ultra 5G', '512GB', 'Titanium Yellow', 800.00),

    ('Samsung Galaxy S25 5G', '128GB', 'Icyblue', 500.00),
    ('Samsung Galaxy S25 5G', '256GB', 'Icyblue', 560.00),
    ('Samsung Galaxy S25 5G', '512GB', 'Icyblue', 750.00),
    ('Samsung Galaxy S25 5G', '256GB', 'Mint', 560.00),
    ('Samsung Galaxy S25 5G', '512GB', 'Mint', 750.00),
    ('Samsung Galaxy S25 5G', '128GB', 'Navy', 500.00),
    ('Samsung Galaxy S25 5G', '256GB', 'Navy', 560.00),
    ('Samsung Galaxy S25 5G', '512GB', 'Navy', 750.00),
    ('Samsung Galaxy S25 5G', '128GB', 'Silver Shadow', 500.00),
    ('Samsung Galaxy S25 5G', '256GB', 'Silver Shadow', 560.00),
    ('Samsung Galaxy S25 5G', '512GB', 'Silver Shadow', 750.00),

    ('Samsung Galaxy S25 Ultra 5G', '256GB', 'Titanium Black', 760.00),
    ('Samsung Galaxy S25 Ultra 5G', '512GB', 'Titanium Black', 840.00),
    ('Samsung Galaxy S25 Ultra 5G', '1TB', 'Titanium Black', 1100.00),
    ('Samsung Galaxy S25 Ultra 5G', '256GB', 'Titanium Silverblue', 850.00),
    ('Samsung Galaxy S25 Ultra 5G', '512GB', 'Titanium Silverblue', 960.00),
    ('Samsung Galaxy S25 Ultra 5G', '1TB', 'Titanium Silverblue', 1100.00),
    ('Samsung Galaxy S25 Ultra 5G', '256GB', 'Titanium Whitesilver', 760.00),
    ('Samsung Galaxy S25 Ultra 5G', '512GB', 'Titanium Whitesilver', 840.00),
    ('Samsung Galaxy S25 Ultra 5G', '1TB', 'Titanium Whitesilver', 1050.00),
    ('Samsung Galaxy S25 Ultra 5G', '256GB', 'Titanium Gray', 760.00),
    ('Samsung Galaxy S25 Ultra 5G', '512GB', 'Titanium Gray', 840.00),
    ('Samsung Galaxy S25 Ultra 5G', '1TB', 'Titanium Gray', 1040.00)
),
shopify_prices_both_names as (
  select model, storage, price from shopify_prices
  union all
  select regexp_replace(model, ' 5G$', ''), storage, price from shopify_prices
),
min_per_model_storage as (
  select model, storage, min(price) as min_price
  from shopify_prices_both_names
  group by model, storage
)
update public.product_models pm
set sale_price_gross = g.min_price
from min_per_model_storage g
where pm.model = g.model
  and pm.storage = g.storage
  and lower(trim(pm.color)) in ('', 'alle farben');

-- Kontrolle: aktuelle VK je Modell/Speicher/Farbe der betroffenen Modelle
select model, storage, color, sale_price_gross
from public.product_models
where model ilike 'Samsung Galaxy S23%'
   or model ilike 'Samsung Galaxy S24 Ultra%'
   or model ilike 'Samsung Galaxy S25%'
order by model, storage, color;
