# Kaikki import measurements — 29 October 2026

This report records actual runs on `nexo-vps`. All imports run on that VPS; no mini PC or external dictionary benchmark is involved.

## Source and preservation

- Supported raw English-edition JSONL gzip: `https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz`.
- Downloaded bytes: 3,082,185,963. HTTP Last-Modified: 25 October 2026 08:19:16 GMT; ETag `6addbb84-b7b66ceb`.
- Upstream dump: 1 October 2026. The accompanying [English index](https://kaikki.org/dictionary/English/) reports extraction 25 October 2026, Wiktextract `f9fe161b9dd1e898352c51bef7295e774bba2ef1`, Wikitextprocessor `6f96ddf5f3466707f1869fe6618390fd77dfd109`. The manifest records that version evidence rather than claiming the raw gzip contains embedded version metadata.
- Importer `word-atlas-kaikki-1` streams decompression and filters `lang_code = en`. It hashes compressed source bytes; a partial-prefix digest is labelled as a sample checksum, never a full download checksum.
- All ordered source glosses, source senses, grammatical labels, example sentences authored on Wiktionary, forms, IPA variants, etymologies and semantic relationships survive normalization. Independently copyrighted quotations are omitted; citation metadata and omission reason remain. No source audio files are downloaded or relabelled as Google audio.
- Derived phrase links carry relationship context, not fabricated definitions. Standalone phrase records get complete entries; relationship-only links never turn the parent sense into a child's definition.
- Source signatures distinguish headword, POS, etymology, source head template and sense blocks. They are separate from durable entry identity: after a complete staged import, known signatures and exact matches are reconciled first; a sole unmatched old/new entry in the same source family (headword/POS/etymology number) retains the old stable ID through a persistent alias. Multiple unmatched homographs remain explicit ambiguities and tombstones. Sense IDs and form references are updated with the stable mapping before publication. Ordinary unambiguous gloss, etymology-text and template edits therefore do not disconnect personal records. Actual same-POS blocks such as the two senses of `wares` remain distinct.

## First 10,000 English records

Run: `kaikki-20261029-sample`, published for staging and retained for rollback, completed successfully in **23.847 seconds**.

| Measure | Actual |
|---|---:|
| Source JSONL lines read | 44,882 |
| English records / persisted source entries | 10,000 |
| Distinct headwords | 5,053 |
| Senses | 36,356 |
| Whole-expression entry records (corrected classification) | 524 |
| Distinct source-declared whole expressions | 485 |
| Distinct multiword headwords | 461 |
| Idiom entries | 13 |
| Phrasal verb entries | 5 |
| Form-only entries | 1,531 |
| Form aliases | 20,238 |
| Rejected records | 0 |
| Importer observed RSS | 83 MiB |
| Entire database after import | 67,712,691 bytes |
| Entries table + indexes | 6,217,728 bytes |
| Source payload table + indexes | 43,286,528 bytes |
| Forms table + indexes | 9,609,216 bytes |
| PostgreSQL memory observed after run | 108.8 MiB / 512 MiB limit |

Container limits: 512 MiB RAM, 0.75 CPU, two database connections, 250-record transactions, four GiB disk stop threshold. Before import, 13,961,666,560 bytes of root storage remained after downloading the compressed source. The compressed file remains available for reproducibility; no uncompressed dump is written.

The first records are rich common words and are **not representative of the long tail**. At approximately 5.9 KB of indexed storage per entry, naive multiplication to 1.5 million records approaches 9 GB. A systematic sample across the complete stream is required before the full-import go decision.

A sequential local-database coverage run against this intentionally small sample measured p50 6.5 ms / p95 37.6 ms across 102 queries, with most expressions correctly absent from this early slice. These are sample lookup timings, not full-corpus/load or browser playback claims.

## Integrity and repeatability verification

`node --env-file=.env.test --test test/import-release.test.js` passed on the isolated VPS test database. It exercises repeated insertion without duplicate rows, staging invisibility, validation before publication, atomic switch and rollback, exact `US`/`us`, punctuation normalization, source form resolution, bounded fuzzy suggestions, retained stable entries after a source record disappears, and refusal to validate incomplete input as a complete release. Pure fixtures additionally cover multi-gloss retention, non-English filtering, quote-rights exclusion, form-link cycles and ambiguous homographs. No external dictionary or synthesis calls are used.

Systematic sample and full publication results are recorded below when complete.

## Systematic sample and full-import storage decision

Run: `kaikki-20261029-stratified`, **every 100th English source record across the entire compressed stream**, unpublished. Completed in **456.687 seconds**. Started at 0.75 CPU and increased to 1.25 CPU after observing adequate idle capacity; memory remained under 90 MiB in progress samples. The source gzip was consumed completely and verified by its gzip integrity check.

Complete compressed SHA-256: `784574cc577d333bbf9e659be38efa27e75e9bfc0a2a8c7ab2371bb5fec29b2d`. This checksum is pinned in the manifest before the full import; interrupted imports can resume only against that same verified source.

| Measure | Actual |
|---|---:|
| English records selected | 14,992 |
| Distinct headwords | 14,992 |
| Senses | 17,846 |
| Entries with definition text | 14,977 |
| Whole-expression entry records | 3,245 |
| Distinct source-declared whole expressions | 3,245 |
| Distinct multiword headwords | 3,236 |
| Idiom entries | 95 |
| Phrasal verb entries | 59 |
| Proverb entries | 12 |
| Form-only entries | 6,838 |
| Form aliases | 9,334 |
| Rejected records | 0 |
| Entire database including both samples | 118,085,299 bytes |
| Additional database bytes vs first sample | 50,372,608 bytes |
| Root filesystem available after both samples | 13,747,523,584 bytes |

The systematic estimate is approximately **5.0 GB of indexed database growth for 1.5 million records**. The full-import budget is 6 GB (20% growth margin), 1 GB WAL allowance and 1 GB compressed-backup allowance, leaving roughly 5.7 GB available—above the enforced 4 GiB stop threshold. Backup restoration is planned outside the VPS, so an extra full database copy is not allocated on the VPS. **Go decision:** full staging import started as `kaikki-20261029-full`, with 1.25 CPU, 512 MiB, two DB connections and the same 250-record batches. The first 10,000-record sample remains active until full validation and is retained for rollback.

The systematic sample also establishes that some upstream records contain no usable gloss (15 in this sample). Counts of imported source entries and entries with definitions are reported separately; records without definitions are not claimed as useful dictionary coverage.

## Real-source duplicate recovery

The first full staging attempt deliberately stopped at approximately 170,000 records when the raw source repeated `teratological` with identical head template, etymology and senses but different derived-word metadata. It did not publish partial content. The active sample remained available.

The importer now unions metadata **only for an identical lexical/sense signature** and records hashes of the individual normalized source variants. Different meanings remain separate stable entries. Relations, pronunciation variants, forms, examples and citations are retained from both copies. A synthetic fixture and the isolated database test verify that importing either copy again does not remove the union or duplicate it. The checksum-pinned failed staging release was resumed without deleting any existing entry or personal record. This is actual interrupted-import recovery evidence, in addition to the isolated failure tests.

## Reviewed unsupported source record

Raw line **2,496,958** has `lang_code = en`, `pos = punct` and a headword consisting of **one ASCII space**. It describes spacing in vaporwave text, not a searchable lexical word. Its SHA-256 is `5d0dedf825b75b69466509349433f9f4ce3ce74edf5c9fe7f8306c77b60516f6`; the original is retained as `import/rejected-2496958.json` on the VPS. The manifest records an explicitly reviewed whitespace-only-headword exclusion with this exact line and hash. No general rejection bypass is enabled. A mismatched hash/line or malformed JSON still blocks publication. Final counts retain the rejection/exclusion rather than claiming it was imported.

## Stable identity and classification verification

Migration 006 adds persistent aliases for changed source signatures, identity reconciliation events, and ordered C-collation suggestion indexes. The finalizer processes source families in a bounded cursor, matches exact/known signatures before considering a sole unmatched old/new pair, and refuses to guess among multiple unmatched homographs. Tests prove that an unambiguous punctuation-only gloss change keeps the same entry ID, sense-ID prefix and form references. Publication checks that reconciliation used the currently active release; a concurrent release switch requires reconciliation again.

Expression classification distinguishes complete expressions from single words with an idiomatic sense. Phrasal verbs require a multiword headword and verb POS; standalone words such as `about` retain their source sense labels without being counted as phrasal verbs. The early sample classification is repaired before final reporting. The sample counts above have been recomputed with this rule; the stored release counts are updated as well.

## Finalization resource failure and correction

The complete source stream reached EOF at **11,121,531 JSONL lines**, containing **1,499,161 English records**: 1,499,160 selected lexical records plus the one explicitly reviewed whitespace punctuation exclusion. The complete gzip checksum matched the pinned SHA-256. The original count query joined wide JSON payloads while computing distinct headwords and spilled several GiB to PostgreSQL temporary files. The operator canceled only that Word Atlas query; no partial release was published, no live data was deleted, and free disk recovered from approximately 2.3 GiB to 6.6 GiB when PostgreSQL removed its temporary files.

The corrected tooling streams payload aggregates directly from `source_entries`, then counts distinct headwords through separate narrow ID/text joins. Kind repair uses one sequential cursor with 250-row fetches. The initial hash-ID keyset implementation caused random heap/TOAST reads and was canceled safely after observing slow batches; the sequential cursor avoids repeated random I/O without materializing wide JSON. The all-entry lookup-key integrity check projects only the ID and normalized key before its join. `EXPLAIN (VERBOSE, FORMAT JSON)` on the full staged corpus verifies that JSON payloads do not pass through hash/sort nodes. Word Atlas production and test roles now have a **256 MiB temporary-file limit**; this does not change PostgreSQL globally. The importer enforces a **4 GiB minimum free-space floor** during batches and between finalization phases.

A durable compressed-source EOF receipt is stored before identity reconciliation. A restart resumes validation from that receipt instead of replaying new source signatures into rows already mapped to durable IDs. The actual pre-receipt run was recovered only after matching its final line/English counters to the independently complete systematic scan and hashing the complete gzip again. The integration test covers restart after an identity mapping without duplicate staged entries.

Migration 007 removes only the two superseded prefix indexes after full-scale `EXPLAIN` confirmed the ordered C-collation indexes serve the bounded suggestion queries. Prefix lookup considers at most 200 entry candidates and 200 form candidates before deduplicating to ten suggestions. During the active import, three cold prefix probes measured 60.7–154.8 ms; this is an observed concurrent-import condition, not a claim about final warm production latency.

## Complete corpus validation

The full release `kaikki-20261029-full` validated successfully after source-wide repair, durable-identity reconciliation, counts and planner statistics in **187.566 seconds**. The resumed ingestion duration recorded in its receipt is **2,649.237 seconds**; this includes the canceled final-count attempt and excludes the earlier interrupted 170,000-record attempt. Raw source reading itself is not claimed to equal the finalizer timing.

| Measure | Actual |
|---|---:|
| Persisted lexical entry records | 1,499,153 |
| Distinct headwords | 1,396,110 |
| Senses | 1,795,039 |
| Entries with definition text | 1,497,820 |
| Source entries without definition text | 1,333 |
| Form-only entry records | 687,383 |
| Source form aliases | 926,718 |
| Whole-expression entry records | 328,675 |
| Distinct source-declared whole expressions | 323,226 |
| Distinct multiword headwords | 321,917 |
| Idiom entry records | 8,995 |
| Phrasal-verb entry records | 5,202 |
| Proverb entry records | 1,576 |
| Reviewed whitespace punctuation exclusions | 1 |
| Unreviewed rejections | 0 |

Seven repeated selected source records are deduplicated/merged by their lexical signature, accounting for the difference between 1,499,160 selected input records and 1,499,153 persisted entries. Expression counts describe headword structure and source classification; they do not claim that every multiword technical name is an idiom. Form-only entries preserve their source gloss and attach a lemma only where the source link resolves unambiguously.

The compressed raw source has been independently copied to the Mac and its SHA-256 verified there. After the complete EOF receipt and second VPS checksum check, the operator removed only the exact 3,082,185,963-byte VPS gzip. The manifest, quarantined whitespace record, logs and database remain. Free VPS disk increased to approximately 9.5 GiB. Validation resumed from PostgreSQL without opening the removed source file, providing actual EOF-receipt recovery evidence.

## All-entry integrity and query coverage

The evaluator checked **all 1,499,153 source entries**, rather than issuing millions of HTTP calls. Payload IDs, NFC/punctuation/whitespace-normalized exact lookup keys, English-language membership and form references all passed: **zero mismatches or orphan forms**. Foreign keys and matching exact keys establish reachability for every persisted entry through the indexed lookup relation. The separate empty-definition count is 1,333.

The 102-query category-labelled fixture found **94 of 101 real terms**, with the intentionally invalid sentinel correctly absent. All common, uncommon, technical, inflection, spelling-variant, punctuation, homograph and case fixtures resolved. Expression coverage is **57/64**: 27/32 idioms and 30/32 phrasal verbs. Seven exact queries remain absent locally: `a piece of cake`, `the ball is in your court`, `cost an arm and a leg`, `the tip of the iceberg`, `a blessing in disguise`, `cut down on`, and `run out of`. Source dictionary headwords sometimes use a shorter base expression; the resolver does not silently strip articles/prepositions or guess possessive substitutions. These requests remain eligible for the separately quota-guarded Merriam-Webster fallback. No external provider was called during this evaluation.

Measured sequential VPS database-backed query latency: **p50 4.3 ms, p95 210.7 ms** across all 102 queries. The test used the final 200 ms transaction-local fuzzy-search deadline; misses may omit fuzzy suggestions when that deadline is reached. Exact and prefix lookup retain their own normal limits. This measurement includes the local database round trip and form resolution, but excludes HTTP transport, authentication, browser rendering and speech synthesis. The separate rollout/load report covers those paths.

Database size at evaluation: **5,271,623,347 bytes**, including both retained samples and application tables. Indexed relation sizes were entries **1,271,496,704 bytes**, source payloads **3,490,357,248 bytes**, and forms **499,916,800 bytes**. Future imports must repeat the storage preflight for their staged payload, forms, WAL and backup space; these measurements do not authorize an unbounded scheduled refresh.

Machine-readable evidence: [full evaluation](verification/corpus-full-evaluation.json), [finalization receipt/counts](verification/corpus-finalization.jsonl), [narrow-query plans](verification/corpus-query-plans.jsonl), and [sequential kind-scan plan](verification/corpus-kind-scan-plan.json). The plans document both the corrected narrow projections and the subsequent replacement of the original keyset kind scan with a sequential cursor.

## Publication and rollback

The clean full release was atomically published as **`kaikki-20261029-full`** after the all-entry integrity check and category evaluation. Its publication manifest includes the evaluation timestamp, structural integrity results and category counts. The previous active **`kaikki-20261029-sample`** release remains present and published, ready for an atomic pointer rollback through `publishRelease('kaikki-20261029-sample', {allowSample:true})`; personal records and stable entry IDs are retained. The complete systematic sample also remains available for audit. Publication evidence is recorded in [corpus-publication.jsonl](verification/corpus-publication.jsonl).

The production full database backup, isolated restore and broader HTTP/browser/load verification are handled in the rollout evidence. This corpus report does not claim those checks solely from successful import/publication.

The production rollback path was exercised in **133 ms** in one transaction: full → retained sample → full. An injected database client saw `ultracrepidarian` disappear from the sample and reappear after restoration; its durable entry row remained throughout. `lead` resolved from each selected release. Other database sessions saw the full release for the entire test, and the committed active release remained full. Hashes of saved/history rows, all six ready audio assets and both provider-ledger rows (434 reserved/consumed characters in total) were unchanged. No provider call was made. See [rollback check](verification/corpus-rollback-check.json).

The deduplication count is **seven excess input occurrences**, not seven independently counted duplicate headword groups. The receipt establishes 1,499,160 selected records and 1,499,153 persisted entries, with zero identity remaps during this same-source publication. An indexed check confirms that `teratological` preserves two normalized source variants. A separate full-table tally of distinct duplicate groups was deliberately not added during the final backup/load checks.
