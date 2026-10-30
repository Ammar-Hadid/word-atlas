import cleanMarkup from "./cleanMarkup.js";
import buildMerriamAudioUrl from "./buildMerriamAudioUrl.js";
import { normalizeMerriamTerm } from "./getMatchingLearnersEntries.js";

const array = value => Array.isArray(value) ? value : [];
const text = value => cleanMarkup(value);
const headword = value => normalizeMerriamTerm(text(value));
const labels = value => [...array(value.lbs), ...array(value.sls), value.psl, value.spl].map(text).filter(Boolean);
const unique = items => [...new Set(items)];

export const normalizePronunciations = (values = []) => array(values).filter(Boolean).map((value, index) => ({
    // Editorial pronunciation IDs are source references, never synthesis IDs.
    sourceId: value.sound?.audio ?? `variant-${index + 1}`,
    phonetic: value.ipa ?? value.mw ?? null,
    alphabet: value.ipa ? "ipa" : value.mw ? "mw" : null,
    labels: [value.l, value.l2].map(text).filter(Boolean),
    audio: typeof value.sound?.audio === "string" ? buildMerriamAudioUrl(value.sound.audio) : null,
}));

const pronunciationFields = values => {
    const pronunciations = normalizePronunciations(values);
    return { pronunciations, phonetic: pronunciations[0]?.phonetic ?? null, audio: pronunciations[0]?.audio ?? null };
};

const phraseForms = entry => [entry.phrasev?.phr, ...array(entry.sphrasev?.phrs)].filter(Boolean)
    .map(item => ({ form: headword(item.pva), label: text(item.pvl) || "phrasal verb",
        labels: array(entry.sphrasev?.phsls).map(text).filter(Boolean) })).filter(item => item.form);

const normalizeForms = (entry) => [
    ...array(entry.ins).map(item => ({ ...item, value: item.if, label: item.il })),
    ...array(entry.vrs).map(item => ({ ...item, value: item.va, label: item.vl || "variant" })),
    ...array(entry.ahws).map(item => ({ ...item, value: item.hw, label: item.psl || "alternate spelling" })),
].map(item => ({ form: headword(item.value), label: text(item.label) || null,
    ...pronunciationFields(item.prs) })).filter(item => item.form);

export const normalizeQuote = value => {
    const quote = { text: text(value?.t), author: text(value?.aq?.auth) || null,
        source: text(value?.aq?.source) || null, date: text(value?.aq?.aqdate) || null,
        subsource: value?.aq?.subsource ? { source: text(value.aq.subsource.source) || null, date: text(value.aq.subsource.aqdate) || null } : null };
    return quote.text ? quote : null;
};

// Keep every source text segment and its example associations. The legacy UI
// uses definition/examples; content preserves ordering and attribution as well.
function normalizeDefinitionText(dt) {
    const content = [];
    const definition = [];
    const examples = [];
    const exampleDetails = [];
    const usageNotes = [];
    const grammar = [];
    for (const item of array(dt)) {
        if (!Array.isArray(item)) continue;
        const [type, value] = item;
        if (type === "text") {
            const cleaned = text(value);
            if (cleaned) { definition.push(cleaned); content.push({ type, text: cleaned }); }
        } else if (type === "vis") {
            const values = array(value).map(normalizeQuote).filter(Boolean);
            examples.push(...values.map(item => item.text));
            exampleDetails.push(...values);
            content.push({ type, examples: values });
        } else if (type === "wsgram") {
            const cleaned = text(value);
            if (cleaned) { grammar.push(cleaned); content.push({ type, text: cleaned }); }
        } else if (["uns", "snote", "snotebox"].includes(type)) {
            const groups = array(value);
            const sections = typeof groups[0]?.[0] === "string" ? [groups] : groups;
            for (const section of sections) {
                // Supplemental notes use "t" where defining text uses "text".
                const note = normalizeDefinitionText(array(section).map(pair =>
                    Array.isArray(pair) && pair[0] === "t" ? ["text", pair[1]] : pair));
                if (note.definition || note.examples.length) usageNotes.push({ note: note.definition,
                    examples: note.examples, exampleDetails: note.exampleDetails });
            }
        } else if (type === "ca") {
            const note = [text(value?.intro), ...array(value?.cats).map(item => text(item.cat))].filter(Boolean).join(" ");
            if (note) usageNotes.push({ note, examples: [] });
        } else if (type === "ri") {
            for (const runIn of array(value)) {
                const normalized = normalizeDefinitionText(runIn.dt);
                const label = headword(runIn.rin);
                if (label || normalized.definition) usageNotes.push({
                    note: [label, normalized.definition].filter(Boolean).join(": "), examples: normalized.examples,
                });
            }
        }
    }
    return { definition: definition.join(" ") || null, examples, exampleDetails, usageNotes,
        grammar: unique(grammar).join("; ") || null, content };
}

function normalizeSense(value, id, inheritedGrammar) {
    const detail = normalizeDefinitionText([...array(value.dt), ...(value.snotebox ? [["snotebox", value.snotebox]] : [])]);
    return { id, order: value.sn ?? null, ...detail,
        grammar: unique([text(value.sgram), text(value.gram), inheritedGrammar, detail.grammar].filter(Boolean)).join("; ") || null,
        labels: labels(value), forms: [...normalizeForms(value), ...phraseForms(value)], pronunciations: normalizePronunciations(value.prs),
        heading: text(value.bnote) || null,
        divider: text(value.sd) || null };
}

export function normalizeDefinitions(definitions, entryId) {
    const groups = [];
    for (const [blockIndex, block] of array(definitions).entries()) {
        for (const [groupIndex, sequence] of array(block.sseq).entries()) {
            const group = { heading: block.vd ? { order: null, heading: text(block.vd) } : null, senses: [] };
            let senseIndex = 0;
            let context = {};
            const addSense = value => {
                const id = `${entryId}-sense-${blockIndex + 1}-${groupIndex + 1}-${++senseIndex}`;
                const sense = normalizeSense({ ...context, ...value }, id, text(block.vd));
                sense.labels = unique([...labels(block), ...labels(context), ...sense.labels]);
                if (sense.definition || sense.examples.length || sense.usageNotes.length) group.senses.push(sense);
                if (value.sdsense) addSense(value.sdsense);
            };
            const visit = items => {
                for (const item of array(items)) {
                    if (!Array.isArray(item)) continue;
                    const [type, value] = item;
                    if (type === "sense") addSense(value ?? {});
                    else if (type === "bs") addSense(value?.sense ?? {});
                    else if (type === "pseq") visit(value);
                    else if (type === "sen") {
                        context = value ?? {};
                        group.heading = { ...normalizeSense(context, `${entryId}-heading-${groupIndex}`, text(block.vd)),
                            order: value?.sn ?? null, heading: text(value?.bnote ?? value?.sgram) || null };
                    }
                }
            };
            visit(sequence);
            if (group.heading || group.senses.length) groups.push(group);
        }
    }
    return groups;
}

export function normalizeMerriamEntry(entry, reference) {
    const sourceId = entry.meta?.id ?? headword(entry.hwi?.hw);
    const id = `mw-${reference}:${sourceId}`;
    const word = headword(entry.hwi?.hw);
    const source = { id: `mw-${reference}`, name: reference === "learners" ? "Merriam-Webster Learner’s" : "Merriam-Webster Collegiate",
        referenceId: sourceId, uuid: entry.meta?.uuid ?? null, storage: "live-only",
        url: `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}` };
    const senses = normalizeDefinitions(entry.def, id);
    const shortDefinitions = array(entry.shortdef).map(text).filter(Boolean);
    // Some valid cross-reference entries contain only shortdef.
    if (!senses.some(group => group.senses.length)) senses.push({ heading: null,
        senses: shortDefinitions.map((definition, index) => ({ id: `${id}-short-${index}`, order: null,
            definition, examples: [], exampleDetails: [], usageNotes: [], grammar: null, labels: [] })) });
    const phrases = array(entry.dros).map((phrase, index) => {
        const phraseId = `${id}-phrase-${index + 1}`;
        const phraseSenses = normalizeDefinitions(phrase.def, phraseId);
        const first = phraseSenses.flatMap(group => group.senses).find(sense => sense.definition);
        return { id: phraseId, phrase: headword(phrase.drp),
            type: phrase.phrasev || phrase.sphrasev ? "phrasal verb" : text(phrase.gram) || null,
            labels: unique([...labels(phrase), ...array(phrase.phsls).map(text)]),
            definition: first?.definition ?? null, examples: first?.examples ?? [], senses: phraseSenses,
            forms: [...normalizeForms(phrase), ...phraseSenses.flatMap(group => group.senses.flatMap(sense => sense.forms))],
            ...pronunciationFields(phrase.prs), source };
    }).filter(phrase => phrase.phrase);
    return { id, word, source, sourceReference: sourceId,
        syllables: text(entry.hwi?.hw).split("*").filter(Boolean), homograph: entry.hom ?? null,
        ...pronunciationFields([...array(entry.hwi?.prs), ...array(entry.hwi?.altprs)]),
        partOfSpeech: text(entry.fl) || null, isOffensive: Boolean(entry.meta?.offensive),
        forms: normalizeForms(entry), labels: labels(entry), shortDefinitions, senses, phrases,
        stems: array(entry.meta?.stems).map(headword).filter(Boolean),
        derived: array(entry.uros).map(item => ({ word: headword(item.ure), partOfSpeech: text(item.fl) || null,
            forms: normalizeForms(item), ...pronunciationFields(item.prs) })),
        etymology: array(entry.et).filter(pair => pair[0] === "text").map(pair => text(pair[1])).filter(Boolean).join(" ") || null,
        firstKnownUse: text(entry.date) || null,
        quotes: array(entry.quotes).map(normalizeQuote).filter(Boolean).map(quote => ({ ...quote, entryId: id, dictionarySource: source })),
        target: entry.meta?.target ?? null,
    };
}

// A phrase search should open the phrase's meanings, not the parent headword's.
export function selectRequestedPhrases(entries, term) {
    const query = normalizeMerriamTerm(term);
    const matches = value => normalizeMerriamTerm(value).toLowerCase() === query.toLowerCase();
    return entries.flatMap(entry => {
        if (matches(entry.word)) return [entry];
        const phrases = entry.phrases.filter(phrase => matches(phrase.phrase) || phrase.forms.some(form => matches(form.form)));
        return phrases.length ? phrases.map(phrase => ({
            ...entry, ...phrase, id: phrase.id, word: phrase.phrase, parentEntryId: entry.id,
            partOfSpeech: phrase.type ?? "phrase", shortDefinitions: phrase.definition ? [phrase.definition] : [],
            syllables: [phrase.phrase], homograph: null, phrases: [], quotes: [],
            // Parent etymologies and pronunciations are not phrase data.
            etymology: null, firstKnownUse: null, target: null,
        })) : [entry];
    });
}
