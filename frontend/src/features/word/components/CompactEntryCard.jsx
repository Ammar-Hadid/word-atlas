import { useState } from "react";

import DefinitionPreview from "./DefinitionPreview.jsx";
import FormsSection from "./FormSection.jsx";
import PhraseSection from "./PhrasesSection.jsx";

import CompactEntryHeader from "./CompactEntryHeader.jsx";

import { ChevronRight } from "lucide-react";

const CompactEntryCard = ({ entry }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!entry.senses.length) return null;
    const { word, audio, phonetic, partOfSpeech, isOffensive, forms, labels, senses, phrases } = entry;

    const chevronStateStyles = isExpanded ? 'rotate-90' : 'rotate-0';
    const wordDataWrapperStateStyles = isExpanded ? 'max-h-1000 opacity-100' : 'opacity-0 max-h-0'

    return (
        <div className="flex flex-col gap-lg group/card py-md border-y border-primary/25">
            <div className="flex gap-md">
                <button onClick={() => setIsExpanded(prev => !prev)} className="border-0 bg-transparent cursor-pointer">
                    <ChevronRight
                        strokeWidth={1}
                        className={`${chevronStateStyles} w-2xl h-2xl opacity-0 text-primary group-hover/card:opacity-100 transition duration-300 ease-in-out`} />
                </button>
                <CompactEntryHeader
                    word={word}
                    audio={audio}
                    phonetic={phonetic}
                    partOfSpeech={partOfSpeech}
                    isOffensive={isOffensive}
                />
            </div>

            <div className={`${wordDataWrapperStateStyles} flex flex-col gap-lg justify-start items-start pl-md overflow-hidden transition-[max-height,opacity,translate] duration-300 ease-in-out`}>
                <DefinitionPreview entry={entry} />

                <FormsSection forms={forms} />

                <PhraseSection phrases={phrases} />
            </div>
        </div>
    )
}

export default CompactEntryCard;