# Storage and resource gate

The initial 29 October 2026 recheck found a 75 GiB root filesystem with 11 GiB available, 3.7 GiB RAM with roughly 2 GiB available, and two CPUs. PostgreSQL 17.11 retains its existing 512 MiB limit and 30 connections. Neither PostgreSQL container nor any unrelated application's volumes or images was pruned.

After inspecting `docker builder du --verbose`, only unused build cache older than seven days was removed with `docker builder prune --filter until=168h --force`. This reclaimed 6.312 GB and raised available space to 17 GiB. All existing containers remained up. Current and rollback images were retained.

The compressed source is 3,082,185,963 bytes. It is streamed on the VPS; no multilingual uncompressed JSONL is written. A systematic sample measured approximately 3.4 KB of indexed storage per entry and supported a 5 GB full-database estimate. The full-import budget allowed 6 GB data, 1 GB WAL and 1 GB compressed backup, with a 4 GiB import stop threshold.

Runtime limits are backend 384 MiB / pool 5, worker 256 MiB / 0.5 CPU / pool 2, frontend 96 MiB. The importer uses 512 MiB, 1.25 CPU, pool 2 and 250-record batches. Import progress samples stayed below 90 MiB RSS. Audio publication stops below 2 GiB free; imports and new backups require 4 GiB. No database-wide memory/connection setting was raised.

The original final count query joined large JSON payloads into a DISTINCT aggregate and spilled temporary files. At 2.3 GiB free, only that Word Atlas query was canceled; all temporary files were released and free space returned to 6.6 GiB. The sample remained active and unrelated services remained online. Final counting was changed to narrow, bounded queries, with a Word Atlas role-specific temporary-file cap. This incident is documented rather than hidden behind the initial estimate.

A checksum-verified source copy exists on the owner's Mac under `backups/source/`. The VPS compressed download may be removed only after EOF, source checksum and full-release validation are proven. Keep its manifest and the exact reviewed rejection record. Final data sizes, cleanup evidence and free space are in the acceptance report.

Before any future full refresh, budget the active release, staged replacement, indexes, WAL, two retained backups and the 4 GiB floor. Do not assume today's headroom supports two complete releases. Corpus refreshes remain manual; no monthly automatic import is enabled. Never delete personal records, audio or another application's files to make a refresh fit.
