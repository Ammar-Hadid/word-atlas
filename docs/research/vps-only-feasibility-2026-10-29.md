# VPS-only feasibility inspection — 29 October 2026

Read-only SSH inspection of nexo-vps. No mini PC connection, cleanup, deployment, paid request, or load test was performed.

## Recommendation

Use the VPS for all self-hosted Word Atlas components: frontend, backend, PostgreSQL, open dictionary, pronunciation cache, and bounded import jobs. Google Cloud generates the selected Iapetus voice. The mini PC is not required for serving the app or preparing imports. This supersedes the earlier recommendation to depend on the mini PC for import preparation. A separate backup destination is still required for recovery from VPS loss; the user's Mac can hold an additional copy when available, but that is not an always-on offsite backup service.

## Measurements

- 2 vCPUs; 3.7 GiB RAM; 2.2 GiB available at inspection.
- 2 GiB swap, 633 MiB occupied. Eight vmstat samples showed no swap-out, with one small swap-in sample. Memory PSI averages were zero. Occupied swap alone is not proof of current memory pressure.
- Load averages: 0.13 / 0.07 / 0.02. Short CPU samples: 91–100% idle.
- Sysstat CPU average idle: 98.38% on October 27, 97.59% on October 28, 97.89% in the partial October 29 record. Busiest recorded interval on October 28: 17.35% busy. These are interval samples, not instantaneous peak guarantees.
- 75 GiB root filesystem, 62 GiB used, 11 GiB available, 86% full.
- Word Atlas backend approximately 30.7 MiB working set; frontend 1.15 MiB. Backend has no explicit Docker memory limit.
- Existing nexo-postgres: PostgreSQL 17.11, 512 MiB container memory limit, 128 MB shared_buffers, 4 MB work_mem, max_connections 30. Persistent bind mount and unless-stopped restart policy. Database port published on localhost only.
- Databases: postgres 7.5 MB and nexo_identity_local 8 MB. No Word Atlas database yet. A separate become-postgres container also runs; do not modify it for Word Atlas.
- Docker reports 23.17 GB reclaimable image storage and 7.957 GB reclaimable build cache. These may overlap and are not additive guaranteed savings. Existing application images and rollback requirements need review before deletion. No volumes are marked reclaimable.
- An existing become-backup timer is present; it does not establish Word Atlas backup coverage.

## Resource budget and import approach

Start with a combined backend/database runtime budget around 0.5–1 GiB, then measure with the full corpus. This is a planning budget, not a measured future working set. Reuse nexo-postgres with a dedicated database and restricted role, a small app connection pool (for example 5 connections within the current 30-connection limit), and indexed lookup queries. A dictionary need not fit entirely in RAM.

Before the full import, aim to recover approximately 20–30 GiB of free disk as an initial working-space target, then verify that measured database, indexes, WAL, staging/rollback data, and backups fit with headroom. Stream the compressed source, filter English records, and insert bounded batches; never unpack the full multilingual source on the root disk. Limit import CPU/memory and run only one importer during low traffic. Full import/index construction will be slower here than on the mini PC and can compete with the existing apps. Do a sample import and size extrapolation before the complete load.

Keep Google audio compressed on persistent VPS storage, with only metadata in PostgreSQL. For illustration, 100,000 two-second clips at 64 kbit/s total roughly 1.6 GB of encoded audio before container/filesystem overhead; actual lengths and Google encoding settings must be measured. Generate on demand and share the cache across users. No local TTS model or GPU is required.

## User-capacity interpretation

A single user is comfortably within observed headroom. For initial planning, aim to validate 20–50 simultaneously active readers doing one lookup each every ten seconds: approximately 2–5 lookups/second. That is an acceptance-test target based on the proposed indexed/cache-heavy design, not demonstrated capacity or a maximum supported user count. Registered or monthly users are not a hardware concurrency metric. Hundreds of registered accounts can still produce very low traffic, but use patterns and data volume determine load.

Before publishing a capacity claim, test the implemented full dictionary with representative exact, phrase, fuzzy, saved-history, cached-audio, and uncached-audio paths while other applications run. Record p50/p95 latency, database connections, CPU, available RAM, disk growth, and error rate. No production stress test was justified during this inspection.

External free-tier limits may bind before hardware capacity. Google Chirp 3 HD currently has one million free input characters/month; that is a character allowance, not one million words. At an assumed 20 billed characters per newly synthesized pronunciation, that is about 50,000 new pronunciations/month, with all apps sharing the billing allowance considered. Replaying the local cache consumes no synthesis characters. Must enforce the user's no-spending constraint; do not treat credit as authorization to exceed the free tier.
