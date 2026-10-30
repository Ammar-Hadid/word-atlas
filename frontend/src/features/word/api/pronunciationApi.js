import { libraryRequest } from '../../../lib/libraryApi.js';

export const getPronunciationAudio = (id,signal) => libraryRequest(`/pronunciations/${encodeURIComponent(id)}/audio`,{signal});
export const preparePronunciationAudio = (id,signal) => libraryRequest(`/pronunciations/${encodeURIComponent(id)}/audio`,{method:'POST',signal});
