import buildMerriamAudioUrl from "./buildMerriamAudioUrl.js";

const cleanText = (text = "") => {
    return text
        .replaceAll("{bc}", "")
        .replaceAll("{it}", "")
        .replaceAll("{/it}", "")
        .replaceAll("{phrase}", "")
        .replaceAll("{/phrase}", "")
        .replace(/\{\/?[^}]+\}/g, "")
        .replace(/\s+/g, " ")
        .trim();
};

const cleanHeadword = (word = "") => {
    return cleanText(word).replaceAll("*", "");
};

const normalizeExamples = (examples = []) => {
    return examples
        .map((example) => cleanText(example?.t ?? ""))
        .filter(Boolean);
};

const normalizePronunciation = (pronunciation) => {
    if (!pronunciation) {
        return {
            phonetic: null,
            audio: null,
        };
    }

    return {
        phonetic: pronunciation?.ipa ?? null,
        audio: buildMerriamAudioUrl(pronunciation?.sound?.audio) ?? null,
    };
};

const normalizeForms = (forms = []) => {
    return forms
        .map((form) => {
            const pronunciation = form?.prs?.[0];

            return {
                form: cleanHeadword(form?.if ?? ""),
                label: cleanText(form?.il ?? "") || null,
                ...normalizePronunciation(pronunciation),
            };
        })
        .filter((form) => form.form);
};

const normalizeUsageNotes = (usageNotes = []) => {
    const normalizedUsageNotes = [];

    for (const usageSection of usageNotes) {
        const normalizedUsageNote = {
            note: null,
            examples: [],
        };

        normalizedUsageNote.note =
            cleanText(
                usageSection.find(([unsType]) => unsType === "text")?.[1] ?? ""
            ) || null;

        for (const [unsType, unsContent] of usageSection) {
            if (unsType === "vis") {
                normalizedUsageNote.examples = normalizeExamples(unsContent);
            }
        }

        if (normalizedUsageNote.note || normalizedUsageNote.examples.length > 0) {
            normalizedUsageNotes.push(normalizedUsageNote);
        }
    }

    return normalizedUsageNotes;
};

const normalizeSenseContent = (content = {}, fallbackId = "") => {
    const normalizedSense = {
        id: fallbackId,
        order: content?.sn ?? null,
        definition: null,
        examples: [],
        usageNotes: [],
        grammar: cleanText(content?.sgram ?? "") || null,
        labels: content?.sls ?? [],
    };

    const definition = content?.dt?.find(([dtType]) => dtType === "text")?.[1];

    normalizedSense.definition = cleanText(definition ?? "") || null;

    for (const [dtType, dtContent] of content?.dt ?? []) {
        if (dtType === "vis") {
            normalizedSense.examples = normalizeExamples(dtContent);
        }

        if (dtType === "uns") {
            normalizedSense.usageNotes = normalizeUsageNotes(dtContent);
        }
    }

    return normalizedSense;
};

const normalizeSenseGroups = (sseq = [], entryId = "") => {
    const normalizedGroups = [];

    for (const [groupIndex, senseGroup] of sseq.entries()) {
        const normalizedGroup = {
            heading: null,
            senses: [],
        };

        for (const [senseIndex, senseItem] of senseGroup.entries()) {
            const [type, content] = senseItem;

            if (type === "sen") {
                normalizedGroup.heading = {
                    order: content?.sn ?? null,
                    heading: cleanText(content?.bnote ?? "") || null,
                };
            }

            if (type === "sense") {
                const senseId = `${entryId}-sense-${groupIndex + 1}-${senseIndex + 1}`;
                const normalizedSense = normalizeSenseContent(content, senseId);

                if (
                    normalizedSense.definition ||
                    normalizedSense.examples.length > 0 ||
                    normalizedSense.usageNotes.length > 0
                ) {
                    normalizedGroup.senses.push(normalizedSense);
                }
            }
        }

        if (normalizedGroup.heading || normalizedGroup.senses.length > 0) {
            normalizedGroups.push(normalizedGroup);
        }
    }

    return normalizedGroups;
};

const normalizePhrase = (phraseEntry = {}, phraseIndex = 0) => {
    const phraseId = `${phraseEntry?.drp?.[0] ?? "phrase"}-${phraseIndex + 1}`;

    const senses = normalizeSenseGroups(
        phraseEntry?.def?.[0]?.sseq ?? [],
        phraseId
    );

    const firstSense = senses
        .flatMap((group) => group.senses)
        .find((sense) => sense.definition || sense.examples.length > 0);

    return {
        id: phraseId,
        phrase: cleanText(phraseEntry?.drp ?? "") || null,
        type: cleanText(phraseEntry?.gram ?? "") || null,
        labels: phraseEntry?.sls ?? [],
        definition: firstSense?.definition ?? null,
        examples: firstSense?.examples ?? [],
        senses,
    };
};

const normalizePhrases = (phrases = []) => {
    return phrases
        .map((phraseEntry, index) => normalizePhrase(phraseEntry, index))
        .filter((phrase) => phrase.phrase);
};

const normalizeLearnersResponse = (wordArr) => {
    if (!Array.isArray(wordArr) || wordArr.length < 1) {
        throw new Error("Term is required to normalize.");
    }

    const normalizedWordArrs = wordArr.map((entry) => {
        const entryId = entry?.meta?.id ?? null;
        const pronunciation = entry?.hwi?.prs?.[0] ?? entry?.hwi?.altprs?.[0];

        const normalizedPronunciation = normalizePronunciation(pronunciation);

        return {
            id: entryId,
            word: cleanHeadword(entry?.hwi?.hw ?? ""),
            homograph: entry?.hom ?? null,

            audio: normalizedPronunciation.audio,
            phonetic: normalizedPronunciation.phonetic,

            partOfSpeech: entry?.fl ?? null,
            isOffensive: entry?.meta?.offensive ?? false,

            forms: normalizeForms(entry?.ins ?? []),
            labels: entry?.sls ?? [],

            shortDefinitions: entry?.shortdef?.map(cleanText).filter(Boolean) ?? [],

            senses: normalizeSenseGroups(entry?.def?.[0]?.sseq ?? [], entryId),

            phrases: normalizePhrases(entry?.dros ?? []),
        };
    });

    return normalizedWordArrs;
};

export default normalizeLearnersResponse;