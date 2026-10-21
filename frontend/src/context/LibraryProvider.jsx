import { useCallback, useEffect, useMemo, useState } from "react";

import { LibraryContext } from "./contexts.js";
import { readStorage, writeStorage } from "../lib/storage.js";

const SAVED_KEY = "wa:saved";
const HISTORY_KEY = "wa:history";
const HISTORY_LIMIT = 50;

const normalize = (word = "") => word.trim().toLowerCase();

const LibraryProvider = ({ children }) => {
    const [saved, setSaved] = useState(() => readStorage(SAVED_KEY, []));
    const [history, setHistory] = useState(() => readStorage(HISTORY_KEY, []));

    useEffect(() => writeStorage(SAVED_KEY, saved), [saved]);
    useEffect(() => writeStorage(HISTORY_KEY, history), [history]);

    const isSaved = useCallback(
        (word) => saved.some(item => normalize(item.word) === normalize(word)),
        [saved]
    );

    // Returns the new saved state so callers can show the right feedback.
    const toggleSaved = useCallback((entry) => {
        const exists = saved.some(item => normalize(item.word) === normalize(entry.word));

        setSaved(current => exists
            ? current.filter(item => normalize(item.word) !== normalize(entry.word))
            : [{ ...entry, savedAt: Date.now() }, ...current]
        );

        return !exists;
    }, [saved]);

    const removeSaved = useCallback((word) => {
        setSaved(current => current.filter(item => normalize(item.word) !== normalize(word)));
    }, []);

    const recordVisit = useCallback((entry) => {
        setHistory(current => [
            { ...entry, visitedAt: Date.now() },
            ...current.filter(item => normalize(item.word) !== normalize(entry.word)),
        ].slice(0, HISTORY_LIMIT));
    }, []);

    const clearHistory = useCallback(() => setHistory([]), []);

    const value = useMemo(() => ({
        saved, history, isSaved, toggleSaved, removeSaved, recordVisit, clearHistory,
    }), [saved, history, isSaved, toggleSaved, removeSaved, recordVisit, clearHistory]);

    return (
        <LibraryContext.Provider value={value}>
            {children}
        </LibraryContext.Provider>
    );
};

export default LibraryProvider;
