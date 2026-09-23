-- Setzt bei allen Modellen von "Affordable Gadgets Llc" die Farbe auf
-- "Alle Farben" (Supplier liefert gemischte Farben, keine Einzelangabe).
-- Passt die E-Mail unten an, falls sie nicht mit deinem Login uebereinstimmt.

update public.product_models pm
set color = 'Alle Farben'
where pm.supplier_id = (
  select id from public.suppliers
  where company_name = 'Affordable Gadgets Llc'
    and user_id = (select id from auth.users where email = 'b2b@cajus-handel.com')
);
