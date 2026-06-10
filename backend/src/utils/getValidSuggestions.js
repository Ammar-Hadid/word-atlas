import fetchWord from "../services/merriamService.js";
import { getMatchingEntries } from "./getMatchingLearnersEntries.js";

const getValidSuggestions = async (suggestions) => {
    if (!Array.isArray(suggestions)) return []

    const stringifiedSuggestions = suggestions.filter(suggestion => typeof suggestion === 'string')

    const validSuggestions = await Promise.all(
        stringifiedSuggestions.map(async suggestion => {

            try {
                const word = await fetchWord(suggestion);

                const matchingSuggestions = getMatchingEntries(word, suggestion);

                if (!matchingSuggestions.length) {
                    return null
                }

                return suggestion
            }

            catch (error) {
                console.error('Failed to load suggestion')
                return null
            }
        })
    )

    return validSuggestions.filter(Boolean);
}

export default getValidSuggestions;