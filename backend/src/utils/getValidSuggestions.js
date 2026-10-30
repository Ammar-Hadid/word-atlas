// Provider suggestions are suggestions, never verified entries. Validating each
// suggestion used to issue another billable/quota-limited lookup per candidate.
const getValidSuggestions = async (suggestions) => Array.isArray(suggestions)
    ? [...new Set(suggestions.filter(value => typeof value === "string" && value.trim() && value.length <= 160))].slice(0, 8)
    : [];

export default getValidSuggestions;
