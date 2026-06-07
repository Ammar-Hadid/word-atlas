export const normalizeWord = (freeDictionaryData, audioUrl = null) => {
    const entries = Array.isArray(freeDictionaryData) ? freeDictionaryData : [];

    if (entries.length === 0) return null;

    const primaryEntry = entries[0];

    const phonetic = primaryEntry.phonetic || primaryEntry.phonetics
        ?.find(phonetic => phonetic.text)?.text ||
        ''

    const origin = entries.find(entry => entry.origin)?.origin ?? ''

    return {
        word: primaryEntry.word ?? '',
        phonetic,
        audioUrl,
        partsOfSpeech,
        meaningsByPartOfSpeech,
        origin,
    }
}