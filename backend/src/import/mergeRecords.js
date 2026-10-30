import { hash } from './normalizeKaikki.js';

const union = (left = [], right = []) => [...new Map([...left, ...right].map(value => [JSON.stringify(value), value])).values()];
const relations = (left = {}, right = {}) => Object.fromEntries([...new Set([...Object.keys(left), ...Object.keys(right)])].map(key => [key, union(left[key], right[key])]));
const senseIdentity = payload => payload.senses.map(group => group.senses.map(({ definition, glosses, grammar, formOf, altOf }) => ({ definition, glosses, grammar, formOf, altOf })));

// The raw extraction can repeat the exact same lexical/sense block with
// different relationship or pronunciation metadata. Union those variants only;
// meaning/POS/etymology differences are distinct stable entries, never merged.
export function mergeRecords(left, right) {
  if (left.id !== right.id || left.source_key !== right.source_key || left.payload.word !== right.payload.word || left.payload.partOfSpeech !== right.payload.partOfSpeech || left.payload.etymology !== right.payload.etymology || JSON.stringify(senseIdentity(left.payload)) !== JSON.stringify(senseIdentity(right.payload))) throw new Error('Cannot merge different lexical meanings');
  if (left.content_hash === right.content_hash || left.payload.sourceVariantHashes?.includes(right.content_hash)) return left;
  const payload = { ...left.payload };
  for (const key of ['labels','pronunciations','sourceSounds','syllables']) payload[key] = union(left.payload[key], right.payload[key]);
  payload.relations = relations(left.payload.relations, right.payload.relations);
  const formMap = new Map();
  for (const form of [...left.forms,...right.forms]) {
    const previous = formMap.get(form.form);
    const tags = union(previous?.tags,form.tags);
    formMap.set(form.form,{...form,tags,label:tags.join(', ') || null});
  }
  payload.forms = [...formMap.values()];
  payload.phrases = union(left.payload.phrases.map(({id: _id,...phrase}) => {void _id; return phrase;}),right.payload.phrases.map(({id: _id,...phrase}) => {void _id; return phrase;})).map((phrase,index)=>({...phrase,id:`${left.id}:phrase:${index}`}));
  payload.senses = left.payload.senses.map((group,g) => ({ ...group, senses: group.senses.map((sense,s) => {
    const other = right.payload.senses[g].senses[s];
    const merged = { ...sense, relations: relations(sense.relations,other.relations) };
    for (const key of ['examples','citations','labels','usageNotes','links','sourceSenseIds']) merged[key] = union(sense[key],other[key]);
    return merged;
  }) }));
  payload.sourceVariantHashes = union(left.payload.sourceVariantHashes ?? [left.content_hash],right.payload.sourceVariantHashes ?? [right.content_hash]).sort();
  payload.isOffensive = left.payload.isOffensive || right.payload.isOffensive;
  return { ...left, payload, forms: payload.forms, content_hash: hash(payload) };
}
