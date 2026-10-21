import { useEffect, useState } from "react";
import { fetchSuggestions } from "../api/datamuseApi.js";

export const useSuggestions = (query, { delay = 180 } = {}) => {
    const [state, setState] = useState({ query: "", suggestions: [], error: null });

    const cleanedQuery = query.trim();

    useEffect(() => {
        if (!cleanedQuery) return;

        const controller = new AbortController();

        const timerId = setTimeout(async () => {
            try {
                const results = await fetchSuggestions(cleanedQuery, { signal: controller.signal });
                setState({ query: cleanedQuery, suggestions: results, error: null });
            }

            catch (error) {
                if (error.name === "AbortError") return;
                setState({ query: cleanedQuery, suggestions: [], error: error.message || 'Something went wrong.' });
            }
        }, delay);

        return () => {
            clearTimeout(timerId);
            controller.abort();
        };
    }, [cleanedQuery, delay]);

    const isFresh = cleanedQuery && state.query === cleanedQuery;

    return {
        suggestions: cleanedQuery ? state.suggestions : [],
        isLoading: Boolean(cleanedQuery) && !isFresh,
        error: isFresh ? state.error : null,
    };
}
