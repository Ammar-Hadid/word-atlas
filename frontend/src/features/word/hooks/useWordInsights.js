import { useEffect, useState } from "react";

import { fetchWordInsights } from "../api/fetchWordInsights.js";

const EMPTY = {
    synonyms: [],
    antonyms: [],
    similar: [],
    associated: [],
    rhymes: [],
    frequency: null,
    syllableCount: null,
};

export const useWordInsights = (word) => {
    const [state, setState] = useState({ word: null, insights: EMPTY });

    useEffect(() => {
        if (!word) return;

        const controller = new AbortController();

        fetchWordInsights(word, { signal: controller.signal })
            .then(insights => setState({ word, insights }))
            .catch(error => {
                if (error.name !== "AbortError") setState({ word, insights: EMPTY });
            });

        return () => controller.abort();
    }, [word]);

    const isLoading = Boolean(word) && state.word !== word;

    return {
        insights: isLoading ? EMPTY : state.insights,
        isLoading,
    };
};
