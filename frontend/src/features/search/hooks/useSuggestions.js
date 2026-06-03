import { useState, useEffect } from "react";
import { fetchSuggestions } from "../api/datamuseApi.js";

export const useSuggestions = (query) => {
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const cleanedQuery = query.trim();

    useEffect(() => {

        if (!cleanedQuery) {
            return
        }

        const timerId = setTimeout(async () => {
            try {
                setIsLoading(true);
                setError(null);

                const results = await fetchSuggestions(cleanedQuery);

                setSuggestions(results);
            }

            catch (error) {
                setSuggestions([]);
                setError(error.message || 'Something went wrong.');
            }

            finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timerId);
    }, [cleanedQuery]);

    return {
        suggestions: cleanedQuery ? suggestions : [],
        isLoading: cleanedQuery ? isLoading : false,
        error: cleanedQuery ? error : null
    }
}
