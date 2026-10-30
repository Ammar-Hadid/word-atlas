import { query as databaseQuery, queryWithTimeout } from '../db/index.js';
import { normalizeKey, validTerm, SOURCE_ID } from '../import/normalizeKaikki.js';
export { normalizeKey } from '../import/normalizeKaikki.js';

const activeRelease = async query => (await query('SELECT active_release_id FROM sources WHERE id=$1', [SOURCE_ID])).rows[0]?.active_release_id;
const decode = (row, releaseId) => ({ ...row.payload, source: { ...row.payload.source, releaseId }, matchType: 'exact' });

async function exact(term, releaseId, query) {
  return (await query(`SELECT s.payload FROM entries e JOIN source_entries s ON s.entry_id=e.id AND s.release_id=$1
    WHERE e.lookup_key=$2 ORDER BY e.headword,e.part_of_speech,e.id`, [releaseId, normalizeKey(term)])).rows.map(row => decode(row, releaseId));
}

export async function getEntry(id, { query = databaseQuery, releaseId } = {}) {
  releaseId ??= await activeRelease(query);
  if (!releaseId) return null;
  const { rows } = await query('SELECT payload FROM source_entries WHERE release_id=$1 AND entry_id=$2', [releaseId, id]);
  return rows[0] ? decode(rows[0], releaseId) : null;
}

// Resolve only source-supplied links, never stems. A homograph disagreement is
// an explicit choice. A cycle or missing lemma leaves the original form gloss.
export async function resolveFormEntry(entry, { findExact, seen = new Set(), depth = 0 } = {}) {
  if (!entry.formOnly) return entry;
  if (seen.has(entry.id) || depth >= 4) return { ...entry, formResolution: { status: 'cycle_or_depth_limit', candidates: [] } };
  const visited = new Set(seen).add(entry.id);
  const targets = [...new Set(entry.senses.flatMap(group => group.senses).flatMap(sense => [...(sense.formOf ?? []), ...(sense.altOf ?? [])]).map(target => target.word).filter(validTerm))];
  if (targets.length !== 1) return { ...entry, formResolution: { status: 'ambiguous', candidates: targets } };
  const candidates = (await findExact(targets[0])).filter(candidate => candidate.partOfSpeech === entry.partOfSpeech);
  if (candidates.length !== 1) return { ...entry, formResolution: { status: candidates.length ? 'ambiguous' : 'unresolved', candidates: candidates.map(candidate => ({ id: candidate.id, word: candidate.word, partOfSpeech: candidate.partOfSpeech, homograph: candidate.homograph })) } };
  const lemma = await resolveFormEntry(candidates[0], { findExact, seen: visited, depth: depth + 1 });
  if (lemma.formResolution && lemma.formResolution.status !== 'resolved') return { ...entry, formResolution: lemma.formResolution };
  return {
    ...entry,
    senses: [...entry.senses, ...lemma.senses.map(group => ({ ...group, heading: { heading: `From ${lemma.word}` } }))],
    lemmaEntries: [{ id: lemma.id, word: lemma.word, partOfSpeech: lemma.partOfSpeech }],
    formResolution: { status: 'resolved', candidates: [{ id: lemma.id, word: lemma.word }] },
  };
}

export async function suggestions(term, { limit = 10, fuzzy = false, query = databaseQuery,
  fuzzyQuery = query === databaseQuery ? queryWithTimeout : query, releaseId } = {}) {
  if (!validTerm(term)) return [];
  releaseId ??= await activeRelease(query);
  if (!releaseId) return [];
  const key = normalizeKey(term).toLowerCase();
  limit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const prefix = key.replace(/[\\%_]/g, '\\$&') + '%';
  const { rows } = await query(`SELECT headword FROM (
      (SELECT near.headword FROM (SELECT e.id,e.headword,e.folded_key FROM entries e
        WHERE e.folded_key COLLATE "C" LIKE $2 ORDER BY e.folded_key COLLATE "C",e.headword LIMIT 200) near
        JOIN source_entries s ON s.release_id=$1 AND s.entry_id=near.id
        GROUP BY near.headword ORDER BY near.headword LIMIT $3)
      UNION
      (SELECT near.form AS headword FROM (SELECT f.form FROM forms f WHERE f.release_id=$1 AND f.folded_key COLLATE "C" LIKE $2
        ORDER BY f.folded_key COLLATE "C",f.form LIMIT 200) near
        GROUP BY near.form ORDER BY near.form LIMIT $3)
    ) choices ORDER BY length(headword),headword LIMIT $3`, [releaseId, prefix, limit]);
  const result = rows.map(row => row.headword);
  if (result.length || !fuzzy || key.length < 3) return result;
  // LIMIT bounds returned candidates, not GiST's traversal work. A separate
  // 200ms database timeout bounds fuzzy work even under full-corpus contention.
  try {
    const nearest = await fuzzyQuery(`SELECT DISTINCT near.headword,near.distance FROM
      (SELECT id,headword,folded_key <-> $2 AS distance FROM entries ORDER BY folded_key <-> $2 LIMIT 40) near
      JOIN source_entries s ON s.entry_id=near.id AND s.release_id=$1
      WHERE near.distance < 0.75 ORDER BY near.distance,near.headword LIMIT $3`, [releaseId, key, limit]);
    return nearest.rows.map(row => row.headword);
  } catch (error) {
    if (error.code === '57014') return []; // Optional suggestions timed out; keep the lookup usable.
    throw error;
  }
}

export async function lookupTerm(term, { query = databaseQuery, releaseId } = {}) {
  if (!validTerm(term)) { const error = new Error('Use a term of 1–200 characters without control characters.'); error.status = 400; throw error; }
  releaseId ??= await activeRelease(query);
  if (!releaseId) return { word: [], quotes: [], matchType: 'not_found', suggestions: [], releaseId: null, unavailable: true, ambiguities: [] };
  let word = await exact(term, releaseId, query);
  let matchType = 'exact';
  if (!word.length) {
    const result = await query(`SELECT s.payload,f.form,f.labels FROM forms f JOIN source_entries s
      ON s.entry_id=f.entry_id AND s.release_id=f.release_id WHERE f.release_id=$1 AND f.lookup_key=$2
      ORDER BY f.entry_id`, [releaseId, normalizeKey(term)]);
    word = result.rows.map(row => ({ ...decode(row, releaseId), matchType: 'form', requestedForm: { form: row.form, labels: row.labels } }));
    matchType = word.length ? 'form' : 'not_found';
  }
  const resolved = [];
  for (const entry of word) resolved.push(await resolveFormEntry(entry, { findExact: target => exact(target, releaseId, query) }));
  return {
    word: resolved, quotes: [], matchType, releaseId,
    suggestions: word.length ? [] : await suggestions(term, { query, releaseId, fuzzy: true }),
    ambiguities: [
      ...(matchType === 'form' && resolved.length > 1 ? [{ term, kind: 'form_alias', candidates: resolved.map(entry => ({ id: entry.id, word: entry.word, partOfSpeech: entry.partOfSpeech, homograph: entry.homograph })) }] : []),
      ...resolved.filter(entry => entry.formResolution?.status === 'ambiguous').map(entry => ({ entryId: entry.id, ...entry.formResolution })),
    ],
  };
}
