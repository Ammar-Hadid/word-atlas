#!/bin/sh
# Run on the owner's Mac when online. This is not a continuous offsite guarantee.
set -eu
umask 077
destination=${1:-"$HOME/Documents/localDev/projects/word-atlas/backups"}
mkdir -p "$destination"
stamp=$(ssh nexo-vps cat /srv/apps/word-atlas-backups/latest-success)
case "$stamp" in ????????T??????Z) ;; *) echo 'Invalid backup marker' >&2; exit 1;; esac
case "$stamp" in *[!0-9TZ]*) exit 1;; esac
rsync -a --partial "nexo-vps:/srv/apps/word-atlas-backups/$stamp.tar.enc" "$destination/"
rsync -a "nexo-vps:/srv/apps/word-atlas-backups/$stamp.sha256" "$destination/"
python3 - "$destination" "$stamp" <<'PY'
import hashlib,pathlib,sys
root=pathlib.Path(sys.argv[1]); stamp=sys.argv[2]
expected=(root/(stamp+'.sha256')).read_text().split()[0]
h=hashlib.sha256()
with (root/(stamp+'.tar.enc')).open('rb') as source:
    while chunk:=source.read(1024*1024): h.update(chunk)
if h.hexdigest()!=expected:raise SystemExit('Offsite checksum verification failed')
(root/'latest-verified-offsite').write_text(stamp+'\n')
print('Verified encrypted offsite backup: '+stamp)
PY
