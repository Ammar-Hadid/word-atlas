export const normalizeWord = (freeDictionaryData, audioUrl = null) => {
    const entries = Array.isArray(freeDictionaryData) ? freeDictionaryData : [];

    if (entries.length === 0) return null;

    const primaryEntry = entries[0];
    const allMeanings = entries.flatMap(entry => entry.meanings) ?? [];
    const partsOfSpeech = [...new Set(allMeanings.map(meaning => meaning.partOfSpeech).filter(Boolean))]

    const meaningsByPartOfSpeech = partsOfSpeech.map(partOfSpeech => {
        const matchedMeanings = allMeanings.filter(meaning => meaning.partOfSpeech === partOfSpeech);

        const meanings = matchedMeanings.flatMap(meaning => {
            return (meaning.definitions ?? []).map(definition => (
                {
                    definition: definition.definition ?? "",
                    example: definition.example ?? "",
                    synonyms: definition.synonyms ?? [],
                    antonyms: definition.antonyms ?? [],
                }
            ))
        })

        return {
            partOfSpeech,
            meanings
        }
    })

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