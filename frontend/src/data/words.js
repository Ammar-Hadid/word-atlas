// Hand-picked words used for the Word of the Day, curated collections and
// "Surprise me". Every word here resolves in the Learner's Dictionary.
export const FEATURED_WORDS = [
    "serendipity", "ephemeral", "eloquent", "resilient", "luminous", "meticulous",
    "candor", "nostalgia", "ubiquitous", "pragmatic", "tenacious", "whimsical",
    "solace", "euphoria", "epiphany", "labyrinth", "quintessential", "gregarious",
    "juxtapose", "paradigm", "catalyst", "poignant", "reverie", "sublime",
    "zeal", "cadence", "ambiguous", "benevolent", "cogent", "diligent",
    "empathy", "frugal", "jubilant", "lucid", "momentum", "nuance",
    "oblivion", "quaint", "radiant", "serene", "tranquil", "vivid",
    "wistful", "zenith", "eclectic", "ethereal", "melancholy", "panorama",
    "horizon", "voyage", "astute", "audacious", "enigma", "fervent",
];

export const COLLECTIONS = [
    {
        id: "wonder",
        title: "Words for wonder",
        description: "For the moments that stop you mid-sentence.",
        words: ["serendipity", "ethereal", "luminous", "reverie", "sublime", "epiphany"],
    },
    {
        id: "boardroom",
        title: "The boardroom",
        description: "Precise language for decisive rooms.",
        words: ["leverage", "pragmatic", "catalyst", "paradigm", "momentum", "synergy"],
    },
    {
        id: "feeling",
        title: "Of feeling",
        description: "The vocabulary of the inner weather.",
        words: ["melancholy", "nostalgia", "euphoria", "wistful", "solace", "poignant"],
    },
    {
        id: "minds",
        title: "Sharp minds",
        description: "Words that think as clearly as you do.",
        words: ["lucid", "cogent", "astute", "meticulous", "nuance", "candor"],
    },
];

const DAY_MS = 1000 * 60 * 60 * 24;

export const getWordOfTheDay = (date = new Date()) => {
    const localMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const dayIndex = Math.floor(localMidnight / DAY_MS);

    return FEATURED_WORDS[dayIndex % FEATURED_WORDS.length];
};

export const getRandomWord = (exclude) => {
    const pool = FEATURED_WORDS.filter(word => word !== exclude);
    return pool[Math.floor(Math.random() * pool.length)];
};
