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
        return true;
    }

    catch {
        return false; // Callers with pending personal changes can show this limitation.
    }
};

export const storageKeys = () => {
    try {
        return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean);
    } catch {
        return [];
    }
};

export const removeStorage = key => {
    try {
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
};
