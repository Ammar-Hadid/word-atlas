import { suggestions as localSuggestions } from '../repositories/entries.js';
import { freeAccessVerified } from './datamuseService.js';

const LIMIT = 8;

// Datamuse ranks completions by how common they are and tolerates typos, which an
// alphabetical walk over ~1M Wiktionary headwords cannot do.
async function popularSuggestions(term) {
    if (!freeAccessVerified()) return [];
    try {
        const response = await fetch(`https://api.datamuse.com/sug?${new URLSearchParams({ s: term, max: '10' })}`,
            { signal: AbortSignal.timeout(1200) });
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data.map(item => item?.word).filter(word => typeof word === 'string') : [];
    } catch {
        return [];
    }
}

// The local list is alphabetical and full of proper nouns and abbreviations,
// so it only fills gaps, with plain lowercase words and phrases.
const isPlainHeadword = word => /^\p{Ll}[\p{Ll}' -]*$/u.test(word);

export async function rankedSuggestions(term) {
    const [popular, local] = await Promise.all([popularSuggestions(term), localSuggestions(term, { limit: 20 })]);
    const seen = new Set();
    const result = [];
    for (const word of [...popular, ...local.filter(isPlainHeadword)]) {
        const key = word.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(word);
    }
    return result.slice(0, LIMIT);
}
