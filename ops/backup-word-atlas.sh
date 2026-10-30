#!/bin/sh
# Run as the existing VPS deployment user. Docker access supplies pg_dump only.
set -eu
umask 077
root=/srv/apps/word-atlas-backups
key=/srv/apps/word-atlas-ops/backup.key
[ -f "$key" ] || { echo 'Backup encryption key missing' >&2; exit 1; }
mkdir -p "$root"
[ ! -L "$root" ] || exit 1
exec 9>"$root/.lock"
flock -n 9 || exit 0
free_kb=$(df -Pk "$root" | awk 'NR==2 {print $4}')
[ "$free_kb" -gt 4194304 ] || { echo 'Low disk: backup stopped' >&2; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
work=$(mktemp -d "$root/staging.XXXXXX")
cleanup() {
    if [ -n "${tar_pid:-}" ]; then kill "$tar_pid" 2>/dev/null || true; fi
    rm -f "$work/database.dump" "$work/manifest.txt" "$work/archive.pipe" "$root/$stamp.tar.enc.part"
    rmdir "$work" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM
# Dump first. Audio publication is append-only, so subsequent audio may be extra
# but no committed DB reference should be missing from this snapshot.
docker exec nexo-postgres pg_dump -U postgres -Fc word_atlas > "$work/database.dump"
printf 'Word Atlas backup\ncreated_at=%s\npostgres=17\n' "$stamp" > "$work/manifest.txt"
sha256sum "$work/database.dump" >> "$work/manifest.txt"
# pipefail is unavailable in POSIX sh; explicitly capture tar output before encrypt.
# Compression is already used by pg_dump and MP3. Tar uses a FIFO with checked PID.
mkfifo "$work/archive.pipe"
tar -C "$work" -cf "$work/archive.pipe" database.dump manifest.txt -C /srv/apps/word-atlas-data audio &
tar_pid=$!
if ! openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$key" -in "$work/archive.pipe" -out "$root/$stamp.tar.enc.part"; then
    kill "$tar_pid" 2>/dev/null || true; rm -f "$work/archive.pipe"; exit 1
fi
wait "$tar_pid"
tar_pid=
rm "$work/archive.pipe"
mv "$root/$stamp.tar.enc.part" "$root/$stamp.tar.enc"
sha256sum "$root/$stamp.tar.enc" > "$root/$stamp.sha256"
printf '%s\n' "$stamp" > "$root/latest-success"
# Only owned timestamp-named backup files; keep two completed full backups.
find "$root" -maxdepth 1 -type f -name '????????T??????Z.tar.enc' | sort -r | tail -n +3 | while IFS= read -r old; do
    rm -f "$old" "${old%.tar.enc}.sha256"
done
printf 'Backup complete: %s\n' "$stamp"
