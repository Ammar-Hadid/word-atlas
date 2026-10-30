// Suggestions use the persistent local corpus and never prepare audio or history.
export const fetchSuggestions = async (query, { signal } = {}) => {
    const response = await fetch(`/api/suggestions?term=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) throw new Error("Could not load suggestions");
    const data = await response.json();
    return (data.suggestions ?? []).filter(word => typeof word === "string").slice(0, 6);
};
