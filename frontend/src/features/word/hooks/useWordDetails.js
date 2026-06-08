import { useState, useEffect } from "react";

import { normalizeWord } from "../utils/normalizeWord.js";
import { fetchWordData } from "../api/freeDictionaryApi.js";

export const useWordDetails = (wordId) => {
    const [word, setWord] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);


    useEffect(() => {
        if (!wordId) return;

        const loadWordData = async () => {
            try {
                setWord(null);
                setIsLoading(true);
                setError(null);

                const wordData = await fetchWordData(wordId);

                const normalizedWord = normalizeWord(wordData);

                setWord(normalizedWord);
            }

            catch (error) {
                setWord(null);
                setError(error.message || 'Something went wrong.');
                console.error(error);
            }

            finally {
                setIsLoading(false);
            }
        }

        loadWordData();

    }, [wordId]);

    return {
        word,
        isLoading,
        error
    }

}