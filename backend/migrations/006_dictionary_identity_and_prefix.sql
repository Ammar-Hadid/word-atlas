-- A source signature describes one extraction; it is not the durable lexical ID.
-- Only proven, unambiguous refresh mappings get aliases. Ambiguities remain visible.
CREATE FUNCTION word_atlas_source_family(source_key text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT jsonb_build_array(source_key::jsonb->0, source_key::jsonb->1, source_key::jsonb->2)::text
$$;
CREATE INDEX entries_source_family_idx ON entries(word_atlas_source_family(source_key));
CREATE TABLE entry_identity_aliases (
  signature text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES entries(id),
  family_key text NOT NULL,
  source_id text NOT NULL REFERENCES sources(id),
  ambiguous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE dictionary_identity_events (
  release_id text NOT NULL REFERENCES dictionary_releases(id),
  family_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('mapped','ambiguous')),
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(release_id,family_key,kind)
);
-- Matching collation makes ORDER BY ... LIMIT an index walk, not a prefix sort.
CREATE INDEX entries_suggestion_order_idx ON entries(folded_key COLLATE "C",headword,id);
CREATE INDEX forms_suggestion_order_idx ON forms(folded_key COLLATE "C",form,release_id);
