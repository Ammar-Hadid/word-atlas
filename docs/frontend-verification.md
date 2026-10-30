# Frontend persistence and dictionary verification

Verified 29 October 2026 against the actual VPS staging backend through the authorized SSH connection, with Vite serving the current frontend at `http://localhost:5173`. These results apply to the implementation and sample corpus available during staging; full-corpus acceptance and production rollout are reported separately.

## Preservation of the redesign

The existing layout, style tokens, fonts, themes, motion components, search interactions, and responsive breakpoints remain in use. Changes are limited to authentication/synchronization state, source attribution, form alternatives, local discovery, and the selected pronunciation controls. The home pronunciation description and footer attribution now name the implemented sources/voice.

The old production home page and current frontend were rendered in isolated Chrome contexts at 1440 × 1000 and 390 × 844. Both received the same controlled empty dictionary response, avoiding any live Merriam-Webster requests. The screenshots were visually reviewed. The measured hero font, line height, colors, position, width, and height match exactly at both sizes:

| Viewport | Hero size / line height | Hero position / size | Text / background |
| --- | --- | --- | --- |
| 1440 × 1000 | 104px / 98.8px | x112, y209.5; 682.65625 × 296.390625 | rgb(22,20,15) / rgb(244,241,234) |
| 390 × 844 | 48px / 45.6px | x16, y161.5; 358 × 136.78125 | same |

Font: Fraunces, “Iowan Old Style”, Georgia, serif. This comparison verifies the unchanged hero geometry and styling; it is not a claim of pixel-identical whole pages after adding the required new states.

Evidence: [comparison measurements](verification/design-comparison.json), [desktop before](verification/home-desktop-before.png), [desktop after](verification/home-desktop-after.png), [mobile before](verification/home-mobile-before.png), [mobile after](verification/home-mobile-after.png).

## Working browser flows

Twenty browser checks passed in the main staging run, using a temporary owner-test identity and synthetic browser records. The identity, its personal rows, operation IDs, and authenticated sessions were removed afterward. No existing owner records or personal browser profiles were used. Tests reused an installed Playwright package and local Chrome in isolated contexts; no new browser dependency was added to the application.

- Login imports 105 saved words and 55 history records into PostgreSQL with original timestamps. Proprietary-looking synthetic browser snapshots are excluded by the client identity-only import contract.
- Original `wa:saved` and `wa:history` records remain byte-for-byte intact. Reloading does not duplicate imported history visits.
- Pagination reaches the 105th saved record; history is not limited to 50 records.
- Saving the selected `lead` entry retains its validated local entry ID and survives reload. A separately authenticated browser context sees the saved record.
- Export includes all 106 saves and 56 history rows present at that point, including records beyond the loaded page.
- Logout and subsequent login succeed with a fresh CSRF token.
- A controlled unresolved lookup creates history. The mock miss avoids an external dictionary request.
- An interrupted DELETE remains visibly pending; reconnect/reload replays the same queued operation and removes the saved record successfully.
- Word and library pages fit the mobile viewport without horizontal page overflow.
- No uncaught browser exceptions occurred. Intentional missing-word and aborted-network responses were part of the tests.

A further five-check regression used two independent browser sessions: a saved word beyond the first 100 records is recognized, a removal on the second browser refreshes the open bookmark on the first when it regains focus, and preserved legacy records remain recoverable without resurrecting the removed save. Membership refreshes invalidate older responses and recheck the currently open word. [Regression evidence](verification/cross-browser-results.json).

Final screenshots were refreshed after animations settled. Light and dark mobile library/login states fit without horizontal overflow or uncaught errors. [Final rendering checks](verification/final-screenshots.json), [dark mobile library](verification/library-mobile-dark.png), [dark mobile login](verification/login-mobile-dark.png).

Evidence: [browser assertions and timestamps](verification/browser-results.json), [word desktop](verification/lead-desktop.png), [word mobile](verification/lead-mobile.png), [library desktop](verification/library-desktop.png), [library mobile](verification/library-mobile.png).

These are Chrome mobile viewport tests on the Mac, not physical iPhone/Android tests. HTTPS Secure-cookie verification belongs to the production rollout checks; localhost staging uses the development cookie configuration.

## Offline checks

```sh
node --test frontend/test/library-migration.test.js
cd frontend
npm run lint
npm run build
```

Ten offline tests pass: identity-only migration, stable identities for missing legacy timestamps, US/us case distinction, preserved browser originals, idempotent/retried batch imports, refusing unverified completion, ordered queued operations, source entries without glosses, explicit form alternatives, and observable browser-storage failure. Frontend lint and production build pass.

A browser that cannot write local storage now receives an explicit warning to keep the tab open until synchronization succeeds. A source entry without a gloss is displayed with attribution and a no-definition state rather than being mislabeled as a nonexistent word. Dictionary outages remain distinct from a local miss.

## Operational boundaries

The database is authoritative after synchronization. The browser retains an identity-only outbox for pending writes and original legacy records for recovery. Import completion markers are separate from the originals. Save/history API calls are same-origin and use the current CSRF token and stable idempotency keys. Login credentials are never written to local storage.

Library filtering and sorting apply to currently loaded pages; the page states this when more rows remain, offers Load more, and exports the complete server library/history. The home word preview uses a local-only lookup and does not request editorial enrichment or prepare audio. Optional editorial definitions are explicitly requested and added below the open-source senses; they do not replace text while it is being read.

## Measured cached Iapetus playback

Chrome played the retained Iapetus MP3 files from VPS staging through the Mac’s SSH/Vite connection. Each viewport had 20 preloaded replays (10 guide `/liːd/`, 10 metal `/lɛd/`) and 10 plays with an empty browser cache. The warm samples all had `HTMLMediaElement.readyState = 4` before seeking/replaying. Cold samples had no audio data available at click. The two senses selected different persistent asset keys.

| Scenario | n | Click → playing p50 / p95 | Estimated first sound p95 | Estimated sustained sound p95 |
| --- | ---: | ---: | ---: | ---: |
| Desktop, preloaded | 20 | 14.5 / 15.5 ms | 124.8 ms | 164.5 ms |
| Mobile viewport, preloaded | 20 | 14.9 / 15.6 ms | 125.0 ms | 164.6 ms |
| Desktop, server cached / browser empty | 10 | 56.0 / 68.5 ms | 178.0 ms | 217.5 ms |
| Mobile viewport, server cached / browser empty | 10 | 49.9 / 62.7 ms | 172.2 ms | 211.7 ms |

“Playing” comes from actual media playback events, not API response time. Estimated first sound adds the separately measured leading silence of the saved files: 107.3 ms for guide and 109.5 ms for metal. The conservative sustained-sound estimate adds 149 ms. These estimates exclude audio-device/output latency and are not microphone measurements or measurements on a physical phone. They support the cached playback targets on this staging connection; they do not establish first-time synthesis latency or performance on every network.

Across the recorded playback tests, there were **zero pronunciation POST requests**, and durable job count, usage count, and reserved characters remained **0 → 0**. Typing two autocomplete queries left browser history at **1 → 1** in each viewport and did not change the audio ledger. All playback used recordings retained from the earlier authorized audition; this test generated no new audio and consumed no synthesis allowance.

Evidence: [playback samples, percentiles, asset identities, autocomplete and ledger checks](verification/audio-browser-results.json). An initial telemetry check revealed that ready-state sampling occurred after seeking, which obscured whether media was preloaded; sampling was moved before seeking and all 40 warm samples were repeated to verify the correction. Cold samples were retained because they correctly recorded no data at click.

Three additional failure-path browser checks passed: a fully preloaded Iapetus recording played with the network disabled in the mobile viewport; a mocked synthesis request showed the existing button’s Preparing state; navigating away canceled polling and the home preview started no preparation. The pending-provider scenario intercepted its one POST entirely in the isolated browser and never reached the VPS or Google. [Failure-path evidence](verification/audio-failure-browser-results.json).

## Production HTTPS verification

The live HTTPS application was checked at 23:25–23:26 UTC on 29 October 2026 (30 October in Amsterdam), while the validated sample release was active and the full import was still running. Sixteen flow assertions passed: login, server-acknowledged save, synchronized library, logout confirmed by the session API, local `cat` and `rain cats and dogs` lookups with retained Iapetus clips, desktop/mobile viewport fit, and no uncaught browser exceptions or HTTP failures. The session cookie was verified as `__Host-wa`, Secure, HttpOnly, SameSite=Lax, host-only, path `/`; session responses were `private, no-store`. Cookie values and credentials were not recorded. Optional insights were intercepted, and all synthesis POSTs were guarded: none occurred.

A separate temporary test identity was used; the real owner library was untouched. After testing it was deactivated, all its sessions were removed, and exactly one saved `lead` and one `lead` history row were retained for the main deployment's full-backup/restore verification. Its non-secret identifiers and exact expected rows are in [production results](verification/production-browser-results.json). Cleanup after restoration belongs to that backup procedure.

Ten guide/metal plays were measured per viewport directly over production HTTPS. Nine desktop samples and all ten mobile-viewport samples were fully preloaded. Warm desktop click-to-playing p50/p95 was 14.1/15.8 ms (estimated first sound p95 125.3 ms); warm mobile was 13.7/15.5 ms (estimated first sound p95 124.9 ms). The first desktop guide click occurred before preloading completed (`readyState=1`), and took **1,429.4 ms to playing / an estimated 1,536.7 ms to first sound**. Including that cold sample, desktop p95 was 1,429.4 ms. This outlier is retained in the report and prevents claiming that all production first clicks meet the cached target. These samples have the same physical-device/output-latency limitations described above.

Screenshot review then found a defect not covered by the initial flow assertions: changing homograph tabs retained earlier definitions above the selected definitions. The selected audio and saved entry were correct. The cause was two sibling React components (`SenseList` and `EditorialEntries`) sharing `entry.id` as their key; unique `senses-` and `editorial-` prefixes fix reconciliation. No source entries were reordered or filtered to hide the problem, and the original animations remain. A browser regression compares the complete visible definition array against the selected API entry through five tab changes at both viewports; all ten local checks pass. [Exact-sense regression](verification/homograph-local-results.json).

The same review identified a misleading audio label: a server-ready asset displayed “Listen” while its media was still downloading. It now displays the existing Loading/spinner state with `aria-busy`, while remaining gesture-playable for browsers that defer preload. A controlled download test verified that tapping while loading queues playback and changes to Listen once the media is available. [Buffering checks](verification/audio-buffering-results.json). Frontend lint and build pass after these fixes; production re-verification is recorded below when the corrected bundle is deployed.

The corrected production bundle (`index-HdUQlNsj.js`, release `20261030-v2`) was rechecked at 23:35 UTC. All ten exact-sense desktop/mobile tab regressions pass, with zero console errors or uncaught exceptions. The metal tab now displays only the metal entry's six initial senses; guide and adjective tabs likewise match their own source definitions. [Production regression](verification/homograph-production-results.json). The production word screenshots above were replaced with captures after this correction: [desktop](verification/production-lead-desktop.png), [mobile](verification/production-lead-mobile-viewport.png). The two controlled buffering checks also pass against the deployed code. [Production loading-state verification](verification/audio-buffering-production-results.json).

## Offline tabs and session-bound pagination

Final independent review found two additional persistence risks. A stale tab could overwrite another tab's pending saves because the old outbox was stored as one array. New operations now have independent durable localStorage keys. Storage events refresh other tabs, and Web Locks serialize queue draining within a browser when supported; stable server operation IDs still protect duplicate retries. The legacy `wa:outbox:v1` array is read in place and remains untouched. Only completed legacy IDs receive recovery markers; new completed operations are removed individually, so completion records do not grow with every new visit.

A real Chrome test used two separate pages sharing one isolated browser storage partition, with both pages loaded before the connection was disabled. Concurrent offline saves of `cat` and `dog` produced two independent durable operations. Both pages were closed. Reopening a new page after reconnect delivered each save once to the isolated mock API and displayed both words. The acknowledged operation keys cleared, while the original outbox/library/history keys stayed byte-for-byte intact. The test used synthetic definitions and no external provider requests.

Pagination responses now carry the requesting principal and session generation. Logout invalidates those requests and clears private rows, membership data, and pagination state. A browser regression held the owner's second-page response, logged out, and then delivered that response: no owner word, count, or Load more control appeared in the guest view. All seven combined browser assertions pass with no uncaught exceptions. [Offline-tab and logout evidence](verification/offline-tabs-results.json).

Thirteen offline tests now pass, including independent-operation durability, same-time legacy ordering, preserved migration originals, no resurrection after acknowledgment, and retry after storage acknowledgment failure. Frontend lint and production build also pass after these changes.

The same seven assertions passed again at 23:52 UTC against production bundle `index-CLBQ80zW.js`, with the API intercepted into an isolated synthetic store and no remote personal-data mutations. [Production offline-tab and pagination regression](verification/offline-tabs-production-results.json). The reusable script is `frontend/test/browser-library-regressions.mjs`; it accepts `WA_ORIGIN`, `PLAYWRIGHT_MODULE`, and `CHROME_PATH` so it can use an already installed browser toolchain without adding application dependencies.

## Published full-corpus browser integration

After publication of `kaikki-20261029-full`, the live application passed 38 read-only integration assertions at 00:05 UTC on 30 October 2026. Fresh anonymous Chrome contexts at 1440 × 1000 and 390 × 844 opened `serendipity`, `petrichor`, `children`, and `kick the bucket`. Each showed the full release ID under Attribution & release, the corresponding source definition, and its supplied forms without horizontal overflow. Optional insights/enrichment were intercepted and dictionary requests were guarded with `localOnly=1`; no external dictionary fallback or synthesis was exercised.

`children` correctly preserves its two source plural senses and offers both `child` and `childer` as explicit base links; it does not silently choose a base where the source is ambiguous. Its five alternate forms retain their labels. The idiom `kick the bucket` renders as its own verb entry with three forms. Local autocomplete finds `petrichor` from `petrich` without adding a history operation (4 → 4 guest operations per viewport). There were zero personal/audio writes, browser exceptions, or HTTP errors. Guest browser contexts were discarded afterward.

Evidence: [full-corpus browser assertions](verification/full-corpus-browser-results.json), [desktop forms](verification/full-corpus-children-desktop.png), [mobile forms](verification/full-corpus-children-mobile.png). These checks confirm that the published full corpus works through the preserved frontend; corpus-wide counts and release validation are recorded in the import/deployment reports.
