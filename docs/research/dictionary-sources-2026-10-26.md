# Dictionary coverage and editorial style research

Researched 26 October 2026. This is a source and content recommendation, not an application change. Server sizing and pronunciation performance are covered separately.

## Recommendation

Build a permanent, self-hosted English lexical library from **English Wiktionary via Kaikki/Wiktextract**, and retain **Merriam-Webster as an optional, live editorial layer**. Use its **Learner's Dictionary and Collegiate** as the two registered reference products, retaining the existing Learner's integration and making Collegiate definitions a genuine fallback. Learner's is especially well matched to clear definitions, examples, and idioms. No paid dictionary subscription is necessary for this approach.

Keep definitions from their actual dictionary sources. Borrow the concise presentation and editorial principles of Oxford; do not replace dictionary entries with AI-generated explanations or mislabel another source's text as Oxford. No source can credibly promise every English word, every regional expression, or every newly coined idiom. Evaluate useful lookup coverage rather than promoting an inflated entry count.

## Source comparison

| Source | Verified scope and strengths | Cost and constraints | Proposed role |
|---|---|---|---|
| Kaikki / English Wiktionary | Current English browse index reports **1,396,111 distinct word forms**. This includes inflections, names, and variants; it does not mean 1.4 million independent dictionary headwords. | Open data with attribution and applicable share-alike obligations. | Persistent broad-coverage library and search index. |
| Merriam-Webster Learner's | Nearly **100,000 words and phrases**, **160,000+ examples**, and **22,000+ idioms, verbal collocations, and common phrases**, plus IPA and audio. The last figure is a mixed category, not 22,000 distinct idioms. | Free non-commercial allowance described below. | Preferred simple editorial definitions and usage examples when available. |
| Merriam-Webster Collegiate | **250,000+ definitions**, **111,000 audio pronunciations**, **3,500+ idioms/phrases**, and **113,000 usage examples**. Definitions are not a count of headwords. | Same allowance; separate registered reference. | Preserve current authoritative source and broaden beyond learner vocabulary. |
| Open English Wordnet | Current site shows **153,261 entries and 120,068 synsets**; short definitions and sense-linked semantic relationships. | CC BY 4.0. | Optional later enrichment for related meanings, synonyms, and taxonomy. |
| Free Dictionary API | Simple no-key lookup endpoint returning definitions and pronunciation data. Its public documentation does not establish exhaustive coverage or a service-level guarantee. | Free hosted service; donation supported. | Optional fallback, not the primary library. |
| Oxford Dictionaries API | Modern English dictionaries, distinct from the historical OED. | Paid production use; storage rights are materially restrictive. | Optional future paid editorial source if exact Oxford wording becomes essential. |

Sources: [Kaikki English index](https://kaikki.org/dictionary/English/), [MW Learner's product](https://dictionaryapi.com/products/api-learners-dictionary), [MW Collegiate product](https://dictionaryapi.com/products/api-collegiate-dictionary), [Open English Wordnet](https://en-word.net/), [Free Dictionary API](https://dictionaryapi.dev/), [Oxford FAQ](https://developer.oxforddictionaries.com/faq).

The counts above measure different things and overlap. They must not be added together or presented as an apples-to-apples coverage ranking. Princeton explicitly says its original WordNet is no longer developed and points to the community-led Open English Wordnet; choose the latter for a new optional integration. [Princeton project status](https://wordnet.princeton.edu/)

## Import the supported data, not a deprecated export

Kaikki's English index currently offers a **3.2 GB postprocessed English JSONL**, but explicitly marks that download as deprecated. Its current snapshot identifies an extraction on **21 October 2026**, using the **1 October 2026** Wiktionary dump. [English download notice](https://kaikki.org/dictionary/English/)

The supported raw English-*edition* export is **24.8 GB uncompressed / 2.9 GB gzip**. It includes many languages with English glosses, so the importer must filter records to English (`lang_code = "en"`), rather than importing every record. Stream decompression and filtering to avoid materializing the full multilingual file. Kaikki says raw data are normally updated at least weekly. Store a release manifest with dump date, extraction version, retrieval time, and checksum. The final indexed database size requires an actual import measurement. [Kaikki raw downloads](https://kaikki.org/dictionary/rawdata.html)

Wiktextract exposes glosses, parts of speech, inflections, pronunciation links, usage qualifiers, alternative forms, and semantic links. Availability varies by entry. Use the published extraction rather than running the complex Wiktionary/Lua parser on every lookup. The extractor's MIT code license is separate from the dictionary content license. [Wiktextract documentation](https://github.com/tatuylonen/wiktextract)

## Idioms need explicit modeling

Kaikki's current index contains **12,762 senses tagged idiomatic**. This is a tagged-sense count, not a complete or deduplicated inventory of idioms. Phrasal-verb categories also exist. Neither source's labels alone capture every useful multiword expression. [Idiomatic tag index](https://kaikki.org/dictionary/English/tags/humorous--inversion.html), [phrasal-verb categories](https://kaikki.org/dictionary/English/categories-other/English%20oaths--English%20phrasal%20verbs%20formed%20wi-YzIhnJd~.html)

Proposed implementation requirements:

- Import whole multiword headwords, idiomatic senses, phrasal verbs, proverbs, and phrase aliases. A phrase must be searchable as a complete expression.
- Preserve canonical phrases with placeholders such as “someone's,” and model known variants explicitly. Avoid guessing that arbitrary pronoun substitutions have the same meaning.
- Preserve spaces, apostrophes, and hyphens in display text; add normalized lookup keys for typographic differences.
- Follow inflection/alternative-form links to a useful base entry, with cycle protection. A bare “plural of X” entry should lead directly to X's meanings.
- Keep each sense, example, register label, and pronunciation linked to its source. Do not merge two definitions simply because their headwords match.
- Parse Merriam-Webster's phrase/run-on structures as well as top-level definitions. Its Learner's sample has phrase variants in `meta.stems` and phrase entries in `dros`; those can disappear if an adapter only reads `shortdef`. [Learner's response example](https://dictionaryapi.com/products/api-learners-dictionary)

## What “Oxford style” should mean here

Oxford's own Google partnership page still describes Google's English dictionary as supplied by Oxford Languages. This research therefore does **not** conclude that every dictionary result has been replaced by AI. Oxford describes evidence-based lexicography, labels for register and regional usage, and contextual examples selected by lexicographers. Its Google dictionary product and Oxford Advanced Learner's Dictionary are related editorial inspirations, but different products. [Oxford Languages and Google](https://languages.oup.com/google-dictionary-en/)

Oxford Learner's explains that its definitions use a controlled core vocabulary to remain understandable. This supports a clear editorial goal, not permission to copy its proprietary entries or word lists. [Oxford 3000 explanation](https://www.oxfordlearnersdictionaries.com/about/oxford3000)

Suggested content contract for this app (our recommendation):

1. Show the relevant part of speech and a short, direct definition first.
2. Preserve distinct senses and their grammar; do not turn several meanings into one paragraph.
3. Keep informal, technical, regional, offensive, rare, and obsolete labels visible where they affect interpretation.
4. Attach one useful example to the matching sense when the source supplies one; allow more on expansion.
5. Use source-authored short definitions when they retain the meaning. Never truncate at an arbitrary word count or choose the shortest definition merely because it is shortest.
6. Show a compact initial set of senses with expansion. Preserve source order by default and avoid implying a frequency ranking unless supported by actual data.
7. Show the actual dictionary source. Keep manually improved open-data definitions as a separate, attributed editorial field, with the original recoverable.

Wiktionary entries vary in readability and completeness. A free system can retain this presentation style everywhere, but cannot promise Oxford-level editorial consistency throughout the long tail without human editing.

## Licensing and paid alternatives

Merriam-Webster allows non-commercial use of up to **two reference works**, with **1,000 queries per day per API key/reference**. Its terms prohibit automated or recorded queries without written approval. Accordingly, use it for user-requested lookups, not systematic bulk harvesting or background corpus construction. The public terms reviewed do not provide a clear blanket right to permanently cache its definitions/audio: confirm that permission before using it as a permanent local corpus. Keep saved word identities and user notes independent of proprietary content. [MW API](https://www.dictionaryapi.com/), [MW terms](https://dictionaryapi.com/info/terms-of-service)

Wiktionary text is available under CC BY-SA 4.0, with exceptions for externally sourced material. Preserve article links, contributor attribution via the source, license information, and modifications. Audio and quoted examples can carry distinct rights, so retain their provenance rather than assuming every file has the text's license. [Wiktionary copyright page](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)

CC BY-SA permits copying and adaptation, including commercial use, with attribution and share-alike requirements for shared adaptations. Keep licensed lexical data and original application code clearly distinguished; do not casually assert that the entire application inherits the dictionary's license. [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

Oxford's free sandbox is limited to **500 calls** and entries beginning with the alphabet's first letter. Its FAQ allows caching/offline storage **only under an Enterprise license** and says Lite/Growing plans are paid annually upfront. It offers no general free personal-use production plan. [Oxford FAQ](https://developer.oxforddictionaries.com/faq)

The official pricing application's published frontend configuration currently lists **API Lite at £600/year (£50/month equivalent)** with 1,000 monthly calls and £0.10 overage; **Growing from £2,400/year**; **Enterprise from £5,000/year**. These are published plan figures, not a quote for the requested caching rights; verify the final contract/tax treatment before buying. The pricing page is client-rendered, so figures were checked in its public JavaScript bundle, whose model explicitly names annual and monthly prices. [Oxford pricing](https://account.oxforddictionaries.com/pricing), [published pricing bundle inspected](https://account.oxforddictionaries.com/assets/index-DDf8xFqw.js)

Free Dictionary API remains useful, but its maintainer documents operating-cost pressure. A hosted free endpoint is not equivalent to owning a reproducible lexical database. Its old sample's Google audio URL also should not be treated as a license to scrape Google's dictionary or bulk-copy Oxford recordings. [Maintainer README](https://github.com/meetDeveloper/freeDictionaryAPI)

## Proposed retrieval and acceptance criteria

Use the local index for discovery, inflections, aliases, and phrase matching. On opening an entry, fetch an eligible Merriam-Webster editorial entry where appropriate; fall back immediately to the local open-data entry on misses, timeout, quota exhaustion, or offline use. Keep source selection explicit and avoid disruptive replacement of a definition while the user is reading it. Wordnet enrichment is optional and should be added only if it solves an observed gap.

Before adopting the import, measure a fixed list containing the user's missed lookups, common vocabulary, specialist vocabulary, modern slang, inflected forms, hyphenated words, and at least several dozen idioms/phrasal verbs. Report coverage by category, useful base-form resolution, and examples present. Separately inspect incorrect sense matching, duplicate entries, truncated definitions, and unhelpful form-only entries. This evaluates the app's own open-data importer; do not run a comparative Merriam-Webster benchmark contrary to its terms.

The first implementation should deliver reproducible imports, source-aware senses and examples, resilient phrase search, attribution, and a persistent user database. An LLM definition-writing pipeline is unnecessary for that result.
