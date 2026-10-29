# Dictionary contract and fixture baseline

Verified 29 October 2026. This report describes deterministic fixtures, not measured live dictionary coverage. No Merriam-Webster API requests were made for the evaluation.

## Existing interface contract

`GET /api/words?term=...` returns `{ word: Entry[], quotes: Quote[] }`. The redesigned frontend relies on these fields:

| Field | Existing use |
| --- | --- |
| `id`, `word`, `partOfSpeech`, `homograph` | Entry tabs, React keys, page heading, saves |
| `syllables`, `phonetic`, `audio` | Word hero and legacy pronunciation button |
| `senses[].heading`, `senses[].senses[]` | Ordered meaning groups |
| sense `id`, `definition`, `examples`, `usageNotes`, `grammar`, `labels` | Definitions, grammar/usage badges and separate examples |
| `shortDefinitions` | First-definition fallback |
| `forms[]` with `form`, `label`, `phonetic`, `audio` | Existing inflection list |
| `phrases[]` with `id`, `phrase`, `type`, `definition`, `examples`, `senses` | Phrase list/filter |
| `etymology`, `firstKnownUse` | Origin card |
| quote `text`, `author`, `source`, `date` | Published quotation card |

Arrays remain arrays even when empty. No source-authored meaning is truncated by the adapters. The UI initially shows six senses and can expand the rest; the current phrase list displays each phrase's first sense, while all phrase senses remain in the API.

New compatible fields are `source`, `sourceReference`, `pronunciations`, sense `exampleDetails` and ordered `content`, phrase `forms`, and entry `derived`. `source.storage` is `live-only` for Merriam-Webster. `source.referenceId` remains independent of user data and is safe to retain; definitions/examples/media are not approved for durable storage. Pronunciation `alphabet` distinguishes IPA from MW respelling. These editorial pronunciation references are not Google synthesis IDs. Approved Iapetus playback is handled by the persistent pronunciation system.

## Reproducible fixture baseline

Run from the repository root:

```sh
node --test backend/test/editorial-sources.test.js
```

`backend/test/fixtures/dictionary-cases.json` contains original synthetic content under CC0 and a list of query strings. It does not contain copied API responses, provider credentials, or a proprietary corpus. Structural handling follows the [official Merriam-Webster JSON documentation](https://dictionaryapi.com/products/json).

The old controller's mandatory Learner's-match gate accepted **4 of 6 positive synthetic cases**. Two valid Collegiate-only results were discarded. The new service accepts **6 of 6**, and still rejects the explicit unknown term. The phrase case now opens its own meanings instead of the parent headword. This measures the known fallback bug with controlled inputs; it is not a claim about the proportion of real English covered.

The corpus evaluation list has **102 category-labelled cases**, including **64 distinct idioms/phrasal verbs** (32 of each), common and uncommon terms, technical vocabulary, inflections, variants, punctuation, case distinctions, homographs, and an intentional miss. Repeated terms in different categories are intentional. Full-corpus results must be recorded separately after the import; this list does not pre-assert dictionary availability.

## Adapter verification

Ten offline tests pass, including:

- all definition blocks, nested parenthesized senses, binding substitutes, divided senses, multiple text/example segments, usage notes and attributed examples;
- forms, alternate spellings, pronunciation variants, full phrase senses, and phrase projection;
- case-sensitive matches before case-folded fallback;
- complete Collegiate definitions when Learner's misses, times out, or is unavailable;
- no origin/quotation attachment using spelling, part of speech, or homograph numbering alone;
- origin attachment only through the explicit Learner's `meta.target.tuuid` to Collegiate `meta.uuid` link;
- bounded suggestions without additional provider lookups;
- independent timeout and quota-exhaustion status.

Focused ESLint for changed adapter/service/test files passes. Network cancellation and persistent per-reference daily quotas belong to `merriamService.js`; the editorial service also has a bounded response deadline. Corpus lookup and provider storage policy are integrated by the controller and repositories separately.
