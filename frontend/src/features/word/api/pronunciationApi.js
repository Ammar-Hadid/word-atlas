import { hasCsrfToken, libraryRequest, readSession } from '../../../lib/libraryApi.js';

export const getPronunciationAudio = (id, signal) => libraryRequest(`/pronunciations/${encodeURIComponent(id)}/audio`, { signal });

export const preparePronunciationAudio = async (id, signal) => {
    // A word page can ask for a recording before the session check on load has finished.
    if (!hasCsrfToken()) await readSession();
    return libraryRequest(`/pronunciations/${encodeURIComponent(id)}/audio`, { method: 'POST', signal });
};
