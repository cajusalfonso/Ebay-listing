-- Aufraeum- + Update-Skript fuer "Affordable Gadgets Llc".
-- Es gab durch versehentliches doppeltes Ausfuehren zwei Supplier-Eintraege:
--   13483e69-50a6-4463-900c-210157432304  (9 Modelle, durcheinander)
--   19ba956f-7cab-42c1-b942-b95a135e0b26  (42 Modelle, vollstaendig/original)
-- Dieses Skript loescht den ersten komplett und aktualisiert den zweiten
-- (VK-Preise, Farbe, Entfernen nicht mehr gefuehrter Modelle).
-- Einmal komplett ausfuehren.

-- 1) Doppelten, unvollstaendigen Supplier samt seiner Modelle loeschen
delete from public.product_models
where supplier_id = '13483e69-50a6-4463-900c-210157432304';

delete from public.suppliers
where id = '13483e69-50a6-4463-900c-210157432304';

-- 2) VK-Preise beim vollstaendigen Supplier eintragen
update public.product_models pm
set sale_price_gross = v.vk
from (values
  ('Samsung Galaxy A07', '128GB', 160),
  ('Samsung Galaxy A15', '4GB/128GB', 220),
  ('Samsung Galaxy A15', '6GB/128GB', 250),
  ('Samsung Galaxy A16', '128GB', 170),
  ('Samsung Galaxy A17', '4GB/128GB', 200),
  ('Samsung Galaxy A17', '6GB/128GB', 220),
  ('Samsung Galaxy A17', '8GB/128GB', 240),
  ('Samsung Galaxy A23', '128GB', 290),
  ('Samsung Galaxy A24', '128GB', 300),
  ('Samsung Galaxy A25', '128GB', 330),
  ('Samsung Galaxy A26', '256GB', 340),
  ('Samsung Galaxy A32', '128GB', 340),
  ('Samsung Galaxy A33', '128GB', 300),
  ('Samsung Galaxy A34', '128GB', 330),
  ('Samsung Galaxy A35', '128GB', 300),
  ('Samsung Galaxy A36 5G', '128GB', 320),
  ('Samsung Galaxy A53', '128GB', 350),
  ('Samsung Galaxy A54', '128GB', 360),
  ('Samsung Galaxy A55', '128GB', 370),
  ('Samsung Galaxy A56', '256GB', 400),
  ('Samsung Galaxy Z Fold4', '512GB', 840),
  ('Samsung Galaxy Z Fold5', '512GB', 870),
  ('Samsung Galaxy Z Fold6', '512GB', 1050),
  ('Samsung Galaxy Z Fold7', '512GB', 1500),
  ('Samsung Galaxy S22 Ultra', '256GB', 480),
  ('Samsung Galaxy S23 Ultra', '256GB', 580),
  ('Samsung Galaxy S24', '128GB', 490),
  ('Samsung Galaxy S24 FE', '128GB', 450),
  ('Samsung Galaxy S24 Ultra', '256GB', 720),
  ('Samsung Galaxy S25', '128GB', 500),
  ('Samsung Galaxy S25 Ultra', '256GB', 760)
) as v(model, storage, vk)
where pm.supplier_id = '19ba956f-7cab-42c1-b942-b95a135e0b26'
  and pm.model = v.model
  and pm.storage = v.storage;

-- 3) Nicht mehr gefuehrte Modelle entfernen
delete from public.product_models
where supplier_id = '19ba956f-7cab-42c1-b942-b95a135e0b26'
  and (model, storage) in (
    ('Samsung Galaxy Z Flip8', '256GB'),
    ('Samsung Galaxy Z Flip8', '512GB'),
    ('Samsung Galaxy Z Fold8', '256GB'),
    ('Samsung Galaxy Z Fold8', '512GB'),
    ('Samsung Galaxy Z Fold8', '1TB'),
    ('Samsung Galaxy Z Fold8 Ultra', '256GB'),
    ('Samsung Galaxy Z Fold8 Ultra', '512GB'),
    ('Samsung Galaxy Z Fold8 Ultra', '1TB'),
    ('Samsung Galaxy S26 Ultra', '12GB/256GB'),
    ('Samsung Galaxy S26 Ultra', '12GB/512GB'),
    ('Samsung Galaxy S26 Ultra', '16GB/1TB')
  );

-- 4) Farbe setzen
update public.product_models
set color = 'Alle Farben'
where supplier_id = '19ba956f-7cab-42c1-b942-b95a135e0b26';

-- 5) Kontrolle: sollte danach 30 Zeilen zeigen
select count(*) as verbleibende_modelle
from public.product_models
where supplier_id = '19ba956f-7cab-42c1-b942-b95a135e0b26';
