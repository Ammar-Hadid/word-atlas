import fetchWord, { fetchCollegiateWord } from "./merriamService.js";
import normalizeLearnersResponse from "../utils/normalizeLearnersResponse.js";
import normalizeCollegiateResponse from "../utils/normalizeCollegiateResponse.js";
import { getMatchingEntries } from "../utils/getMatchingLearnersEntries.js";
import { selectRequestedPhrases } from "../utils/normalizeMerriamEntry.js";
import getValidSuggestions from "../utils/getValidSuggestions.js";

const usable = entry => entry.senses.some(group => group.senses.some(sense => sense.definition));

async function request(provider, term, deadlineMs) {
    let timeout;
    try {
        const result = await Promise.race([
            Promise.resolve().then(() => provider(term)),
            new Promise((_, reject) => { timeout = setTimeout(() => reject(Object.assign(new Error("Editorial deadline"), { code: "timeout" })), deadlineMs); }),
        ]);
        return { data: Array.isArray(result) ? result : [], status: "available" };
    } catch (error) {
        const code = error?.code;
        return { data: [], status: code === "timeout" || error?.name === "TimeoutError" ? "timeout"
            : ["quota_exhausted", "allowance_exhausted"].includes(code) ? "allowance_exhausted" : "unavailable" };
    } finally {
        clearTimeout(timeout);
    }
}

/** User-requested live editorial content only; callers must not persist it. */
export async function getEditorial(term, { fetchLearners = fetchWord, fetchCollegiate = fetchCollegiateWord, deadlineMs = 1800 } = {}) {
    const [learnersResult, collegiateResult] = await Promise.all([
        request(fetchLearners, term, deadlineMs), request(fetchCollegiate, term, deadlineMs),
    ]);
    const learners = selectRequestedPhrases(normalizeLearnersResponse(getMatchingEntries(learnersResult.data, term)), term).filter(usable);
    const collegiate = normalizeCollegiateResponse(collegiateResult.data, term).word.filter(usable);
    const availability = {
        learners: learnersResult.status === "available" && !learners.length ? "not_found" : learnersResult.status,
        collegiate: collegiateResult.status === "available" && !collegiate.length ? "not_found" : collegiateResult.status,
    };
    const word = learners.length ? learners.map(entry => {
        // Homograph numbering and POS are not a cross-dictionary identity.
        // Only MW's explicit target UUID establishes a safe origin/quote link.
        const related = entry.target?.tsrc === "collegiate" && entry.target?.tuuid
            ? collegiate.find(candidate => candidate.source.uuid === entry.target.tuuid) : null;
        return related ? { ...entry, etymology: related.etymology, firstKnownUse: related.firstKnownUse,
            originSource: related.source, quotes: related.quotes } : entry;
    }) : collegiate;
    return { word, quotes: word.flatMap(entry => entry.quotes), availability,
        suggestions: await getValidSuggestions([...learnersResult.data, ...collegiateResult.data]) };
}
