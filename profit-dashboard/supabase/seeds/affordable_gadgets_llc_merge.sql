-- Zusammenfuehren: deine manuellen Eintraege (Supplier 13483e69..., 9 Modelle)
-- + die noch fehlenden Bulk-Modelle (Supplier 19ba956f..., nach Abzug der
-- 7 Ueberschneidungen und 11 nicht mehr gefuehrten Modelle: 24 Stueck).
-- Ergebnis: ein Supplier "Affordable Gadgets Llc" mit 33 Modellen.
-- Einmal komplett ausfuehren.

-- 1) VK-Preise auf die noch relevanten Bulk-Modelle (A-Serie + Fold4-7)
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
  ('Samsung Galaxy Z Fold7', '512GB', 1500)
) as v(model, storage, vk)
where pm.supplier_id = '19ba956f-7cab-42c1-b942-b95a135e0b26'
  and pm.model = v.model
  and pm.storage = v.storage;

-- 2) Bulk-Duplikate (schon manuell vorhanden) + nicht mehr gefuehrte Modelle loeschen
delete from public.product_models
where supplier_id = '19ba956f-7cab-42c1-b942-b95a135e0b26'
  and (model, storage) in (
    ('Samsung Galaxy S22 Ultra', '256GB'),
    ('Samsung Galaxy S23 Ultra', '256GB'),
    ('Samsung Galaxy S24', '128GB'),
    ('Samsung Galaxy S24 FE', '128GB'),
    ('Samsung Galaxy S24 Ultra', '256GB'),
    ('Samsung Galaxy S25', '128GB'),
    ('Samsung Galaxy S25 Ultra', '256GB'),
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

-- 3) Farbe auf den verbleibenden Bulk-Modellen setzen
update public.product_models
set color = 'Alle Farben'
where supplier_id = '19ba956f-7cab-42c1-b942-b95a135e0b26';

-- 4) Verbleibende Bulk-Modelle zum manuellen Supplier verschieben (zusammenfuehren)
update public.product_models
set supplier_id = '13483e69-50a6-4463-900c-210157432304'
where supplier_id = '19ba956f-7cab-42c1-b942-b95a135e0b26';

-- 5) Den jetzt leeren, doppelten Supplier-Eintrag loeschen
delete from public.suppliers
where id = '19ba956f-7cab-42c1-b942-b95a135e0b26';

-- 6) Kleine Korrekturen an deinen manuellen Eintraegen: Leerzeichen-Tippfehler
--    bei "S24 " entfernen, Speicherangabe auf einheitliches Format (z.B. "256GB")
update public.product_models
set model = trim(model)
where supplier_id = '13483e69-50a6-4463-900c-210157432304';

update public.product_models
set storage = storage || 'GB'
where supplier_id = '13483e69-50a6-4463-900c-210157432304'
  and storage ~ '^[0-9]+$';

-- 7) Kontrolle: sollte 33 zeigen
select count(*) as gesamt_modelle
from public.product_models
where supplier_id = '13483e69-50a6-4463-900c-210157432304';
