-- Traegt den VK (sale_price_gross) bei den 37 Cdiscount-A-Serie-Modellen
-- nach (bisher 0,00 €), auf Basis der Shopify-Entwuerfe (Preis pro Modell
-- ist unabhaengig von der Farbe -- passt genau zu den bereits manuell
-- erfassten VK-Preisen im Dashboard, z.B. Samsung Galaxy A23 = 290 €).
-- Betrifft NUR den Supplier "Cdiscount".
--
-- Passt die E-Mail unten an, falls sie nicht mit deinem Login uebereinstimmt.
-- Im Supabase SQL Editor ausfuehren.

update public.product_models pm
set sale_price_gross = v.vk
from (values
  ('Samsung Galaxy A23 5G', '128GB', 290.00),
  ('Samsung Galaxy A26', '256GB', 340.00),
  ('Samsung Galaxy A32 5G', '128GB', 340.00),
  ('Samsung Galaxy A33', '128GB', 300.00),
  ('Samsung Galaxy A34', '128GB', 330.00),
  ('Samsung Galaxy A35', '128GB', 300.00),
  ('Samsung Galaxy A36', '128GB', 320.00),
  ('Samsung Galaxy A53 5G', '128GB', 350.00),
  ('Samsung Galaxy A54', '128GB', 360.00),
  ('Samsung Galaxy A55', '128GB', 370.00),
  ('Samsung Galaxy A56 5G', '128GB', 320.00),
  ('Samsung Galaxy A56', '256GB', 400.00)
) as v(model, storage, vk)
where pm.model = v.model
  and pm.storage = v.storage
  and pm.supplier_id = (
    select id from public.suppliers
    where company_name = 'Cdiscount'
      and user_id = (select id from auth.users where email = 'b2b@cajus-handel.com')
  );

-- Kontrolle: sollte 37 Zeilen mit VK > 0 zeigen
select model, storage, color, purchase_price_net, sale_price_gross
from public.product_models pm
where pm.supplier_id = (
    select id from public.suppliers
    where company_name = 'Cdiscount'
      and user_id = (select id from auth.users where email = 'b2b@cajus-handel.com')
  )
order by model, storage, color;
