import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKaikki } from '../src/import/normalizeKaikki.js';
import { resolveFormEntry } from '../src/repositories/entries.js';
const entry = (word, lemma, pos = 'noun', etymology_text = '') => normalizeKaikki({ word,lang_code:'en',pos,etymology_text,senses:[{glosses:[lemma ? `Plural of ${lemma}.` : 'A synthetic test definition.'],...(lemma ? {form_of:[{word:lemma}],tags:['form-of','plural']} : {})}] }).payload;
test('source form resolves and retains its gloss alongside useful lemma meanings', async () => {
  const base = entry('widget');
  const result = await resolveFormEntry(entry('widgets','widget'), { findExact: async () => [base] });
  assert.equal(result.formResolution.status,'resolved');
  assert.equal(result.senses.length,2);
  assert.equal(result.senses[0].senses[0].definition,'Plural of widget.');
});
test('homographs are explicit ambiguity instead of guessed meaning', async () => {
  const result = await resolveFormEntry(entry('widgets','widget'), { findExact: async () => [entry('widget',null,'noun','root one'),entry('widget',null,'noun','root two')] });
  assert.equal(result.formResolution.status,'ambiguous');
  assert.equal(result.senses.length,1);
});
test('cycle does not recurse forever or attach a false base meaning', async () => {
  const a=entry('a','b'), b=entry('b','a');
  const result = await resolveFormEntry(a,{ findExact: async word => word==='a' ? [a] : [b] });
  assert.equal(result.formResolution.status,'cycle_or_depth_limit');
  assert.equal(result.senses.length,1);
});
