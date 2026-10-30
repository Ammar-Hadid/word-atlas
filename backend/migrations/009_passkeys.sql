-- Passwords are retired: the owner signs in with a passkey only.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
UPDATE users SET password_hash = NULL;
CREATE TABLE passkeys (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id),
    public_key bytea NOT NULL,
    counter bigint NOT NULL DEFAULT 0 CHECK (counter >= 0),
    transports jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
);
CREATE INDEX passkeys_user_idx ON passkeys(user_id);
-- One-time links for adding a passkey, created from the server command line.
CREATE TABLE passkey_setup_tokens (
    token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    user_id text NOT NULL REFERENCES users(id),
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
