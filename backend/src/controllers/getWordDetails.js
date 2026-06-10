import fetchWord from "../services/merriamService.js";
import normalizeLearnersResponse from "../utils/normalizeLearnersResponse.js";
import { getMatchingEntries } from "../utils/getMatchingLearnersEntries.js";
import getValidSuggestions from "../utils/getValidSuggestions.js";

export const getWordDetails = async (req, res) => {
    const term = req.query.term?.trim();

    if (!term) {
        return res.status(400).json({ error: 'Term is required.' })
    }

    try {
        const word = await fetchWord(term);

        const matchingEntries = getMatchingEntries(word, term);

        if (!matchingEntries.length) {
            const suggestions = await getValidSuggestions(word)
            return res.status(404).json({
                error: 'Word not found.',
                suggestions,
            })
        }

        const normalizedWord = normalizeLearnersResponse(matchingEntries);

        return res.status(200).json({ word: normalizedWord });
    }

    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error.' })
    }
}