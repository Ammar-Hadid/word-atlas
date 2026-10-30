export const hasSenses = (entry) =>
    entry?.senses?.some(group => group?.senses?.some(sense => sense?.definition));

export const getFirstDefinition = (entry) =>
    entry?.senses?.flatMap(group => group.senses).find(sense => sense.definition)?.definition
    ?? entry?.shortDefinitions?.[0]
    ?? null;

// Entries whose headword is the searched word become tabs; the rest
// (e.g. "ran" when searching "run") are listed as related entries.
export const splitEntries = (entries = [], term = "") => {
    const defined = entries.filter(hasSenses);
    const usable = defined.length ? defined : entries.filter(entry => entry?.word);
    const caseExact = usable.filter(entry => entry.word === term);
    const exact = caseExact.length ? caseExact : usable.filter(entry => entry.word.toLowerCase() === term.toLowerCase());
    const formMatches = usable.filter(entry => entry.requestedForm);
    const primary = exact.length ? exact : formMatches.length ? formMatches : usable.slice(0, 1);

    return {
        primary,
        related: usable.filter(entry => !primary.includes(entry)),
    };
};

export const getHighlightTerms = (entry) => [
    entry?.word,
    ...(entry?.forms ?? []).map(form => form.form),
];
