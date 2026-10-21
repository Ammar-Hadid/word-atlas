// Small in-memory TTL cache. Dictionary data rarely changes, and caching
// keeps us well under the Merriam-Webster rate limits.
const createCache = ({ ttl = 1000 * 60 * 60 * 6, max = 500 } = {}) => {
    const store = new Map();

    const get = (key) => {
        const hit = store.get(key);

        if (!hit) return undefined;

        if (Date.now() > hit.expiresAt) {
            store.delete(key);
            return undefined;
        }

        // Refresh recency so the oldest untouched key is evicted first.
        store.delete(key);
        store.set(key, hit);

        return hit.value;
    };

    const set = (key, value) => {
        if (store.size >= max) {
            store.delete(store.keys().next().value);
        }

        store.set(key, { value, expiresAt: Date.now() + ttl });
    };

    return { get, set };
};

export default createCache;
