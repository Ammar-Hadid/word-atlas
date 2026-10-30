#!/bin/sh
# Restore only into a newly-created isolated database. Never overwrite production.
set -eu
[ "$#" -eq 4 ] || { echo 'Usage: restore-word-atlas.sh encrypted.tar.enc key-file word_atlas_restore_NAME output-directory'; exit 1; }
archive=$1
key=$2
database=$3
pg_container=${WORD_ATLAS_PG_CONTAINER:-nexo-postgres}
output=$4
case "$database" in word_atlas_restore_*) ;; *) echo 'Use an isolated restore database name' >&2; exit 1;; esac
case "$database" in *[!a-z0-9_]*) exit 1;; esac
[ ! -e "$output" ] || { echo 'Output must not exist'; exit 1; }
umask 077
mkdir -p "$output"
python3 - "$archive" <<'PYVERIFY'
import sys,pathlib,hashlib
p=pathlib.Path(sys.argv[1]);expected=p.with_name(p.name.removesuffix('.tar.enc')+'.sha256').read_text().split()[0]
h=hashlib.sha256()
with p.open('rb') as stream:
    while chunk:=stream.read(1024*1024):h.update(chunk)
if h.hexdigest()!=expected:raise SystemExit('Encrypted archive checksum mismatch')
PYVERIFY
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$key" -in "$archive" -out "$output/backup.tar"
python3 "$(dirname "$0")/extract-backup.py" "$output/backup.tar" "$output"
# createdb fails if it exists; no --clean, no production DROP.
docker exec "$pg_container" createdb -U postgres "$database"
docker exec -i "$pg_container" pg_restore -U postgres --no-owner --exit-on-error -d "$database" < "$output/database.dump"
echo "Restored isolated database $database; audio is in $output/audio. Synthesis remains disabled until verification."
