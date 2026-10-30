const API_URL = "/api"

export const fetchWordData = async (word, { localOnly = false } = {}) => {
    const trimmedWord = word?.trim();

    if (!trimmedWord) {
        throw new Error("Term is required.");
    }

    const normalizedWord = encodeURIComponent(trimmedWord);

    let response;

    try {
        response = await fetch(`${API_URL}/words?term=${normalizedWord}${localOnly ? "&localOnly=1" : ""}`);
    }

    catch {
        const error = new Error("We couldn't reach the dictionary. Check your connection and try again.");
        error.status = 0;
        throw error;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error || 'Something went wrong.');

        error.suggestions = data.suggestions ?? [];
        error.status = response.status;
        error.editorialUnavailable = data.editorialUnavailable ?? false;

        throw error;
    }

    return data
}
