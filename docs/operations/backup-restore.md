# Backup and recovery

The VPS backup is a PostgreSQL custom-format dump of `word_atlas`, plus every owned audio file (final, pending and original source), encrypted with AES-256-CBC and PBKDF2 (200,000 iterations). A separate SHA-256 manifest verifies the encrypted archive and the decrypted database dump. Files and the encryption key are owner-only. No other application's database is included or modified.

Run `/bin/sh /srv/apps/word-atlas-ops/backup-word-atlas.sh` as the existing deployment user. A lock prevents overlapping backups; a 4 GiB free-space gate stops new work. Incomplete files never replace `latest-success`. Two completed backups are retained. PostgreSQL is dumped before collecting append-only audio: extra files are harmless and committed references should have their corresponding files. The private `/api/status` endpoint reports the latest successful backup timestamp and free audio-volume space.

Copy the independent encrypted archive to the owner's Mac with `sh ops/pull-backup.sh`. It verifies SHA-256 before updating `backups/latest-verified-offsite`. The decryption key is also held outside the VPS at `~/.config/word-atlas/backup.key`; it must be preserved separately. The Mac is not a runtime dependency and no mini PC is used. A sleeping/offline Mac cannot provide a guaranteed 24-hour offsite recovery point. This implementation therefore reports the actual copy timestamp rather than claiming continuous offsite protection.

Restore only into an isolated, newly named database:

```sh
WORD_ATLAS_PG_CONTAINER=word-atlas-restore-audit sh ops/restore-word-atlas.sh \
  backups/TIMESTAMP.tar.enc ~/.config/word-atlas/backup.key \
  word_atlas_restore_audit backups/restore-audit
```

The restore refuses existing output directories/databases and names outside `word_atlas_restore_*`. Archive extraction rejects links, traversal, unexpected paths and duplicate members before calling `pg_restore`. The restore container is PostgreSQL 17, isolated from production. Do not start a synthesis worker against restored data until allowance and file integrity have been reconciled; retained reservations must never be reset to regain allowance.

This portable audit restore uses the local restore operator as table owner. To promote a new database on the VPS after a disaster, create it with the restricted `word_atlas` role as owner and restore with `pg_restore --no-owner --role=word_atlas`; verify ownership and private connectivity before updating `DATABASE_URL`. Never point the application at an unverified audit database or overwrite the live database as a shortcut.

For a missing final MP3, copy or restore the original source file and run `backend/scripts/reconcile-audio.js` with the exact asset key and directory. It takes the worker lock, recovers from retained bytes, verifies the expected checksum, and never contacts Google. A request for a missing ready file reports `cached_file_missing`; it does not automatically generate a replacement.

Verified exercises and the nightly schedule installation are recorded in the acceptance report. The first sample restore completed in 25.98 seconds, restored the active 10,000-entry release, and matched all four then-ready audio checksums. Independent real-file recovery of the four reviewed clips took 130–230 ms with `--network none`, no database credentials and no provider credentials; all checksums matched. See [audio recovery evidence](../verification/audio-recovery.json). Full-corpus restore results supersede the sample measurements when available.

## Full production proof — 30 October 2026

Archive `20261030T000407Z.tar.enc`: 680,058,912 bytes; backup duration 316.79 seconds. The Mac copy was verified at 00:10:06 UTC. Full isolated restore took 138.48 seconds and matched the 1,499,153 active entries, a synthetic owner's exact save/history records, six final MP3 hashes and two retained usage rows totaling 434 units. No worker/provider ran during recovery. The synthetic identity was removed from production afterward. See [full restore](../verification/full-restore.json) and [snapshot](../verification/backup-expected.json).

The existing deployment user's crontab now runs Word Atlas at 02:30 UTC daily. Other backup entries are unchanged. The scheduled command is `/bin/sh /srv/apps/word-atlas-ops/backup-word-atlas.sh`, with output in `/srv/apps/word-atlas-backups/backup.log`. The original crontab is retained in the Word Atlas rollback directory. Only actual run timestamps establish freshness; installation alone is not a successful backup.
