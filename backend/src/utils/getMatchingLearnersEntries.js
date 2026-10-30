// Preserve case first: "US" and "us" can denote different entries. Fold only
// when the provider has no exact-case headword, form, or phrase for the query.
export const normalizeMerriamTerm = (value = "") => typeof value === "string"
    ? value.normalize("NFKC").replaceAll("*", "").replace(/[‘’ʼ]/g, "'")
        .replace(/[‐‑–—]/g, "-").replace(/\s+/g, " ").trim()
    : "";

export const entryTerms = (entry) => [
    entry?.hwi?.hw,
    ...(entry?.meta?.stems ?? []),
    ...(entry?.ahws ?? []).map(item => item.hw),
    ...(entry?.ins ?? []).map(item => item.if),
    ...(entry?.vrs ?? []).map(item => item.va),
    ...(entry?.dros ?? []).flatMap(item => [item.drp, ...(item.vrs ?? []).map(variant => variant.va)]),
].filter(value => typeof value === "string").map(normalizeMerriamTerm);

export const getMatchingEntries = (entries, term) => {
    if (!Array.isArray(entries)) return [];
    const query = normalizeMerriamTerm(term);
    if (!query) return [];
    const candidates = entries.filter(entry => entry && typeof entry === "object" && !Array.isArray(entry));
    const exact = candidates.filter(entry => entryTerms(entry).includes(query));
    return exact.length ? exact : candidates.filter(entry =>
        entryTerms(entry).some(value => value.toLowerCase() === query.toLowerCase()));
};
