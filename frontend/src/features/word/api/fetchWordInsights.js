// Optional enrichment is budgeted and fetched by the backend. Typing suggestions
// uses the local corpus; the browser never calls an external insights provider.
export const fetchWordInsights = async (word, { signal } = {}) => {
    const response = await fetch(`/api/insights?term=${encodeURIComponent(word)}`, { signal });
    if (!response.ok) throw new Error('Additional word insights are unavailable.');
    return response.json();
};
