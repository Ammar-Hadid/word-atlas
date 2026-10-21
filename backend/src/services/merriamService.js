import createCache from "../utils/createCache.js";

const BASE_URL = "https://www.dictionaryapi.com/api/v3/references";

const DICTIONARIES = {
    learners: "MERRIAM_WEBSTER_LEARNERS",
    collegiate: "MERRIAM_WEBSTER_DICTIONARY",
};

const cache = createCache();

const fetchFromDictionary = async (dictionary, term) => {
    const key = process.env[DICTIONARIES[dictionary]];

    if (!key) {
        throw new Error(`Merriam-Webster ${dictionary} API key is missing.`);
    }

    const cacheKey = `${dictionary}:${term.toLowerCase()}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    const url = `${BASE_URL}/${dictionary}/json/${encodeURIComponent(term)}?key=${key}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Something went wrong.');
    }

    const data = await response.json();

    cache.set(cacheKey, data);

    return data;
};

const fetchWord = (term) => fetchFromDictionary("learners", term);

export const fetchCollegiateWord = (term) => fetchFromDictionary("collegiate", term);

export default fetchWord;
