-- Every entry now has one US and one UK pronunciation, spoken by the matching Iapetus locale.
ALTER TABLE pronunciations DROP CONSTRAINT IF EXISTS pronunciations_language_check;
ALTER TABLE pronunciations ADD CONSTRAINT pronunciations_language_check CHECK (language IN ('en-US','en-GB'));
-- Usage is capped by fixed monthly limits far below Google's free tier, so recordings
-- no longer depend on a manually granted, expiring allowance row. Visitors and the
-- signed-in owner are counted separately so part of the cap stays reserved for the owner.
ALTER TABLE provider_usage ALTER COLUMN allowance_id DROP NOT NULL;
ALTER TABLE provider_usage ADD COLUMN audience text NOT NULL DEFAULT 'owner' CHECK (audience IN ('owner','visitor'));
