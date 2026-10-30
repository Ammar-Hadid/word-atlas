# Word Atlas: coverage, pronunciation, and persistence

**Historical research:** the current implementation direction is in the [29 October architecture plan](../../tasks/plan.md). Its VPS-only hosting and selected Iapetus voice supersede the mini-PC and Piper proposals retained below as research history.

Research completed 26 October 2026. Application code and deployed services were not changed. Both servers were inspected over SSH. Temporary, isolated Piper benchmarks were run; their results are saved alongside this report. This is a recommendation for the next implementation, not a claim that the proposed system is already deployed.

## Recommended direction

**Voice selected, 29 October 2026:** After comparing six generated auditions, the user selected Google Chirp 3 HD Iapetus, specifically the US English voice `en-US-Chirp3-HD-Iapetus` at normal speaking rate. This supersedes the earlier undecided status and Piper-first recommendation below. Google Cloud project and local authentication are configured; production integration has not been implemented. The current constraint is no monetary spending or welcome-credit consumption without explicit approval; the user authorized the bounded free-tier comparison. Future synthesis must stay within verified free-tier allowances unless that authorization changes.

Use Google once per distinct pronunciation configuration, persist generated audio on the VPS, and keep its lookup metadata in PostgreSQL. Replays should serve the saved file without another synthesis call. Deduplicate concurrent requests and back up audio to avoid unnecessary regeneration. Key the cache by pronunciation identity, voice/accent, pronunciation override, and audio settings, rather than spelling alone. Prepare audio when a confirmed dictionary entry opens, not on every autocomplete keystroke. A first uncached lookup still depends on Google's response time; preload and reuse stored clips for subsequent playback. The audition's two meanings of lead used explicit phonetic guidance; production must distinguish pronunciations by meaning. [Audio usage](https://docs.cloud.google.com/text-to-speech/docs/basics), [pricing](https://cloud.google.com/text-to-speech/pricing).

Use the existing VPS for the application, PostgreSQL, a persistent English dictionary index, and one warm Piper speech worker. Use the mini PC for dictionary import preparation, backups, and optional audio generation in batches. Keep home networking out of ordinary lookup and playback requests. No additional paid service is required based on the measurements, subject to clearing sufficient VPS disk space and validating the final database footprint.

The dictionary should combine a permanent open-data foundation from English Wiktionary/Kaikki with the existing Merriam-Webster Learner's and Collegiate products for editorial definitions. Full source comparison, Oxford presentation principles, idioms, licenses, and dictionary prices are in [the dictionary research](dictionary-sources-2026-10-26.md).

## Findings in the existing application

- `backend/src/controllers/getWordDetails.js` calls both dictionaries, but only Learner's entries decide whether a word exists. Collegiate supplies origins and quotations only. A valid Collegiate definition cannot prevent the current 404. Making its definitions a real fallback is the first coverage improvement.
- `normalizeLearnersResponse.js` reads only `def[0]`, recognizes only selected sense structures, and selects the first pronunciation. Adapter completeness and phrase matching need validation; some missing content can be a parsing problem as well as a source-coverage problem.
- `getValidSuggestions.js` requests every string suggestion from Learner's. This multiplies calls during misses; the local lexical index should supply validated suggestions instead.
- `merriamService.js` has no explicit fetch deadline. Optional enrichment can delay the full response, and one provider's failure currently causes an overall failure. Add bounded deadlines and a usable local-data fallback.
- `AudioButton.jsx` creates its audio element only after the click. The request can start too late for immediate sound. Load the selected clip while the page is being viewed and reuse the loaded element.
- `LibraryProvider.jsx` stores saved entries and the latest 50 history items in localStorage. These are personal records, separate from the dictionary corpus. Move their authoritative copy to PostgreSQL; theme and disposable browser caches can remain local.

## Server observations

These are point-in-time observations, not load-test guarantees.

| Resource | VPS | Shuttle mini PC |
|---|---|---|
| CPU | 2 virtual AMD EPYC Genoa CPUs | Intel i5-8400, 6 cores |
| RAM | 3.7 GiB total; about 2.1 GiB available | 15 GiB total; about 11 GiB available |
| Swap | 2 GiB; about 750 MiB occupied | 4 GiB; unused |
| Root disk | 75 GiB filesystem, 61 GiB used, 12 GiB available; 85% full | 98 GiB filesystem, 25 GiB used, 69 GiB available |
| OS observed | Ubuntu 26.04 LTS | Ubuntu 24.04.4 LTS, kernel 6.8.0-139 |
| Existing workloads | Word Atlas, other applications, Caddy, PostgreSQL, relay | Minecraft, approximately 3.9 GiB RAM in observed sample |

The mini PC's physical SSD is approximately 894 GiB, but the root logical volume is only 100 GiB. A second approximately 466 GiB disk is visible. Do not equate raw device capacity with available mounted filesystem space. LVM free extents and second-disk contents were not inspected with elevated privileges; no resizing is proposed as a prerequisite.

The VPS already runs `nexo-postgres` from `postgres:17.11`, with a 512 MiB memory limit, persistent bind-mounted data, and restart policy `unless-stopped`. Its published database port is loopback-only. Database-name/size inspection found `postgres` and `nexo_identity_local`, each around 8 MB; there is no Word Atlas database yet. No personal table contents or credentials were retrieved.

Docker reported about 22 GB of reclaimable images and 9 GB of reclaimable build cache. These figures may overlap and are not a promise of additive savings. Review old artifacts and retain needed rollback images before cleanup. No existing images, volumes, logs, or application data were pruned. The VPS also has approximately 4 GB of logs. Disk capacity, rather than the dictionary lookup CPU load, is the immediate constraint.

## Speech measurements on the actual machines

Engine: Piper 1.8.0, voice `en_US-ljspeech-medium`, CPU execution. Fifteen inputs repeated five times, 75 complete WAV syntheses per server, one request at a time, with the model loaded once. Inputs include ordinary words, heteronyms, difficult spellings, four idioms, and a long medical word. The VPS container was capped at one CPU and 512 MiB RAM; the mini PC was not similarly capped. This is a deployment feasibility comparison, not an equal-resource hardware comparison.

| Measurement | Mini PC | VPS |
|---|---:|---:|
| Median full synthesis | 25 ms | 87 ms |
| 95th percentile full synthesis | 108 ms | 299 ms |
| Slowest of 75 syntheses | 112 ms | 309 ms |
| Model load | 1.80 s | 2.88 s |
| Peak process resident memory | 243 MiB | 255 MiB |

Raw measurements: [mini PC JSON](piper-mini-pc-benchmark-2026-10-26.json), [VPS JSON](piper-vps-benchmark-2026-10-26.json). The [benchmark script](piper-benchmark.py) records the tested loop and VPS paths. An initial exploratory Lessac-medium run on the mini PC was similarly fast (27 ms median), but LJ Speech is the preferred research baseline because its voice card identifies a public-domain training dataset. The exact production voice must be selected by listening and checking its specific terms. [Piper Python API](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md), [LJ Speech voice card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/medium/MODEL_CARD), [dataset terms](https://keithito.com/LJ-Speech-Dataset/)

These timings exclude HTTP, TLS, browser decoding, audio-device startup, and audible leading silence. They do not establish pronunciation correctness, voice preference, sustained-load behavior, or click-to-sound latency. No production endpoint or browser benchmark was deployed. The test does establish that a GPU and a paid TTS API are unnecessary for fast synthesis on the supplied hardware.

Keep the model resident in a supervised process; loading it afresh for each word would squander the latency advantage. Start with one worker, bounded input length, a single-job queue, and deduplication of concurrent requests for the same pronunciation. The VPS has enough observed spare RAM for this worker, but dictionary imports and index construction should be budgeted separately from the other running applications.

## Making pronunciation feel immediate

1. Prefer an appropriate dictionary recording for the selected pronunciation when available and permitted. Retain source, accent, and variant identity.
2. Otherwise use an existing cached synthetic clip, or generate one using the warm VPS worker. Request preparation when the entry opens, rather than waiting for the speaker click.
3. Store generated audio files on a persistent VPS directory served through the existing web server. PostgreSQL holds metadata and file keys; large audio blobs need not live inside database rows.
4. Preload the selected clip in the browser and reuse it. HTML `preload` is a hint, so test actual ready state and playback events instead of assuming it always downloads. Browser autoplay policies still require the user's click. [MDN media preload](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preload)
5. Cache by pronunciation identity, accent, voice/model version, and synthesis settings, not spelling alone. `lead`, `read`, and `record` expose why a single spelling can have multiple pronunciations. Use verified phonetic overrides where supported and quality-check their mapping; an IPA string is not automatically valid input for every speech engine.
6. Preserve a device speech fallback for failures, with a bounded timeout and without claiming identical voice quality on every device. Do not let a stalled audio request wait indefinitely.

Acceptance targets, not measured results: under 200 ms click-to-sound at p95 when the clip is already loaded; under 1 second at p95 for a new warm-worker request on the user's normal connection; handle a cold restart or failure within the user's accepted 1–2 second fallback window where possible. Test desktop and phone, immediate click after navigation, repeat click, long idioms, slow network, worker restart, and concurrent existing-server workloads. A cached clip already in the browser is the most reliable way to meet the immediate-click requirement.

Pre-generating every form in both accents is unnecessary initially. As an illustrative storage estimate, a two-second mono clip at 32 kbit/s is about 8 KB: one million clips consume roughly 8 GB before filesystem overhead. Two accents double that. Limit cache size, preserve saved/recent words, and generate the long tail on demand. Proprietary recording caches require permission; this estimate describes audio we are permitted to store.

Kokoro-82M is a plausible alternative to audition later, with Apache-licensed weights and British/American voices. It was researched but not benchmarked or judged for quality here. Piper's measured performance is sufficient to begin; choosing a larger model before listening would add work without evidence of benefit. [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M)

## Database and import plan

PostgreSQL is a sound choice, especially because it is already operated on this VPS. Create a dedicated Word Atlas database and restricted application role; leave unrelated application tables and roles separate. Connect through the backend on the private container network. Authentication is required for personal saved words and history even for a single user; inspect the existing identity service's supported contract before deciding whether to reuse it.

Use structured tables for entries, senses, examples, forms/aliases, multiword expressions, pronunciations, sources, user saves, and visits. Retain source-specific identifiers and selected original fields for import troubleshooting. Store source URL, applicable license, release/version, and provenance alongside imported content. Separate proprietary live responses from permanent open dictionary data.

Use indexed normalized lookup keys for exact and prefix matching; `pg_trgm` can support spelling similarity without adding another search server. Preserve distinctions such as `US` versus `us`, hyphen variants, and phrase spacing. Fuzzy matches are suggestions, not evidence that the requested word exists. [PostgreSQL trigram support](https://www.postgresql.org/docs/17/pgtrgm.html)

Prepare the Kaikki import on the mini PC: stream the supported compressed raw English-edition export, filter `lang_code=en`, normalize English entries, and validate form/phrase links. Keep the raw multilingual dump and intermediate artifacts off the VPS. Test a representative sample, measure full database/index size on staging, and allow room for import WAL, indexes, temporary tables, backups, and future growth before transferring to the VPS. The approximately 1.4 million forms do not justify guessing a database size from entry count alone.

Use versioned staging imports and switch to a validated release atomically, with a rollback path. Keep source snapshot/checksum and importer version. Weekly or monthly scheduled imports can be chosen later; no schedule was created during research.

Migrate localStorage saves/history from each browser after login, idempotently. Keep the original local copy until the server confirms successful import. Preserve saved dates, visit dates, notes, and meaning/pronunciation identity where available. Personal data must not disappear when a dictionary import changes entry identifiers. Maintain an export route.

Back up personal data separately from rebuildable dictionary imports. Add encrypted database backups to the mini PC with retention and a tested restore; an unrelated existing backup timer does not demonstrate coverage for Word Atlas. Also retain an independent copy of irreplaceable user data. [PostgreSQL backup documentation](https://www.postgresql.org/docs/17/backup-dump.html)

## Optional API costs

Prices checked 26 October 2026, USD, excluding tax and unrelated hosting/transfer. Calculations assume 10 characters per new pronunciation and one voice; longer idioms, two accents, and billed SSML markup increase usage. Replaying a stored clip need not trigger another synthesis request.

| Provider/voice | Published price per million characters after allowance | 10,000 new ten-character words, before allowance |
|---|---:|---:|
| Google Standard or WaveNet | $4 | $0.40 |
| Google Neural2 | $16 | $1.60 |
| Google Chirp 3 HD | $30 | $3.00 |
| Amazon Polly Standard | $4 | $0.40 |
| Amazon Polly Neural | $16 | $1.60 |

Google currently lists monthly allowances of 4 million characters for Standard/WaveNet and 1 million for Neural2/Chirp 3 HD, but requires billing and charges for excess usage. Polly explicitly allows caching/replay without an additional synthesis fee; its free-tier eligibility depends on account/program dates, so do not assume an indefinite allowance. Neither pricing page establishes immediate playback latency for this app. No paid API was benchmarked or enabled. [Google pricing](https://cloud.google.com/text-to-speech/pricing), [Amazon Polly pricing](https://aws.amazon.com/polly/pricing/)

If speech quality or pronunciation control later justifies an API, Polly Neural is a useful candidate because its supported phoneme tag accepts IPA/X-SAMPA and its caching permission is explicit. That is an optional quality/operations choice, not a performance necessity demonstrated by this research. [Polly phoneme support](https://docs.aws.amazon.com/polly/latest/dg/phoneme-tag.html)

Self-hosted software and dictionary data add no license or per-query bill. Existing VPS rental, electricity, disk use, backups, and maintenance still have costs. Exact Oxford wording is a separate paid dictionary decision, not a TTS requirement.

## Implementation order

1. Fix the current content bottleneck: complete source adapters and allow Collegiate definitions; keep the current interface and source-authored prose.
2. Add the dedicated PostgreSQL database, single-user authentication, saved/history persistence, migration, and backup/restore verification.
3. Prepare and validate the large open dictionary import on the mini PC; establish actual disk requirements and reclaim reviewed VPS artifacts before production import.
4. Add full phrase/idiom lookup and form resolution, source attribution, bounded provider calls, and local suggestions. Keep rare/obsolete senses labeled and avoid blending different sources' senses.
5. Add a warm VPS Piper worker, persistent generated-audio cache, pronunciation-aware keys, and browser preloading. Audition voices and test ambiguous pronunciations before choosing the default.
6. Verify useful word and idiom coverage, measured browser click-to-sound latency, recovery from provider/worker failures, and preservation of the existing design.

No LLM definition rewriting, paid Oxford subscription, GPU purchase, external search cluster, or always-live home-to-VPS speech connection is needed for the recommended first implementation.
