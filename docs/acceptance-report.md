# Word Atlas acceptance report

Deployed 30 October 2026 (UTC): https://word-atlas.ammarhadid.com . The production frontend is `word-atlas-frontend:release-20261030-v3`; backend and the single audio worker use `word-atlas-backend:release-20261030-v4`. The active dictionary is `kaikki-20261029-full`. All self-hosted runtime and import work ran on the existing VPS. The Mac was used for development, browser tests and an isolated restore; the mini PC was not accessed or required.

## Delivered behavior

The existing React design is preserved. PostgreSQL now supplies exact words, expressions, source form links, local suggestions, source attribution, owner sessions, saved words, submitted history, stable identities and durable audio jobs. Full Learner's/Collegiate adapters preserve definitions and fallback independently; their content is live-only. Datamuse insights go through a bounded backend allowance and deadline. Local dictionary results survive optional provider or audio-metadata failures.

The single owner account has no public signup. Secure HttpOnly host-only cookies, CSRF, server-side ownership and persistent login throttling are verified. Login imports legacy `wa:saved`/`wa:history` identities and timestamps without copying proprietary definition snapshots. Originals remain recoverable. Independent operation keys survive concurrent offline tabs, verified retries do not duplicate writes, and late responses cannot repopulate private UI after logout. Export reaches beyond the loaded page.

Audio uses only `en-US-Chirp3-HD-Iapetus`, normal rate, MP3. Source/sense identities distinguish `/liːd/` and `/lɛd/`; equal sounds share files across source releases. Only an opened selected pronunciation can enqueue a job. One worker reserves a verified allowance transactionally; concurrent requests deduplicate, ambiguous/unsupported inputs are withheld, and uncertain outcomes keep their reservation without automatic retry. Original returned audio and processed final files are retained. Browser preload and reuse avoid synthesis on replay.

## Actual coverage

| Measure | Count |
| --- | ---: |
| English source records | 1,499,161 |
| Selected input records | 1,499,160 |
| Persisted lexical entries | 1,499,153 |
| Distinct headwords | 1,396,110 |
| Senses | 1,795,039 |
| Source form aliases | 926,718 |
| Form-only entry records | 687,383 |
| Distinct multiword headwords | 321,917 |
| Whole-expression entry records | 328,675 |
| Idiom entry records | 8,995 |
| Phrasal-verb entry records | 5,202 |
| Proverb entry records | 1,576 |
| Entries with definitions | 1,497,820 |

These overlapping counts must not be added together. Headwords include inflected forms, proper names, technical terms and other source categories, rather than only independent base lemmas. Seven repeated lexical input occurrences were merged without dropping their metadata. One whitespace-only punctuation headword was explicitly excluded by exact line/hash; there are zero unreviewed rejections. The 1,333 source entries without definition text are displayed honestly with source information.

All 1,499,153 persisted entries passed structural checks: zero payload-ID/key mismatches, orphan forms or non-English rows. The fixed 102-case set contains 101 real queries plus an invalid sentinel. **94/101 real terms** resolve locally, including **57/64 expressions**. All common, uncommon, technical, inflection, variant, punctuation, homograph and case cases passed. Seven exact-expression gaps remain: “a piece of cake”, “the ball is in your court”, “cost an arm and a leg”, “the tip of the iceberg”, “a blessing in disguise”, “cut down on”, and “run out of”. They are not fabricated aliases. Optional editorial fallback/suggestions remain available subject to their own allowances.

The licensed/synthetic editorial baseline improves from 4/6 positive cases with the old mandatory-Learner's gate to 6/6 with independent complete adapters. No live Merriam-Webster benchmark or bulk harvesting was performed. [Corpus evidence](import-measurements.md), [full evaluation](verification/corpus-full-evaluation.json).

## Verification and measured performance

- **71/71 backend tests**, no skips, using an isolated VPS PostgreSQL database; **13/13 frontend tests**. Backend/frontend lint, production build and dependency audits pass (zero reported vulnerabilities in the checked scopes). Tests use mocks/fixtures for synthesis and external dictionaries.
- Real staging browser migration tested 105 saved records and 55 history records, preserved originals, repeated import, pagination/export, offline retry and two independent browser sessions. Production checks cover secure cookies/login/logout, selected homographs, buffering, simultaneous offline tabs and stale-response isolation. Full-corpus desktop/mobile smoke passed 38/38 checks. [Frontend evidence](frontend-verification.md).
- Full-corpus load: **300 HTTP requests in 59.8 seconds**, five requests/sec comprising four dictionary lookups/sec plus suggestions and saved audio; zero errors. Dictionary p50/p95 **14.4/47.8 ms**, suggestions **8.1/91 ms**, cached MP3 delivery **3.5/5.4 ms**. These are HTTP service times inside the VPS, excluding CDN/client transport. [Load report](verification/full-load.json).
- Sampled peak CPU during that test: backend 9.07%, PostgreSQL 7.7%, worker 0.43% (Docker per-core accounting). Backend memory ended at 46.55 MiB; PostgreSQL at 375.1 MiB of its unchanged 512 MiB limit. No maximum-user claim is made. [Resource samples](verification/full-load-resources.json).
- Preloaded production media `playing` events: p95 **15.8 ms desktop**, **15.5 ms mobile viewport**. Staging lead clips' measured leading audio yields a conservative sustained-sound proxy around **165 ms** preloaded and **212–218 ms** with an empty browser cache. One production first click before preload finished took **1,429 ms**; the UI now shows Loading while retaining gesture playback. These are not hardware microphone/output-latency measurements.
- Two retained live synthesis smoke clips became ready in **2.40 seconds** (“cat”) and **1.25 seconds** (“rain cats and dogs”). Repeated preparation/replay made no further synthesis. Cat's low-level lead-in reaches the conservative −45 dB threshold at about **509 ms**, while the idiom does so at **46 ms**; a universal sub-200 ms audible-onset claim is therefore not supported. Original files remain intact. [Live audio](verification/live-audio-smoke.json), [signal/recovery measurements](verification/audio-recovery.json).

## No-spending controls

The owner confirmed the audition was the only shared-account Chirp usage. Read-only checks reconciled all three linked projects and the 30 earlier audition synthesis requests. The dedicated production identity has Service Usage Consumer only, and its key is mounted only in the worker. No purchase, paid tier, subscription or welcome-credit authorization was used.

The initial free-only grant is **100,000 conservative request bytes/characters**, with **434 reserved/consumed** by two production smoke calls. Counting the full request overestimates billable text. The independent monthly cap, current-month grant constraint, final pre-dispatch expiry check, daily owner cap, single worker and retained uncertain reservations prevent ordinary overspend paths. **Verification expires 31 October 2026 at 23:59 UTC. New synthesis then stops until the allowance is reverified; existing files continue playing.** There is no automatic paid or alternate-voice fallback. [Allocation and renewal procedure](operations/free-allowance.md).

Merriam-Webster's initial hold lasts until 30 October 2026 at 23:00 UTC to account for the old application's untracked requests; each reference then has a conservative 900-request rolling-day cap. Datamuse stops on 1 January 2027 unless its free-access policy is reverified.

## Recovery and operations

The measured database is **5,271,623,347 bytes** (5.27 GB), including retained samples. Only inspected unused Docker build cache and the completed, independently copied raw download were reclaimed. An unexpectedly wide final-count aggregate was canceled before disk exhaustion; validation now streams narrow projections, with a 256 MiB role-specific temporary-file limit and a 4 GiB import/backup floor. Other applications and database settings were preserved.

Full→sample→full dictionary rollback was exercised in a transaction; external readers stayed on the full release. A full-only term disappeared/reappeared for the transaction while its stable row remained. Personal record digests, six ready audio assets and two usage records stayed unchanged. Previous application images booted successfully without networking. Rollback retains database/audio mounts and modifies only the Word Atlas configuration. [Deployment/rollback](operations/deployment.md).

The full encrypted backup `20261030T000407Z.tar.enc` is **680,058,912 bytes (648.6 MiB)** and completed in **316.79 seconds**. The independent Mac copy passed SHA-256 verification at **2026-10-30 00:10:06 UTC**. An isolated PostgreSQL 17 restore completed in **138.48 seconds**, below the two-hour target. Automated comparison matched all 1,499,153 active entries, the synthetic saved/history records with exact IDs/timestamps/visit count, six final audio checksums, and both retained usage rows totaling 434 units. Recovery made zero provider calls. [Restore evidence](verification/full-restore.json), [backup procedure](operations/backup-restore.md).

Nightly encrypted VPS backups run at **02:30 UTC**, retaining two completed archives, with a lock, checksum verification and atomic success marker. Existing Auctus/Nexo schedules were preserved. The actual offsite copy is current as recorded above; the Mac is not continuously available, so a guaranteed 24-hour offsite recovery point remains unproven. Independent missing-file reconstruction from retained raw audio was tested with networking disabled and matched all four reviewed clip hashes in 130–230 ms.

The inactive synthetic backup identity and its personal rows/operations were removed after verification. The owner account remains active and unchanged. Temporary staging and rollback-check containers were removed; the isolated Mac restore container was stopped, retaining its audit data. Final VPS free space is approximately **8.9 GiB**. Unrelated applications remained online.

## Remaining limits and owner action

Sign in once on each existing browser to import that browser's retained records; the owner's real browser profiles were not opened or modified during testing. Initial credentials are in `~/.config/word-atlas/owner-login.txt` on the owner's Mac. Test identities were removed after restore verification.

Coverage gaps, source entries without glosses, unsupported phonemes and variable leading silence remain explicit. The 20-present-common-term IPA sample supports synthesis for 19 terms; unsupported notation is not silently stripped. Mobile checks use Chrome viewport emulation, not physical iPhone/Android hardware. Cold playback and audible onset are not universally below the aspirational targets. The Mac offsite copy is verified when made, but an offline Mac cannot guarantee a continuous 24-hour offsite recovery point. Corpus refreshes and free-allowance renewals remain manual and require fresh capacity/allowance verification.
