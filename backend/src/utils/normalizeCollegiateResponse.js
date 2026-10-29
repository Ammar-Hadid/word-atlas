import { getMatchingEntries } from "./getMatchingLearnersEntries.js";
import { normalizeMerriamEntry, selectRequestedPhrases } from "./normalizeMerriamEntry.js";

const normalizeCollegiateResponse = (entries, term) => {
    const matched = term === undefined ? entries : getMatchingEntries(entries, term);
    const word = selectRequestedPhrases((Array.isArray(matched) ? matched : [])
        .filter(entry => entry?.hwi?.hw).map(entry => normalizeMerriamEntry(entry, "collegiate")), term ?? "");
    return { word,
        origins: word.map(entry => ({ id: entry.id, word: entry.word, source: entry.source,
            partOfSpeech: entry.partOfSpeech, homograph: entry.homograph,
            etymology: entry.etymology, firstKnownUse: entry.firstKnownUse })),
        quotes: word.flatMap(entry => entry.quotes),
    };
};

export default normalizeCollegiateResponse;
