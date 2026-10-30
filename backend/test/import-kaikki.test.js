import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKaikki, normalizeKey } from '../src/import/normalizeKaikki.js';

const fixture = {
  word: 'turn over', lang_code: 'en', pos: 'verb', etymology_number: 1,
  etymology_text: 'From turn and over.',
  senses: [{ glosses: ['To reverse orientation.'], tags: ['phrasal-verb'], examples: [{ text: 'Turn over the card.', type: 'example' }, { text: 'A separately copyrighted quotation.', type: 'quotation', ref: 'Synthetic Book (2020)' }] }],
  sounds: [{ ipa: '/tɜːn ˈoʊvɚ/', tags: ['US'], sense: 'reverse orientation' }],
  forms: [{ form: 'turned over', tags: ['past'] }],
};
test('filters edition languages, preserves senses/forms/IPA, excludes unlicensed quotations', () => {
  assert.equal(normalizeKaikki({ ...fixture, lang_code: 'fr' }), null);
  const entry = normalizeKaikki(fixture);
  assert.equal(entry.kind, 'phrasal verb');
  assert.equal(entry.payload.senses[0].senses[0].definition, 'To reverse orientation.');
  assert.deepEqual(entry.payload.senses[0].senses[0].examples, ['Turn over the card.']);
  assert.equal(entry.payload.senses[0].senses[0].citations.length, 1);
  assert.equal(JSON.stringify(entry).includes('A separately copyrighted quotation.'), false);
  assert.equal(entry.forms[0].form, 'turned over');
  assert.equal(entry.payload.sourceSounds[0].sense, 'reverse orientation');
  assert.equal(entry.payload.source.license, 'CC BY-SA 4.0');
});
test('source signatures retain example changes and distinguish changed meanings before reconciliation', () => {
  assert.equal(normalizeKaikki(fixture).id, normalizeKaikki({ ...fixture, senses: fixture.senses.map(sense => ({...sense,examples:[{text:'Another source-authored example.'}]})) }).id);
  assert.notEqual(normalizeKaikki(fixture).id, normalizeKaikki({ ...fixture, etymology_text: 'A different root.' }).id);
});
test('preserves every gloss and sense without truncation', () => {
  const record = normalizeKaikki({ ...fixture, senses: [{ glosses: ['Context.', 'Specific sense.'], tags: ['rare'] }, { glosses: ['Another sense.'] }] });
  assert.equal(record.payload.senses[0].senses.length, 2);
  assert.equal(record.payload.senses[0].senses[0].definition, 'Context. Specific sense.');
});
test('normalization retains case distinctions, apostrophes and hyphens', () => {
  assert.equal(normalizeKey('  one’s   self‑esteem '), "one's self-esteem");
  assert.notEqual(normalizeKey('US'), normalizeKey('us'));
});
test('invalid/no-sense English entries fail visibly', () => {
  assert.throws(() => normalizeKaikki({ word: 'bad', lang_code: 'en', pos: 'noun', senses: [] }), /no senses/);
  assert.throws(() => normalizeKaikki({ word: 'bad\0', lang_code: 'en', pos: 'noun', senses: fixture.senses }), /headword/);
});

test('same word/POS/etymology source blocks retain separate meanings', () => {
  const first=normalizeKaikki({word:'wares',lang_code:'en',pos:'noun',senses:[{glosses:['Synthetic plural record.'],form_of:[{word:'ware'}]}]});
  const second=normalizeKaikki({word:'wares',lang_code:'en',pos:'noun',senses:[{glosses:['Synthetic independent meaning.']}]});
  assert.notEqual(first.id,second.id);
});
test('derived relationship context is not mislabelled as a child definition', () => {
  const record=normalizeKaikki({...fixture,derived:[{word:'turn over a new leaf',sense:'The parent sense grouping.'}]});
  assert.equal(record.payload.phrases[0].definition,null);
  assert.equal(record.payload.phrases[0].relationSense,'The parent sense grouping.');
});

test('raw duplicate lexical blocks union metadata and remain idempotent', async () => {
  const { mergeRecords } = await import('../src/import/mergeRecords.js');
  const a=normalizeKaikki({...fixture,derived:[{word:'related one'}]});
  const b=normalizeKaikki({...fixture,derived:[{word:'related two'}]});
  const merged=mergeRecords(a,b);
  assert.equal(merged.payload.relations.derived.length,2);
  assert.equal(merged.payload.sourceVariantHashes.length,2);
  assert.deepEqual(mergeRecords(merged,a),merged);
  assert.throws(()=>mergeRecords(a,normalizeKaikki({...fixture,senses:[{glosses:['Different meaning.']}]})),/different lexical/);
});

test('expression classification does not promote single-word idiomatic senses or particles', () => {
  const sense={glosses:['Synthetic sense.'],tags:['idiomatic']};
  const word=normalizeKaikki({word:'about',lang_code:'en',pos:'prep',categories:['English phrasal verbs formed with about'],senses:[sense]});
  assert.equal(word.kind,'word');
  assert.ok(word.payload.senses[0].senses[0].labels.includes('idiomatic'));
  const noun=normalizeKaikki({word:'carry on',lang_code:'en',pos:'noun',categories:['English phrasal verbs formed with on'],senses:[{glosses:['Synthetic nominal sense.']}]});
  assert.equal(noun.kind,'expression');
});
