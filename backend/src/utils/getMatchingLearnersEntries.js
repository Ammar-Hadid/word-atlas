const cleanHeadword = (word = "") => {

    return word.replaceAll("*", "").toLowerCase();

};

export const getMatchingEntries = (entries, term) => {

    const normalizedTerm = term.toLowerCase();

    if (!Array.isArray(entries)) return [];

    return entries.filter((entry) => {

        if (typeof entry !== "object") return false;

        const headword = cleanHeadword(entry?.hwi?.hw ?? "");

        const stems = entry?.meta?.stems ?? [];

        return (

            headword === normalizedTerm ||

            stems.includes(normalizedTerm)

        );

    });

};