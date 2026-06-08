const BASE_AUDIO_URL = "https://media.merriam-webster.com/audio/prons/en/us/mp3";

const buildMerriamAudioUrl = (audioId) => {
    if (!audioId) {
        return null;
    }

    let subdirectory;

    if (audioId.startsWith("bix")) {
        subdirectory = "bix";
    } else if (audioId.startsWith("gg")) {
        subdirectory = "gg";
    } else if (/^[^a-zA-Z]/.test(audioId)) {
        subdirectory = "number";
    } else {
        subdirectory = audioId[0];
    }

    return `${BASE_AUDIO_URL}/${subdirectory}/${audioId}.mp3`;
};

export default buildMerriamAudioUrl;