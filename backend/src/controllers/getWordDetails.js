import fetchWord from "../services/merriamService.js";
import normalizeLearnersResponse from "../utils/normalizeLearnersResponse.js";

export const getWordDetails = async (req, res) => {
    const term = req.query.term?.trim();

    if (!term) {
        return res.status(400).json({ error: 'Term is required.' })
    }

    try {
        const word = await fetchWord(term);

        const normalizedWord = normalizeLearnersResponse(word);

        return res.status(200).json({ word: normalizedWord });
    }

    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error.' })
    }
}