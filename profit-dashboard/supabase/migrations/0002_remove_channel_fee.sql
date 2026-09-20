-- Entfernt die prozentuale Kanalgebühr pro Bestellung.
-- Grund: Idealo/Geizhals/billiger.de/testsieger.de laufen über CPC
-- (Kosten pro Klick, nicht pro Verkauf) und lassen sich nicht sinnvoll
-- als fixer %-Satz pro Bestellung abbilden. CPC-Werbekosten werden
-- stattdessen als Fixkosten (Kategorie "Werbung") erfasst.
-- Im Supabase SQL Editor ausführen, nachdem 0001_init.sql bereits lief.

alter table public.orders drop column if exists channel_fee_percent;
alter table public.settings drop column if exists channel_fee_defaults;
