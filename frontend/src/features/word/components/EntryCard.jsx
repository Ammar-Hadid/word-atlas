import EntryHeader from "./EntryHeader.jsx";
import DefinitionPreview from "./DefinitionPreview.jsx";

import FormsSection from "./FormSection.jsx"
import PhraseSection from "./PhrasesSection.jsx";

const EntryCard = ({ entry }) => {
    if (!entry?.senses?.length) return null;
    const { word, audio, phonetic, partOfSpeech, isOffensive, forms, labels, senses, phrases } = entry;

    return (
        <div className="flex flex-col gap-lg font-body">
            <EntryHeader
                word={word}
                audio={audio}
                phonetic={phonetic}
                partOfSpeech={partOfSpeech}
                isOffensive={isOffensive}
            />

            <DefinitionPreview entry={entry} />

            <FormsSection forms={forms} />

            <PhraseSection phrases={phrases} />
        </div>
    )
}

export default EntryCard;