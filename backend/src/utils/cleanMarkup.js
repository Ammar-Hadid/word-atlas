// Merriam-Webster wraps cross-references in tokens like {sx|word||} or
// {et_link|word|id}. Keep the visible word and drop every other token.
const LINK_TOKENS = /\{(?:a_link|d_link|i_link|et_link|mat|sx|dxt|qword_link)\|([^|}]*)[^}]*\}/g;

const cleanMarkup = (text = "") => {
    if (typeof text !== "string") return "";

    return text
        // {bc} is a bold colon: it opens a definition and separates synonyms.
        .replace(/\{bc\}/g, "; ")
        .replace(LINK_TOKENS, "$1")
        .replace(/\{ldquo\}/g, "“")
        .replace(/\{rdquo\}/g, "”")
        .replace(/\{\/?[^}]+\}/g, "")
        .replace(/\[=[^\]]+\]/g, "")
        .replace(/\s+([,.;:])/g, "$1")
        .replace(/\s+/g, " ")
        .replace(/^[;\s]+/, "")
        .trim();
};

export default cleanMarkup;
