const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Emphasise the headword (and its inflections) wherever it appears in an
// example sentence or quote.
const highlightTerms = (text, terms = []) => {
    const cleanTerms = [...new Set(terms.filter(Boolean).map(term => term.toLowerCase()))]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp);

    if (!text || !cleanTerms.length) return text;

    const pattern = new RegExp(`\\b((?:${cleanTerms.join("|")})(?:s|es|ed|d|ing|er|ers|ly)?)\\b`, "gi");

    return text.split(pattern).map((part, index) =>
        index % 2 === 1
            ? <mark key={index} className="bg-transparent font-medium text-accent not-italic">{part}</mark>
            : part
    );
};

export default highlightTerms;
