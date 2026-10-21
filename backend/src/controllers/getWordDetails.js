import fetchWord, { fetchCollegiateWord } from "../services/merriamService.js";
import normalizeLearnersResponse from "../utils/normalizeLearnersResponse.js";
import normalizeCollegiateResponse from "../utils/normalizeCollegiateResponse.js";
import { getMatchingEntries } from "../utils/getMatchingLearnersEntries.js";
import getValidSuggestions from "../utils/getValidSuggestions.js";

// The Collegiate Dictionary is an enhancement, so a failure there should
// never block the main Learner's response.
const fetchOrigins = async (term) => {
    try {
        const entries = await fetchCollegiateWord(term);
        return normalizeCollegiateResponse(entries, term);
    }

    catch (error) {
        console.error(error.message);
        return { origins: [], quotes: [] };
    }
};

export const getWordDetails = async (req, res) => {
    const term = req.query.term?.trim();

    if (!term) {
        return res.status(400).json({ error: 'Term is required.' })
    }

    try {
        const [word, { origins, quotes }] = await Promise.all([
            fetchWord(term),
            fetchOrigins(term),
        ]);

        const matchingEntries = getMatchingEntries(word, term);

        if (!matchingEntries.length) {
            const suggestions = await getValidSuggestions(word)
            return res.status(404).json({
                error: 'Word not found.',
                suggestions,
            })
        }

        const normalizedWord = normalizeLearnersResponse(matchingEntries).map((entry) => {
            const origin = origins.find((item) => item.partOfSpeech === entry.partOfSpeech)
                ?? (entry.word.toLowerCase() === term.toLowerCase() ? origins[0] : null);

            return {
                ...entry,
                etymology: origin?.etymology ?? null,
                firstKnownUse: origin?.firstKnownUse ?? null,
            };
        });

        res.set('Cache-Control', 'public, max-age=3600');

        return res.status(200).json({ word: normalizedWord, quotes });
    }

    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error.' })
    }
}
