-- Clear stale price comparison cache rows written before the sanity filter
-- (accessory keywords + outlier-price removal) was added. Existing rows were
-- polluted with phone cases and cables that Google Shopping fuzzy-matched to
-- the EAN. Safe to wipe: next Preview re-fetches from SerpAPI.
DELETE FROM "price_comparisons";
