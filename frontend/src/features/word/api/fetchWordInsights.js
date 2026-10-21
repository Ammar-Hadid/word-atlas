const DATAMUSE_URL = "https://api.datamuse.com";

const isSingleWord = (word) => /^[a-z][a-z'-]*$/i.test(word);

const query = async (params, signal) => {
    const response = await fetch(`${DATAMUSE_URL}/words?${new URLSearchParams(params)}`, { signal });

    if (!response.ok) return [];

    return response.json();
};

const toWords = (results, exclude) => {
    const seen = new Set(exclude);

    return results
        // Datamuse tags proper nouns ("prop"); they make poor neighbours.
        .filter(result => !result.tags?.includes("prop"))
        .map(result => result.word)
        .filter(word => {
            const key = word.toLowerCase();
            if (!isSingleWord(word) || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

// Datamuse reports frequency as occurrences per million words of text.
const parseFrequency = (tags = []) => {
    const tag = tags.find(item => item.startsWith("f:"));
    return tag ? Number(tag.slice(2)) : null;
};

// Everything here is an enhancement around the dictionary entry, so failed
// requests resolve to empty lists rather than errors.
export const fetchWordInsights = async (word, { signal } = {}) => {
    const term = word.toLowerCase();

    const settle = (promise) => promise.catch(error => {
        if (error.name === "AbortError") throw error;
        return [];
    });

    const [synonyms, antonyms, similar, associated, rhymes, [meta]] = await Promise.all([
        settle(query({ rel_syn: term, max: 30, md: "p" }, signal)),
        settle(query({ rel_ant: term, max: 16 }, signal)),
        settle(query({ ml: term, max: 40, md: "p" }, signal)),
        settle(query({ rel_trg: term, max: 30, md: "p" }, signal)),
        settle(query({ rel_rhy: term, max: 24 }, signal)),
        settle(query({ sp: term, md: "fs", max: 1 }, signal)),
    ]);

    const synonymWords = toWords(synonyms, [term]);
    const antonymWords = toWords(antonyms, [term]);
    const similarWords = toWords(similar, [term, ...synonymWords, ...antonymWords]);
    const associatedWords = toWords(associated, [term, ...synonymWords, ...similarWords]);

    const hasExactMeta = meta?.word?.toLowerCase() === term;

    return {
        synonyms: synonymWords,
        antonyms: antonymWords,
        similar: similarWords,
        associated: associatedWords,
        rhymes: toWords(rhymes, [term]).slice(0, 16),
        frequency: hasExactMeta ? parseFrequency(meta.tags) : null,
        syllableCount: hasExactMeta ? meta.numSyllables ?? null : null,
    };
};
