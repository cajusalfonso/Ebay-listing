-- Einmaliges Daten-Skript: Supplier "Affordable Gadgets Llc" (US-Spec)
-- inkl. Preisliste. EK-Preise wurden von USD in EUR umgerechnet
-- (Kurs 0,92 EUR/USD, Stand der Eingabe). VK brutto ist noch nicht bekannt
-- und wurde auf 0 gesetzt -- bitte in der App nachtragen.
--
-- Passt die E-Mail unten an, falls sie nicht mit deinem Login uebereinstimmt.
-- Im Supabase SQL Editor ausfuehren, NUR EINMAL (sonst doppelter Supplier).

with supplier_insert as (
  insert into public.suppliers (user_id, company_name, platform, notes)
  select id, 'Affordable Gadgets Llc', 'Sonstige', 'Preise in USD erfasst, zu EUR umgerechnet (Kurs 0,92)'
  from auth.users
  where email = 'b2b@cajus-handel.com'
  returning id, user_id
)
insert into public.product_models
  (user_id, supplier_id, model, storage, color, purchase_price_net, sale_price_gross, purchase_date, notes, spec)
select
  supplier_insert.user_id,
  supplier_insert.id,
  v.model,
  v.storage,
  '',
  v.ek_eur,
  0,
  current_date,
  '',
  'US'
from supplier_insert, (values
  ('Samsung Galaxy A07', '128GB', 69.00),
  ('Samsung Galaxy A15', '4GB/128GB', 59.80),
  ('Samsung Galaxy A15', '6GB/128GB', 64.40),
  ('Samsung Galaxy A16', '128GB', 69.00),
  ('Samsung Galaxy A17', '4GB/128GB', 87.40),
  ('Samsung Galaxy A17', '6GB/128GB', 101.20),
  ('Samsung Galaxy A17', '8GB/128GB', 105.80),
  ('Samsung Galaxy A23', '128GB', 92.00),
  ('Samsung Galaxy A24', '128GB', 96.60),
  ('Samsung Galaxy A25', '128GB', 101.20),
  ('Samsung Galaxy A26', '256GB', 105.80),
  ('Samsung Galaxy A32', '128GB', 110.40),
  ('Samsung Galaxy A33', '128GB', 119.60),
  ('Samsung Galaxy A34', '128GB', 133.40),
  ('Samsung Galaxy A35', '128GB', 142.60),
  ('Samsung Galaxy A36 5G', '128GB', 156.40),
  ('Samsung Galaxy A53', '128GB', 138.00),
  ('Samsung Galaxy A54', '128GB', 165.60),
  ('Samsung Galaxy A55', '128GB', 197.80),
  ('Samsung Galaxy A56', '256GB', 220.80),
  ('Samsung Galaxy Z Fold4', '512GB', 391.00),
  ('Samsung Galaxy Z Fold5', '512GB', 418.60),
  ('Samsung Galaxy Z Fold6', '512GB', 680.80),
  ('Samsung Galaxy Z Fold7', '512GB', 1085.60),
  ('Samsung Galaxy Z Flip8', '256GB', 1490.40),
  ('Samsung Galaxy Z Flip8', '512GB', 1628.40),
  ('Samsung Galaxy Z Fold8', '256GB', 1738.80),
  ('Samsung Galaxy Z Fold8', '512GB', 1849.20),
  ('Samsung Galaxy Z Fold8', '1TB', 1987.20),
  ('Samsung Galaxy Z Fold8 Ultra', '256GB', 2060.80),
  ('Samsung Galaxy Z Fold8 Ultra', '512GB', 2134.40),
  ('Samsung Galaxy Z Fold8 Ultra', '1TB', 2208.00),
  ('Samsung Galaxy S22 Ultra', '256GB', 289.80),
  ('Samsung Galaxy S23 Ultra', '256GB', 312.80),
  ('Samsung Galaxy S24', '128GB', 280.60),
  ('Samsung Galaxy S24 FE', '128GB', 243.80),
  ('Samsung Galaxy S24 Ultra', '256GB', 450.80),
  ('Samsung Galaxy S25', '128GB', 377.20),
  ('Samsung Galaxy S25 Ultra', '256GB', 611.80),
  ('Samsung Galaxy S26 Ultra', '12GB/256GB', 901.60),
  ('Samsung Galaxy S26 Ultra', '12GB/512GB', 947.60),
  ('Samsung Galaxy S26 Ultra', '16GB/1TB', 1044.20)
) as v(model, storage, ek_eur);
