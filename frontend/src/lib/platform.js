export const isMac = typeof navigator !== "undefined"
    && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const modKey = isMac ? "⌘" : "Ctrl";

// Ignore single-key shortcuts while the user is typing.
export const isTypingTarget = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
};

export const wordPath = (word) => `/word/${encodeURIComponent(word.trim().toLowerCase())}`;
