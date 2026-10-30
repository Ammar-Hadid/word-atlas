-- Verified with EXPLAIN on >900,000 imported entries: the explicit-C prefix
-- queries use the ordered indexes from 006. These earlier indexes duplicate
-- their lookup role and add avoidable import writes. No table/data is removed.
DROP INDEX IF EXISTS entries_folded_prefix_idx;
DROP INDEX IF EXISTS forms_prefix_idx;
