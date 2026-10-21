import cleanMarkup from "./cleanMarkup.js";
import { getMatchingEntries } from "./getMatchingLearnersEntries.js";

const normalizeEtymology = (et = []) => {
    const text = et
        .filter(([type]) => type === "text")
        .map(([, content]) => cleanMarkup(content))
        .join(" ");

    return text || null;
};

const normalizeQuote = (quote = {}) => {
    const text = cleanMarkup(quote?.t ?? "");

    if (!text) return null;

    return {
        text,
        author: cleanMarkup(quote?.aq?.auth ?? "") || null,
        source: cleanMarkup(quote?.aq?.source ?? "") || null,
        date: cleanMarkup(quote?.aq?.aqdate ?? "") || null,
    };
};

// Collegiate entries carry the history of a word (etymology, first known use
// and published quotes) that the Learner's Dictionary leaves out.
const normalizeCollegiateResponse = (entries, term) => {
    const matchingEntries = getMatchingEntries(entries, term).filter(
        (entry) => entry?.hwi?.hw?.replaceAll("*", "").toLowerCase() === term.toLowerCase()
    );

    const origins = matchingEntries.map((entry) => ({
        partOfSpeech: entry?.fl ?? null,
        etymology: normalizeEtymology(entry?.et ?? []),
        firstKnownUse: cleanMarkup(entry?.date ?? "") || null,
    }));

    const quotes = matchingEntries
        .flatMap((entry) => entry?.quotes ?? [])
        .map(normalizeQuote)
        .filter(Boolean)
        .slice(0, 4);

    return { origins, quotes };
};

export default normalizeCollegiateResponse;
