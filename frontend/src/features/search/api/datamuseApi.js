export const fetchSuggestions = async (query) => {
    const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(query)}&max=20`);

    if (!response.ok) {
        throw new Error('Could not load suggestions');
    }

    const data = await response.json();

    return data
        .map(i => i.word)
        .filter(word => !word.includes(" "))
        .slice(0, 5);
};
