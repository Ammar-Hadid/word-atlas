const BASE_URL = "https://www.dictionaryapi.com/api/v3/references/learners/json"

const fetchWord = async (term) => {
    const key = process.env.MERRIAM_WEBSTER_LEARNERS

    if (!key) {
        throw new Error("Merriam-Webster API key is missing.");
    }

    const url = `${BASE_URL}/${encodeURIComponent(term)}?key=${key}`

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error('Something went wrong.');
    }

    return await response.json();
}

export default fetchWord;