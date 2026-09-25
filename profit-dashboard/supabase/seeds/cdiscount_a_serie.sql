-- Neue Modelle fuer den bereits bestehenden Supplier "Cdiscount":
-- Samsung Galaxy A-Serie, Preise von Cdiscount-Marketplace-Angeboten
-- (via idealo.fr, Stand 25.09.2026), pro Farbe eine eigene Zeile.
-- Nur Zeilen mit tatsaechlichem Cdiscount-Preis (37 von 50 aus der Liste),
-- Zeilen ohne Treffer (kein Cdiscount / nicht gelistet / nicht geprueft)
-- wurden weggelassen. VK brutto ist noch nicht bekannt und auf 0 gesetzt --
-- bitte in der App nachtragen. Spec = US.
--
-- Passt die E-Mail unten an, falls sie nicht mit deinem Login uebereinstimmt.
-- Im Supabase SQL Editor ausfuehren.

insert into public.product_models
  (user_id, supplier_id, model, storage, color, purchase_price_net, sale_price_gross, purchase_date, notes, spec)
select
  s.user_id,
  s.id,
  v.model,
  v.storage,
  v.color,
  v.ek,
  0,
  current_date,
  '',
  'US'
from (
  select id, user_id from public.suppliers
  where company_name = 'Cdiscount'
    and user_id = (select id from auth.users where email = 'b2b@cajus-handel.com')
) as s, (values
  ('Samsung Galaxy A23 5G', '128GB', 'Black', 123.48),
  ('Samsung Galaxy A23 5G', '128GB', 'Blue', 127.98),
  ('Samsung Galaxy A26', '256GB', 'Mint', 249.99),
  ('Samsung Galaxy A26', '256GB', 'Black', 254.98),
  ('Samsung Galaxy A26', '256GB', 'White', 251.00),
  ('Samsung Galaxy A32 5G', '128GB', 'Black', 128.98),
  ('Samsung Galaxy A32 5G', '128GB', 'White', 133.86),
  ('Samsung Galaxy A33', '128GB', 'Blue', 164.99),
  ('Samsung Galaxy A33', '128GB', 'White', 183.99),
  ('Samsung Galaxy A33', '128GB', 'Black', 254.00),
  ('Samsung Galaxy A34', '128GB', 'Lime', 170.99),
  ('Samsung Galaxy A34', '128GB', 'Lavender', 174.99),
  ('Samsung Galaxy A34', '128GB', 'Graphite', 179.64),
  ('Samsung Galaxy A34', '128GB', 'Silver', 194.99),
  ('Samsung Galaxy A35', '128GB', 'Lemon', 216.00),
  ('Samsung Galaxy A35', '128GB', 'Navy', 223.66),
  ('Samsung Galaxy A35', '128GB', 'Lilac', 223.88),
  ('Samsung Galaxy A35', '128GB', 'Iceblue', 233.88),
  ('Samsung Galaxy A36', '128GB', 'White', 249.99),
  ('Samsung Galaxy A36', '128GB', 'Lavender', 250.98),
  ('Samsung Galaxy A36', '128GB', 'Black', 271.98),
  ('Samsung Galaxy A53 5G', '128GB', 'Blue', 132.80),
  ('Samsung Galaxy A53 5G', '128GB', 'Black', 160.00),
  ('Samsung Galaxy A54', '128GB', 'Graphite', 178.99),
  ('Samsung Galaxy A54', '128GB', 'Lavender', 190.00),
  ('Samsung Galaxy A54', '128GB', 'Lime', 191.98),
  ('Samsung Galaxy A54', '128GB', 'White', 254.00),
  ('Samsung Galaxy A55', '128GB', 'Lemon', 301.20),
  ('Samsung Galaxy A55', '128GB', 'Iceblue/Blue', 303.00),
  ('Samsung Galaxy A55', '128GB', 'Navy', 303.88),
  ('Samsung Galaxy A55', '128GB', 'Lilac', 310.00),
  ('Samsung Galaxy A56 5G', '128GB', 'Graphite', 289.49),
  ('Samsung Galaxy A56 5G', '128GB', 'Olive', 299.99),
  ('Samsung Galaxy A56 5G', '128GB', 'Pink', 300.98),
  ('Samsung Galaxy A56 5G', '128GB', 'Lightgray', 314.27),
  ('Samsung Galaxy A56', '256GB', 'Graphite', 339.99),
  ('Samsung Galaxy A56', '256GB', 'Pink', 373.99)
) as v(model, storage, color, ek);

-- Kontrolle: sollte 37 neue Zeilen zeigen
select count(*) as neue_modelle
from public.product_models pm
join public.suppliers s on s.id = pm.supplier_id
where s.company_name = 'Cdiscount'
  and pm.spec = 'US'
  and pm.purchase_date = current_date;
