// localStorage can throw (private mode, blocked storage), so every access
// is guarded and falls back to the provided default.
export const readStorage = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    }

    catch {
        return fallback;
    }
};

export const writeStorage = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }

    catch {
        // Storage is a convenience; the app keeps working without it.
    }
};
