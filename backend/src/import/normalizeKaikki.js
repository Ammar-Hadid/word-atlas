import { createHash } from 'node:crypto';

export const IMPORTER_VERSION = 'word-atlas-kaikki-1';
export const SOURCE_ID = 'wiktionary-en';
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const normalizeKey = (text = '') => text.normalize('NFC').replace(/[’‘ʼ]/gu, "'").replace(/[‐‑‒–—−]/gu, '-').replace(/\s+/gu, ' ').trim();
export const validTerm = text => typeof text === 'string' && text.trim().length > 0 && text.length <= 200 && !/[\p{Cc}\p{Cs}]/u.test(text);
const strings = items => Array.isArray(items) ? items.filter(item => typeof item === 'string') : [];
const objects = items => Array.isArray(items) ? items.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
const distinct = items => [...new Set(items)];
const POS = { adj: 'adjective', adv: 'adverb', prep: 'preposition', conj: 'conjunction', pron: 'pronoun', intj: 'interjection', num: 'numeral', name: 'proper noun', phrase: 'phrase', proverb: 'proverb', punct: 'punctuation' };

export function entryKind(raw) {
  const tags = [...strings(raw.tags), ...objects(raw.senses).flatMap(sense => strings(sense.tags))];
  const categories = [...strings(raw.categories), ...objects(raw.senses).flatMap(sense => strings(sense.categories))].join(' ');
  if (raw.pos === 'proverb') return 'proverb';
  const expression = /\s/u.test(raw.word) || raw.pos === 'phrase';
  if (!expression) return 'word';
  if (tags.includes('proverb')) return 'proverb';
  if (raw.pos === 'verb' && (tags.includes('phrasal-verb') || /English phrasal verbs/.test(categories))) return 'phrasal verb';
  if (tags.includes('idiomatic')) return 'idiom';
  if (tags.includes('collocation')) return 'collocation';
  return 'expression';
}

// Wiktionary usage examples authored on the site follow its text license. External
// quotations do not: retain only citation metadata, not the quoted text/media.
function examplesFor(sense) {
  const examples = [], citations = [];
  for (const item of objects(sense.examples)) {
    if (item.type === 'quotation' || item.ref || item.author || item.title || item.year) {
      citations.push({ reference: item.ref ?? null, author: item.author ?? null, title: item.title ?? null, year: item.year ?? null, url: item.url ?? null, omittedReason: 'external quotation rights not established' });
    } else if (typeof item.text === 'string' && (!item.type || ['example','ux'].includes(item.type))) {
      examples.push(item.text);
    }
  }
  return { examples, citations };
}

export function normalizeKaikki(raw) {
  if (!raw || raw.lang_code !== 'en') return null;
  if (!validTerm(raw.word) || typeof raw.pos !== 'string') throw new Error('invalid English headword or part of speech');
  const word = raw.word.trim();
  // No guessed remapping: a changed etymology creates a new identity and leaves
  // the old entry available as a tombstone for saved/history/audio references.
  const sourceKey = JSON.stringify([word, raw.pos, raw.etymology_number ?? null, hash(raw.etymology_text ?? ''), hash(raw.head_templates ?? []), hash(objects(raw.senses).map(sense => ({ glosses: sense.glosses ?? [], tags: sense.tags ?? [], qualifier: sense.qualifier ?? '', form_of: sense.form_of ?? [], alt_of: sense.alt_of ?? [] })))]);
  const id = hash([SOURCE_ID, sourceKey]);
  const senses = objects(raw.senses).map((sense, index) => {
    const glosses = strings(sense.glosses);
    const { examples, citations } = examplesFor(sense);
    return {
      id: `${id}:${index + 1}`, order: String(index + 1), definition: glosses.join(' '), glosses,
      examples, citations, usageNotes: [], grammar: sense.qualifier ?? null,
      labels: distinct([...strings(sense.tags), ...strings(sense.raw_tags), ...strings(sense.topics)]),
      formOf: objects(sense.form_of), altOf: objects(sense.alt_of),
      links: Array.isArray(sense.links) ? sense.links : [],
      sourceSenseIds: strings(sense.id),
      relations: Object.fromEntries(['synonyms','antonyms','related','derived','hypernyms','hyponyms','coordinate_terms','meronyms','holonyms'].filter(key => Array.isArray(sense[key])).map(key => [key, sense[key]])),
    };
  });
  if (!senses.length) throw new Error('English record has no senses');
  const formMap = new Map();
  for (const form of objects(raw.forms)) {
    if (!validTerm(form.form) || form.tags?.includes('table-tags')) continue;
    const prior = formMap.get(form.form);
    formMap.set(form.form, { form: form.form, lookup_key: normalizeKey(form.form), folded_key: normalizeKey(form.form).toLowerCase(), label: distinct([...(prior?.tags ?? []),...strings(form.tags)]).join(', ') || null, tags: distinct([...(prior?.tags ?? []),...strings(form.tags)]), phonetic: form.ipa ?? null, audio: null });
  }
  const sourceSounds = objects(raw.sounds).map(({ ipa, enpr, tags, raw_tags, note, form, sense, rhymes, homophones, hyphenation }) => ({ ipa, enpr, tags, raw_tags, note, form, sense, rhymes, homophones, hyphenation }));
  const pronunciations = sourceSounds.filter(sound => sound.ipa).map(sound => ({ ipa: sound.ipa, phonetic: sound.ipa, labels: distinct([...strings(sound.tags), ...strings(sound.raw_tags)]), ...sound }));
  const relations = Object.fromEntries(['synonyms','antonyms','related','derived','hypernyms','hyponyms','coordinate_terms','meronyms','holonyms','descendants','abbreviations','anagrams','proverbs'].filter(key => Array.isArray(raw[key])).map(key => [key, raw[key]]));
  const phrases = [...objects(raw.derived), ...objects(raw.proverbs), ...objects(raw.related)].filter(item => validTerm(item.word) && /\s/u.test(item.word)).map((item, index) => ({ id: `${id}:phrase:${index}`, phrase: item.word, type: item.tags?.join(', ') ?? null, labels: strings(item.tags), definition: null, relationSense: item.sense ?? null, examples: [], senses: [], sourceRelation: true }));
  const source = { id: SOURCE_ID, name: 'English Wiktionary', url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word.replaceAll(' ', '_'))}#English`, license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', attribution: 'English Wiktionary contributors via Kaikki/Wiktextract', modifications: 'English records selected and normalized; external quotations/media omitted pending separate rights verification' };
  const payload = {
    id, word, partOfSpeech: POS[raw.pos] ?? raw.pos, sourcePartOfSpeech: raw.pos,
    homograph: raw.etymology_number ?? null, kind: entryKind(raw), source,
    syllables: raw.hyphenations?.[0]?.parts ?? (typeof raw.hyphenation === 'string' ? raw.hyphenation.split('‧') : []),
    phonetic: pronunciations[0]?.ipa ?? null, audio: null, pronunciations, sourceSounds,
    forms: [...formMap.values()], labels: distinct([...strings(raw.tags), ...strings(raw.raw_tags)]),
    senses: [{ heading: null, senses }], shortDefinitions: senses.map(sense => sense.definition).filter(Boolean),
    phrases, relations, etymology: raw.etymology_text ?? null, firstKnownUse: null,
    isOffensive: senses.some(sense => sense.labels.some(label => ['offensive','vulgar','derogatory'].includes(label))),
    formOnly: senses.every(sense => sense.formOf.length || sense.altOf.length),
  };
  return { id, language: 'en', headword: word, part_of_speech: payload.partOfSpeech, kind: payload.kind, lookup_key: normalizeKey(word), folded_key: normalizeKey(word).toLowerCase(), source_key: sourceKey, payload, content_hash: hash(payload), forms: payload.forms };
}
