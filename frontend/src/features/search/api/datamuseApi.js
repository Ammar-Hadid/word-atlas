const DATAMUSE_URL = "https://api.datamuse.com";

const isSingleWord = (word) => /^[a-z][a-z'-]*$/i.test(word);

export const fetchSuggestions = async (query, { signal } = {}) => {
    const response = await fetch(`${DATAMUSE_URL}/sug?s=${encodeURIComponent(query)}&max=20`, { signal });

    if (!response.ok) {
        throw new Error('Could not load suggestions');
    }

    const data = await response.json();

    return data
        .map(i => i.word)
        .filter(isSingleWord)
        .slice(0, 6);
};
