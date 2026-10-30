-- Dictionary content is release-scoped. Stable entries are never cascade-deleted.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  license text NOT NULL,
  attribution text NOT NULL,
  active_release_id text
);
CREATE TABLE dictionary_releases (
  id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES sources(id),
  status text NOT NULL DEFAULT 'staging' CHECK (status IN ('staging','validated','failed','published')),
  manifest jsonb NOT NULL,
  counts jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  published_at timestamptz
);
ALTER TABLE sources ADD CONSTRAINT sources_active_release_fk FOREIGN KEY (active_release_id) REFERENCES dictionary_releases(id);
CREATE TABLE entries (
  id text PRIMARY KEY,
  language text NOT NULL,
  headword text NOT NULL,
  part_of_speech text NOT NULL,
  kind text NOT NULL,
  lookup_key text NOT NULL,
  folded_key text NOT NULL,
  source_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entries_lookup_idx ON entries(lookup_key);
CREATE INDEX entries_folded_prefix_idx ON entries(folded_key text_pattern_ops);
CREATE INDEX entries_folded_trgm_idx ON entries USING gist(folded_key gist_trgm_ops);
CREATE TABLE source_entries (
  release_id text NOT NULL REFERENCES dictionary_releases(id),
  entry_id text NOT NULL REFERENCES entries(id),
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  PRIMARY KEY(release_id, entry_id)
);
CREATE INDEX source_entries_entry_idx ON source_entries(entry_id,release_id);
CREATE TABLE forms (
  release_id text NOT NULL,
  entry_id text NOT NULL,
  form text NOT NULL,
  lookup_key text NOT NULL,
  folded_key text NOT NULL,
  labels text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY(release_id,entry_id,form),
  FOREIGN KEY(release_id,entry_id) REFERENCES source_entries(release_id,entry_id)
);
CREATE INDEX forms_lookup_idx ON forms(release_id,lookup_key);
CREATE INDEX forms_prefix_idx ON forms(folded_key text_pattern_ops,release_id);
CREATE TABLE import_rejections (
  release_id text NOT NULL REFERENCES dictionary_releases(id),
  line_number bigint NOT NULL,
  reason text NOT NULL,
  record_hash text,
  PRIMARY KEY(release_id,line_number)
);
INSERT INTO sources(id,name,url,license,attribution) VALUES
 ('wiktionary-en','English Wiktionary via Kaikki','https://kaikki.org/dictionary/rawdata.html','CC BY-SA 4.0','English Wiktionary contributors; extracted by Wiktextract/Kaikki. Normalized by Word Atlas; quoted examples and media excluded unless separately licensed.');
