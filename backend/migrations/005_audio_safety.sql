-- A verification never authorizes a future billing month. Use the narrower UTC
-- month boundary even if the billing account's reporting timezone differs.
-- Historical rows remain valid during restore because their creation date is retained.
ALTER TABLE provider_allowances ADD CONSTRAINT allowance_verified_creation_month CHECK (
    period_start >= date_trunc('month',created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    AND period_start <= created_at
    AND period_end > created_at
    AND period_end <= (date_trunc('month',created_at AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
    AND verified_until > created_at
);
CREATE INDEX provider_usage_month_idx ON provider_usage(created_at);
