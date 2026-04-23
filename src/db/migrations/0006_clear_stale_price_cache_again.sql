-- Clear the price_comparisons cache again — filter thresholds were tightened
-- (50% median floor + €20 absolute floor for products over €100). Existing
-- cached rows were fetched under the looser 30% threshold.
DELETE FROM "price_comparisons";
