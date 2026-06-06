export const fetchWordData = async (word) => {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);

    if (response.status === 404) {
        throw new Error("WORD_NOT_FOUND");
    }

    if (!response.ok) {
        throw new Error("FAILED_TO_FETCH_WORD");
    }

    return await response.json();
}