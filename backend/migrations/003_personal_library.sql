CREATE TABLE users (
    id text PRIMARY KEY,
    username text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX sessions_expire ON sessions(expire);
CREATE TABLE request_limits (
    bucket text NOT NULL, subject text NOT NULL, window_start timestamptz NOT NULL,
    requests integer NOT NULL DEFAULT 0, PRIMARY KEY(bucket,subject,window_start)
);
CREATE TABLE saved_entries (
    user_id text NOT NULL REFERENCES users(id), term_key text NOT NULL,
    display_term text NOT NULL, entry_id text REFERENCES entries(id),
    source_reference text, saved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(user_id,term_key)
);
CREATE TABLE search_history (
    user_id text NOT NULL REFERENCES users(id), term_key text NOT NULL,
    display_term text NOT NULL, entry_id text REFERENCES entries(id),
    source_reference text, first_visited_at timestamptz NOT NULL,
    last_visited_at timestamptz NOT NULL, visit_count bigint NOT NULL DEFAULT 1 CHECK(visit_count>0),
    PRIMARY KEY(user_id,term_key)
);
CREATE INDEX saved_entries_recent ON saved_entries(user_id,saved_at DESC,term_key);
CREATE INDEX search_history_recent ON search_history(user_id,last_visited_at DESC,term_key);
CREATE TABLE personal_operations (
    user_id text NOT NULL REFERENCES users(id), operation_id text NOT NULL,
    payload_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(user_id,operation_id)
);
CREATE TABLE editorial_usage (
    reference text NOT NULL, used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX editorial_usage_window ON editorial_usage(reference,used_at);
