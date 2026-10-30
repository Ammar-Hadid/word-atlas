# Free-only synthesis allocation

Verified 29 October 2026 UTC: Google publishes 1,000,000 free Chirp 3 HD input characters per month and automatic billing above that limit. [Official pricing](https://cloud.google.com/text-to-speech/pricing). Credits are not treated as a free allowance.

Read-only billing enumeration found three linked projects. Text-to-Speech is disabled on the two other projects, whose current-month metrics show no TTS calls. Word Atlas metrics reconcile 30 audition synthesis calls (2,954 conservatively counted input bytes, including other audition models). The owner confirmed that only the audition used Chirp 3 HD and no other app consumes it. Read-only voice discovery with the production service account verified Iapetus availability.

The initial allocation permits 100,000 new conservatively counted characters, below the remaining 997,046. The ledger charges the full UTF-8 serialized request, including voice/configuration overhead, rather than just billable text. The grant covers October 2026 and expires **31 October 2026 at 23:59 UTC**. It does not renew automatically. Worker dispatch requires one current grant with at least 30 seconds of verified validity remaining, a transactional reservation, and an independent 100,000-per-month cap across operator grants. Uncertain outcomes retain reservations and never retry automatically.

Two retained production smoke recordings consumed 434 ledger units in total (274 for phonetic “cat”; 160 for “rain cats and dogs”). Both jobs completed; repeated preparation reused their files. Existing lead recordings were reused from the approved audition without synthesis. [Live evidence](../verification/live-audio-smoke.json).

Renewal: recheck published pricing, all linked billing-account consumers and current-month usage; establish a known free allocation; record evidence and create exactly one current-month grant with a short verification expiry. Do not enable synthesis when any consumer or allowance is unknown. Billing budgets are not spending caps. Cached recordings remain available after generation stops. No paid fallback, different model or welcome credit is used.

The production service account has only Service Usage Consumer on the Word Atlas project. Its JSON key is mounted read-only into the worker from `/srv/apps/word-atlas-ops/credentials/google-tts.json`, never into the frontend or image. Personal developer ADC was not deployed. Server-owned pronunciation IDs enforce Iapetus, US English, normal rate and MP3.

Merriam-Webster has separate persistent 900-request rolling-24-hour limits per reference, below the documented 1,000/day ceiling. Its initial hold until 30 October 2026 at 23:00 UTC accounts conservatively for the prior application's untracked requests. No proprietary definitions or recordings are retained in the database.

Datamuse reserves a whole six-call insight batch atomically, with a conservative 10,000-request rolling-day ceiling and bounded caching. Its official page currently conflicts on January/February 2027 free-access changes; this implementation stops new requests on the earlier date, 1 January 2027, unless free access is explicitly reverified. Neither optional provider can block an available local definition.
