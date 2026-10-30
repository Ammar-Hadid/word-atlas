# Deployment and rollback

Production originally lives at `/srv/apps/word-atlas/docker-compose.yml`; Caddy configuration `/srv/apps/caddy/Caddyfile`. Prior files and database globals/identity backup are in `/srv/apps/word-atlas-rollbacks/20261029` (mode-restricted). Existing images retained as `word-atlas-backend:before-persistence-20261029` and `word-atlas-frontend:before-persistence-20261029`. No unrelated application image or volume was deleted.

Candidate code lives at `/srv/apps/word-atlas-candidate`. The reproducible configuration is `ops/compose.yaml`. Secrets are in `/srv/apps/word-atlas-data/production.env`; existing MW keys remain in `/srv/data/word-atlas/backend/backend.env`. Audio and imports live beneath `/srv/apps/word-atlas-data`. PostgreSQL remains `nexo-postgres` on `nexo-school-db`; only Word Atlas backend/worker join that private database network. Backend pool 5, worker 2, importer 2; the existing PostgreSQL limit of 30 is unchanged.

The dedicated `word_atlas` login owns only its own database, with no superuser/create-role/create-database privileges. A separate `word_atlas_test` database/role is used for fixtures. Migrations use a PostgreSQL advisory lock, checksummed version records and transactions; changed applied migrations are rejected.

One owner is provisioned through `backend/scripts/create-owner.js` using bcrypt cost 12. No signup exists. Session cookies are Secure/HttpOnly/SameSite=Lax in production and host-only; same-origin POST/PUT/DELETE additionally require a CSRF token. Credentials are outside the repository; the initial owner login is on the owner's Mac at `~/.config/word-atlas/owner-login.txt`. The inspected Nexo identity service is a synthetic guardian/student trial and is not reused.

For an application rollback, stop only the Word Atlas audio worker, select the retained pre-persistence frontend/backend image tags in the Word Atlas compose file, and run `docker compose -p word-atlas -f /srv/apps/word-atlas/docker-compose.yml up -d --no-build frontend backend`. Restore only the Word Atlas domain block from the saved Caddyfile, preserving any later edits for other applications; validate with the currently running Caddy image before reload. Keep database/audio mounts intact; no down migration or destructive database reset is needed. Corpus rollback switches `sources.active_release_id` to an already-validated release with the importer `publishRelease()` function. Existing personal IDs/audio survive that switch. Browser originals `wa:saved` and `wa:history` remain intact for rollback, and pending changes use a separate outbox.

Rollout status and exact verification results are recorded in `docs/acceptance-report.md`; do not infer deployment from the existence of configuration files.

## Reproducible rollout

1. Build immutable, dated image tags from `backend/Dockerfile` and `frontend/Dockerfile` in `/srv/apps/word-atlas-candidate`. Do not put credentials in build context or image layers.
2. Update the image tags in `ops/compose.yaml`, copy it to `/srv/apps/word-atlas/docker-compose.yml`, and validate with `docker compose config --quiet`.
3. Apply `node scripts/migrate.js` using the backend image on the private database network with the existing protected environment file. Re-running is safe; checksum mismatches stop execution.
4. Recreate only the Word Atlas compose services with `up -d --no-build`. The worker has a writable audio mount and a read-only service-account key; the web backend has read-only audio/backup mounts and no Google key.
5. Verify `/api/health`, `/api/ready`, owner session behavior and cached audio. The private `/api/status` reports the active corpus, current allowance, disk space and last backup. Use `ops/check-word-atlas.js` for the bounded, provider-free load probe.

Caddy routes `/api/*` and `/audio/*` on `word-atlas.ammarhadid.com` to the backend and the remaining paths to the frontend. The existing API hostname remains supported. No other domain block, database setting or service image was changed. Cloudflare may challenge non-browser clients; service-time load probes run inside the backend container and are labeled accordingly.

Role setup is intentionally scoped: a `word_atlas` login with `NOSUPERUSER NOCREATEDB NOCREATEROLE`, ownership of only its own database, public database access revoked, and `ALTER ROLE word_atlas SET temp_file_limit='256MB'`. The isolated test role has the same temporary-file cap. Do not grant access to Nexo schemas or change shared PostgreSQL settings to accommodate an import.

Both retained pre-persistence images were booted in isolated `--network none` containers: the frontend served its page and the backend served the expected route-not-found response without credentials or provider access. The temporary verification containers were removed. This proves the retained images boot; corpus-switch and full database-restore evidence are recorded separately.

For the isolated integration test database from the Mac, open the authorized tunnel with `ssh -N -L 15442:127.0.0.1:15432 nexo-vps`, then run the test command using the protected `backend/.env.test`. Never substitute the production database URL. The implementation's temporary tunnels and local dev server were closed after verification.
