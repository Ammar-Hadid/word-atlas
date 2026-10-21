const API_URL = import.meta.env.VITE_API_URL

export const fetchWordData = async (word) => {
    const trimmedWord = word?.trim();

    if (!trimmedWord) {
        throw new Error("Term is required.");
    }

    const normalizedWord = encodeURIComponent(trimmedWord);

    let response;

    try {
        response = await fetch(`${API_URL}/words?term=${normalizedWord}`);
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

        throw error;
    }

    return data
}
