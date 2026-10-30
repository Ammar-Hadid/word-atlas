import { useCallback, useState } from "react";

import { readStorage, writeStorage } from "../../../lib/storage.js";

const STORAGE_KEY = "wa:accent";

// US English by default; a switch to British English is remembered on this device.
export const useAccent = () => {
    const [accent, setAccentState] = useState(() => readStorage(STORAGE_KEY, "us") === "uk" ? "uk" : "us");

    const setAccent = useCallback(next => {
        setAccentState(next);
        writeStorage(STORAGE_KEY, next);
    }, []);

    return [accent, setAccent];
};
