-- Audio identities are independent of corpus releases. Old references survive refreshes.
CREATE TABLE pronunciations (
  id text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES entries(id),
  spoken_text text NOT NULL CHECK (length(spoken_text) BETWEEN 1 AND 200),
  language text NOT NULL DEFAULT 'en-US' CHECK (language = 'en-US'),
  source_ipa text,
  phoneme text,
  label text NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('validated','text','unsupported','ambiguous')),
  reason text,
  sense_ids jsonb NOT NULL DEFAULT '[]',
  source_detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pronunciations_entry_idx ON pronunciations(entry_id);
CREATE TABLE audio_assets (
  asset_key text PRIMARY KEY CHECK (asset_key ~ '^[a-f0-9]{64}$'),
  config jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','ready','failed','uncertain','unavailable','allowance_exhausted')),
  file_path text,
  checksum text,
  byte_size integer,
  duration_seconds double precision,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ready' OR (file_path IS NOT NULL AND checksum IS NOT NULL AND duration_seconds > 0))
);
CREATE TABLE audio_jobs (
  asset_key text PRIMARY KEY REFERENCES audio_assets(asset_key),
  pronunciation_id text NOT NULL REFERENCES pronunciations(id),
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','complete','failed','uncertain','blocked')),
  lease_until timestamptz,
  dispatched_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 1),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audio_jobs_queue_idx ON audio_jobs(created_at) WHERE status = 'queued';
CREATE INDEX audio_jobs_user_idx ON audio_jobs(requested_by,created_at);
-- An operator grants a known allocation only AFTER checking the whole billing account.
-- Grants expire, never roll over, and may be revoked immediately. Budget alerts are not caps.
CREATE TABLE provider_allowances (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider text NOT NULL CHECK (provider = 'google-chirp3-hd'),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  character_limit integer NOT NULL CHECK (character_limit BETWEEN 1 AND 100000),
  reserved_characters integer NOT NULL DEFAULT 0 CHECK (reserved_characters >= 0),
  verified_until timestamptz NOT NULL,
  verification_evidence text NOT NULL CHECK (length(verification_evidence) >= 20),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end > period_start AND verified_until <= period_end),
  CHECK (reserved_characters <= character_limit),
  UNIQUE(provider,period_start,period_end)
);
CREATE TABLE provider_usage (
  asset_key text PRIMARY KEY REFERENCES audio_assets(asset_key),
  allowance_id bigint NOT NULL REFERENCES provider_allowances(id),
  characters integer NOT NULL CHECK (characters > 0),
  state text NOT NULL CHECK (state IN ('reserved','consumed','uncertain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
