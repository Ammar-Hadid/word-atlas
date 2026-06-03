export const fetchSuggestions = async (query) => {
    const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(query)}&max=5`);

    if (!response.ok) {
        throw new Error('Could not load suggestions');
    }

    const results = await response.json();

    return results.map(i => i.word);
}
