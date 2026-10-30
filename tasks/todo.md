# Word Atlas implementation checklist

Status: core implementation deployed and verified (30 October 2026). Full corpus, PostgreSQL persistence, owner authentication, safe browser migration, Iapetus generation/cache, quota controls, backup restoration and production rollout are complete. Remaining strict acceptance limits are stated below and in [the acceptance report](../docs/acceptance-report.md). The architecture plan remains authoritative. Checking this document does not authorize paid usage.

Verification baseline: add a backend `test` script using `node --test` in Task 1. Thereafter run focused tests with `cd backend && npm test`, backend lint with `cd backend && npm run lint`, and frontend lint/build with `cd frontend && npm run lint && npm run build` when that slice affects the frontend. Record pre-existing failures separately. Tests must not make paid calls, harvest dictionaries, or use production personal data.

## Phase A — Coverage foundations

### 1. Capture the existing contract and coverage fixtures

- [x] Document the existing word response and UI field assumptions; build a licensed/local fixture set covering multiple senses, forms, phrases, and homographs.
- [x] Establish a reproducible old-resolver baseline and a fixture-backed backend test command.
- [x] Include at least 50 idioms/phrasal verbs in the planned corpus evaluation set without live comparative Merriam-Webster benchmarking.

**Verification:** Run the new test command and record baseline coverage; check fixtures contain no secrets or unsupported copied content.
**Dependencies:** None. **Scope:** M.
**Likely files:** `backend/package.json`, `backend/test/fixtures/dictionary-cases.json`, `backend/test/lookup-contract.test.js`, `docs/coverage-baseline.md`.

### 2. Establish storage and deployment preconditions

- [x] Inventory reclaimable artifacts and rollback needs; prepare a targeted cleanup procedure that excludes live data and volumes.
- [x] Record disk/RAM/connection budgets, projected import headroom, persistent mount locations, and low-space stop conditions.
- [x] Identify the actual VPS deployment configuration and ensure it is reproducible before editing it.

**Verification:** Read-only inventory first; after an authorized cleanup, verify real free space and current services. No blind Docker prune.
**Dependencies:** None. **Scope:** S.
**Likely files:** `docs/operations/storage.md`, `docs/operations/deployment.md`, deployment configuration at its verified location.

### 3. Establish the Word Atlas database

- [x] Add migrations and the restricted database role; preserve unrelated databases and use private connectivity with a small pool.
- [x] Create the first core entry/source/release schema and prove an entry can be inserted/read after restart.
- [x] Keep production secrets outside source control and database readiness separate from process liveness.

**Verification:** Apply migrations twice safely to a disposable database; verify role restrictions, persistence, rollback procedure, tests, and lint.
**Dependencies:** 1, 2. **Scope:** M.
**Likely files:** `backend/package.json`, `backend/src/db/index.js`, `backend/migrations/001_dictionary.sql`, `backend/src/repositories/entries.js`, `backend/test/database.test.js`.

### Checkpoint A

- [x] Baseline, resource limits, migration verification, and persistent sample entry are recorded; existing app still works.

## Phase B — Expand the actual library

### 4. Import a representative English sample

- [x] Stream the supported raw source, filter English, and preserve source licenses, senses, examples, forms, expressions, and pronunciations.
- [x] Record release/checksum/importer versions and rejected records; never unpack the entire multilingual dump.
- [x] Measure sample table/index/WAL sizes and produce a full-import estimate with a stop/go disk decision.

**Verification:** Fixed extraction fixtures, deterministic repeat import, non-English rejection, memory observation, and size report.
**Dependencies:** 3. **Scope:** M.
**Likely files:** `backend/scripts/import-kaikki.js`, `backend/src/import/normalizeKaikki.js`, `backend/test/import-kaikki.test.js`, `backend/migrations/002_dictionary_details.sql`, `docs/import-measurements.md`.

### 5. Deliver a local database-backed lookup

- [x] Resolve exact sample entries from PostgreSQL through the existing endpoint with stable IDs and source provenance.
- [x] Show local definitions in the existing interface when editorial providers are unavailable; distinguish a miss from an outage.
- [x] Add bounded timeouts and keep optional content from blocking the core result.

**Verification:** Local-result endpoint tests with providers offline, homograph fixtures, existing response compatibility, backend lint and frontend build.
**Dependencies:** 4. **Scope:** M.
**Likely files:** `backend/src/controllers/getWordDetails.js`, `backend/src/repositories/entries.js`, `backend/src/services/lookupService.js`, `backend/test/local-lookup.test.js`, `frontend/src/features/word/utils/entries.js`.

### 6. Complete editorial source handling

- [x] Preserve relevant Learner’s and Collegiate definition blocks, subsenses, examples, phrases, forms, and pronunciation variants.
- [x] A valid Collegiate match survives a Learner’s miss; unrelated entries cannot supply definitions or origins.
- [x] Keep provider provenance, deadline/quota behavior, and storage policy explicit; no permanent proprietary corpus by default.

**Verification:** Recorded permitted/synthetic parser fixtures, deadline and quota simulations, no live bulk requests, lint.
**Dependencies:** 5. **Scope:** M.
**Likely files:** `backend/src/utils/normalizeLearnersResponse.js`, `backend/src/utils/normalizeCollegiateResponse.js`, `backend/src/services/merriamService.js`, `backend/src/services/lookupService.js`, `backend/test/editorial-sources.test.js`.

### 7. Make forms and expressions discoverable

- [x] Exact idioms/phrases and grammatical forms resolve to the correct entry or an explicit ambiguity; forms do not silently collapse to the wrong meaning.
- [x] Use indexed local suggestions instead of API calls for every suggested spelling; cap fuzzy work and results.
- [x] Preserve phrase labels and existing phrase UI behavior across punctuation and spelling variants.

**Verification:** Query-plan checks and phrase/form fixtures, cycle/ambiguity tests, frontend lint/build and manual search checks.
**Dependencies:** 5, 6. **Scope:** M.
**Likely files:** `backend/src/repositories/entries.js`, `backend/src/routes/wordRoutes.js`, `backend/src/utils/getValidSuggestions.js`, `frontend/src/features/search/hooks/useSuggestions.js`, `backend/test/forms-and-phrases.test.js`.

### 8. Publish the full validated corpus

- [x] Import all selected English records within measured resource limits; report real headword, sense, form, and expression counts separately.
- [x] Publish only after integrity checks and coverage evaluation; preserve stable identities and a tested previous release.
- [x] Abort safely on low space, bad input, or interrupted imports without affecting the active release.

**Verification:** Full-import report, representative evaluation, active-release switch/rollback, and interrupted-import recovery. Reuse importer modules rather than adding a second pipeline.
**Dependencies:** 2, 4, 7. **Scope:** M.
**Likely files:** `backend/scripts/import-kaikki.js`, `backend/src/import/releases.js`, `backend/scripts/evaluate-coverage.js`, `backend/test/import-release.test.js`, `docs/import-measurements.md`.

### Checkpoint B

- [x] Missing-word improvement is demonstrated, expressions/forms work, source content is preserved, and the redesigned interface still looks and behaves as before.

## Phase C — Persist the personal library

### 9. Establish owner authentication

- [x] Inspect the existing identity-service contract and select the smallest production-suitable integration; keep public signup off.
- [x] Authenticate one owner with secure sessions and server-side identity validation; reject unauthenticated personal writes.
- [x] Verify CSRF/session/cookie behavior and ensure secrets never reach the frontend.

**Verification:** Login/logout/expiry, invalid session, CSRF, and cross-user-access tests using test identities. Split this task if the identity service needs unrelated repairs.
**Dependencies:** 3. **Scope:** M.
**Likely files:** `backend/src/auth/session.js`, `backend/src/routes/authRoutes.js`, `backend/src/server.js`, `backend/test/auth.test.js`, `frontend/src/context/AuthProvider.jsx`.

### 10. Store saves and submitted search history

- [x] Persist user-owned saves, first/last search times, visit counts, and unresolved queries with pagination and stable entry references.
- [x] Repeated writes are idempotent and corpus changes cannot delete personal records; dictionary content is not copied into personal JSON blobs.
- [x] Provide export and explicit delete controls with private cache headers.

**Verification:** Ownership, idempotency, unresolved-entry, pagination, corpus-refresh, and backend-restart tests.
**Dependencies:** 5, 9. **Scope:** M.
**Likely files:** `backend/migrations/003_personal_library.sql`, `backend/src/repositories/library.js`, `backend/src/routes/libraryRoutes.js`, `backend/src/server.js`, `backend/test/library.test.js`.

### 11. Migrate browser saves/history

- [x] Import `wa:saved` and `wa:history` after login, retaining timestamps and unresolved terms while excluding restricted content snapshots.
- [x] Retry safely and retain the original browser data until verified server success; show pending or failed synchronization clearly.
- [x] Use server-backed saves/history in the existing interface and preserve local theme preferences.

**Verification:** Old-browser fixtures, partial failure, repeated import, two-browser consistency, frontend lint/build, and manual saved/history checks.
**Dependencies:** 10. **Scope:** M.
**Likely files:** `backend/src/routes/libraryRoutes.js`, `backend/test/library-import.test.js`, `frontend/src/context/LibraryProvider.jsx`, `frontend/src/lib/libraryApi.js`, `frontend/src/lib/migrateLibrary.js`.

### Checkpoint C

- [x] The owner can use the same library across devices; original local records remain recoverable and no duplicate or missing saves are found.

## Phase D — Correct Iapetus pronunciation with free-tier controls

### 12. Define pronunciation identity and usage reservations

- [x] Map source pronunciations to stable sense/entry associations; distinguish heteronyms and validate phonetic overrides.
- [x] Add unique audio configuration keys, jobs, and transaction-safe monthly allowance reservations that survive restarts.
- [x] Default new generation off until account-wide free allowance and the production identity are verified; enforce the proposed 100,000-character app cap or a lower available allocation.

**Verification:** Heteronym fixtures, unsupported phonemes, concurrent quota-boundary requests, unknown-allowance behavior, and persistent ledger tests with mocked providers.
**Dependencies:** 4, 9. **Scope:** M.
**Likely files:** `backend/migrations/004_pronunciation_audio.sql`, `backend/src/services/pronunciationService.js`, `backend/src/repositories/audio.js`, `backend/src/services/providerBudget.js`, `backend/test/audio-identity-budget.test.js`.

### 13. Generate and persist Iapetus recordings

- [x] Implement one bounded worker for `en-US-Chirp3-HD-Iapetus` with server-owned inputs, persistent compressed files, and deduplication.
- [x] Validate audio and atomic file publication; reconcile orphan/completed files and uncertain provider outcomes without blind regeneration.
- [x] Serve ready/pending/failure/allowance states; no paid model, welcome-credit fallback, or arbitrary public synthesis route.

**Verification:** Mocked duplicate/concurrent requests, crash after synthesis/write, failed response, low-disk and exhausted-budget cases. Any live smoke sample must fit the verified free allocation and be retained.
**Dependencies:** 2, 12. **Scope:** M.
**Likely files:** `backend/src/services/googleSpeech.js`, `backend/src/workers/audioWorker.js`, `backend/src/routes/audioRoutes.js`, `backend/src/server.js`, `backend/test/audio-worker.test.js`.

### 14. Preload and replay the approved voice

- [x] Prepare only the selected pronunciation after entry open and reuse one preloaded audio object; no synthesis on autocomplete.
- [x] Preserve the listen button and shortcuts with clear readiness/failure states; never silently substitute another voice.
- [x] Verify production encoding quality and the intended pronunciation of reviewed heteronyms, difficult words, and idioms.

**Verification:** Frontend lint/build; browser tests for rapid navigation, repeated clicks, pending generation, mobile playback, offline cached media, and measured click-to-sound latency. Replays must cause zero new synthesis requests.
**Dependencies:** 13. **Scope:** M.
**Likely files:** `frontend/src/features/word/components/AudioButton.jsx`, `frontend/src/features/word/hooks/usePronunciation.js`, `frontend/src/features/word/hooks/useWordDetails.js`, `frontend/src/features/word/components/WordHero.jsx`, `frontend/src/features/word/api/pronunciationApi.js`.

### Checkpoint D

- [x] Correct Iapetus clips are saved and reused; allowance races, uncertainty, and failures cannot silently enable paid requests. Cached playback targets are measured, not assumed.

## Phase E — Operate and release

### 15. Prove backup and restore

- [x] Back up database and audio metadata/files with bounded retention and encryption for the external copy.
- [x] Resolve an off-VPS destination without buying storage; report backup age and the limitations of a Mac that may be offline.
- [x] Restore to an isolated environment and verify personal records, active dictionary mappings, audio integrity, and retained usage reservations.

**Verification:** Timed restore exercise, checksums, missing-file recovery, no duplicate synthesis, and backup-access checks. Scheduling during implementation must use the approved deployment mechanism; no schedule is created by this plan.
**Dependencies:** 8, 11, 13. **Scope:** M.
**Likely files:** `ops/backup-word-atlas.sh`, `ops/restore-word-atlas.sh`, `docs/operations/backup-restore.md`, verified scheduler configuration.

### 16. Validate and release in reversible stages

- [x] Exercise coverage, persistence, source outages, quota exhaustion, and audio with the full corpus and existing VPS workloads.
- [x] Measure latency/resources at 2–5 lookups/second; preserve the existing design and avoid claiming an untested maximum user count.
- [x] Deploy staged migrations and features with health checks, documented rollback, verified persistent mounts, and observable quota/disk/backup state.

**Verification:** Backend tests/lint, frontend lint/build, representative browser flows, restore evidence, and a bounded load report using local dictionary paths and already-cached audio. Never load-test billable synthesis or third-party dictionary APIs.
**Dependencies:** 8, 11, 14, 15. **Scope:** M.
**Likely files:** `ops/check-word-atlas.js`, `docs/acceptance-report.md`, `docs/operations/deployment.md`, `README.md`, verified deployment configuration.

### Final checkpoint

- [ ] Expanded words/idioms/forms, accurate source display, durable personal data, selected Iapetus voice, free-tier enforcement, measured performance, backup restoration, and rollback all meet the plan. **Functional implementation and recovery are verified; this strict checkpoint remains open because cold/audio-onset targets are not universal, physical-phone output latency is untested, and a continuous 24-hour offsite recovery point is not established.**
- [x] Implementation status and remaining limitations are recorded honestly; no unchecked acceptance item is silently treated as complete.

## Final implementation evidence — 30 October 2026

- **Production:** https://word-atlas.ammarhadid.com . Frontend `release-20261030-v3`, backend/worker `release-20261030-v4`, active corpus `kaikki-20261029-full`. Health/readiness verified; original images/configuration retained. All runtime and import work is on the VPS. No mini PC, purchases, subscriptions, paid fallback or welcome-credit use.
- **Coverage:** 1,499,153 entries, 1,396,110 distinct headwords, 1,795,039 senses, 926,718 form aliases and 321,917 distinct multiword headwords. Includes 8,995 idiom and 5,202 phrasal-verb entry records. One reviewed whitespace exclusion; seven duplicate input occurrences merged; 1,333 source entries lack definition text. Whole-corpus structural checks passed. Evaluation resolves 94/101 real queries, including 57/64 expressions; seven exact gaps are documented. [Corpus proof](../docs/import-measurements.md).
- **Adapters and tests:** old editorial fixture baseline 4/6 positive cases versus 6/6 complete adapters, without live benchmarking or proprietary corpus storage. Final backend tests 71/71 with no skips, frontend 13/13; lint/build and checked dependency audits pass. Migrations are idempotent and checksummed. Optional failures preserve local meanings; fuzzy work has a transaction-local 200 ms deadline.
- **Personal persistence:** real VPS staging migration verified 105 saves and 55 history records, original dates/keys, partial/repeated retries, pagination/export and two-browser consistency. Production cookies, CSRF and logout verified. Simultaneous offline tabs and stale pagination after logout pass the final production-bundle regressions. The owner's real profiles were not opened; sign-in on each browser imports its retained records.
- **Frontend:** measured desktop/mobile geometry, fonts and colors preserve the prior redesign. Production homograph text/audio/save selection, buffering, themes and source/form rendering verified. Full-corpus smoke passed 38/38 checks. Mobile testing uses Chrome viewport emulation. [Browser proof](../docs/frontend-verification.md).
- **Audio and allowance:** approved guide/metal recordings reused. Two retained live clips became ready in 2.40 s and 1.25 s; exactly two production synthesis calls reserved 434 conservative units. Replays, autocomplete, import, load and recovery caused no additional synthesis. Ambiguity, unsupported phones, missing files, low disk, races, expiry and uncertainty were tested. The 100,000-unit grant expires 31 October 2026 at 23:59 UTC; cached playback continues afterward. [Allocation](../docs/operations/free-allowance.md).
- **Performance:** 300 requests over 60 seconds, five HTTP requests/sec including four dictionary lookups/sec, zero errors. HTTP p95: dictionary 47.8 ms, suggestions 91 ms, cached audio 5.4 ms. Preloaded media-playing p95 is approximately 16 ms; the lead-file sustained-sound proxy is approximately 165 ms. One early click took 1,429 ms; cat's conservative threshold onset is 509 ms. No universal instant-playback or maximum-user claim. [Load proof](../docs/verification/full-load.json).
- **Recovery:** encrypted 680,058,912-byte full backup in 316.79 s; independent Mac copy verified; isolated full restore in 138.48 s. Active entries, exact synthetic personal records, six audio hashes and two usage rows/434 units matched. Raw-file recovery works with networking disabled. Corpus rollback preserved personal/audio/usage data. Nightly backups run at 02:30 UTC and retain two completed archives; other schedules are unchanged. Offsite age is reported without a continuous 24-hour guarantee. [Restore proof](../docs/operations/backup-restore.md).
- **Storage and cleanup:** 5.27 GB database; approximately 8.9 GiB VPS space free. Only inspected old build cache and the completed, independently copied raw download were reclaimed. A wide aggregate was canceled and replaced with safe sequential/narrow validation. Word Atlas roles have a 256 MiB temporary-file cap; imports/backups have a 4 GiB floor. Test identities and temporary staging containers were cleaned up; unrelated apps stayed online. Pre-existing research, plans, assets and old frontend files remain intact. Secrets/backups remain outside Git.

Checked tasks reflect actual verification. The strict final checkpoint remains open for documented latency, physical-phone and continuous-offsite limitations. See the [complete acceptance report](../docs/acceptance-report.md).
