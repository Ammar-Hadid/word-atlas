import { useState } from "react";

import { ChevronRight } from "lucide-react";

const PhraseSection = ({ phrases }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!phrases?.length) return null;

    const chevornStateStyles = isExpanded ? 'rotate-90' : 'rotate-0';
    const phrasesWrapperStateStyles = isExpanded ? 'max-h-1000 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-10'

    return (
        <div className="flex flex-col gap-md items-start">
            <button className="flex items-center gap-md border-t border-b border-primary/25 py-md cursor-pointer" onClick={() => setIsExpanded(prev => !prev)}>
                <span className="text-body font-semibold">Phrases</span>
                <ChevronRight className={`${chevornStateStyles} w-lg h-lg transition-transform duration-300 ease-in-out`} />
            </button>

            <div className={`${phrasesWrapperStateStyles} flex flex-col gap-md pl-md pb-lg items-start overflow-hidden transition-[max-height,opacity,translate] duration-300 ease-in-out`}>
                {phrases.map(phrase => {
                    return (
                        <p key={phrase?.id} className="flex flex-col lg:flex-row gap-0 lg:gap-sm items-start lg:items-center justify-start text-body-sm p-lg border border-primary/25 rounded-sm">
                            <span className="font-bold">{phrase?.phrase}{phrase.definition && ':'}</span>
                            {phrase?.definition}
                        </p>)
                })}
            </div>
        </div>
    )
}

export default PhraseSection;