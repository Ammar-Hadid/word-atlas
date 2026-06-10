const API_URL = import.meta.env.VITE_API_URL

export const fetchWordData = async (word) => {
    if (!word) {
        throw new Error('Term is required.')
    }

    const trimmedWord = word?.trim();

    if (!trimmedWord) {
        throw new Error("Term is required.");
    }

    const normalizedWord = encodeURIComponent(trimmedWord);

    const response = await fetch(`${API_URL}/words?term=${normalizedWord}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong.');
    }

    return data
}