import { useEffect, useState } from "react";

import { fetchWordData } from "../api/fetchWordData.js";

const initialState = {
    wordId: null,
    entries: null,
    quotes: [],
    error: null,
    suggestedWords: [],
};

export const useWordDetails = (wordId, { localOnly = false } = {}) => {
    const [state, setState] = useState(initialState);

    useEffect(() => {
        if (!wordId) return;

        let isCurrent = true;

        fetchWordData(wordId, { localOnly })
            .then(data => {
                if (!isCurrent) return;
                setState({ ...initialState, wordId, entries: data.word, quotes: data.quotes ?? [] });
            })
            .catch(error => {
                if (!isCurrent) return;
                setState({
                    ...initialState,
                    wordId,
                    error: { message: error.message || 'Something went wrong.', status: error.status ?? null, editorialUnavailable: error.editorialUnavailable ?? false },
                    suggestedWords: error.suggestions ?? [],
                });
            });

        return () => {
            isCurrent = false;
        };
    }, [wordId, localOnly]);

    const isLoading = Boolean(wordId) && state.wordId !== wordId;

    return {
        entries: isLoading ? null : state.entries,
        quotes: isLoading ? [] : state.quotes,
        error: isLoading ? null : state.error,
        suggestedWords: isLoading ? [] : state.suggestedWords,
        isLoading,
    };
};
