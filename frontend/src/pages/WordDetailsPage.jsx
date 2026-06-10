import { useParams } from "react-router-dom";

import { useWordDetails } from "../features/word/hooks/useWordDetails.js";

import EntryCard from "../features/word/components/EntryCard.jsx";
import CompactEntryCard from "../features/word/components/CompactEntryCard.jsx";
import getDefinitionPreview from "../features/word/utils/getDefinitionPreview.js";

import EntryCardSkeleton from "../features/word/components/EntryCardSkeleton.jsx";

import NotFoundPage from "./NotFoundPage.jsx";


const WordDetailsPage = () => {
    const { wordId } = useParams();
    const { word, isLoading, error, suggestedWords } = useWordDetails(wordId);

    if (isLoading) {
        return (
            <div className="font-body flex flex-col gap-3xl">
                <EntryCardSkeleton />
                <EntryCardSkeleton />
                <EntryCardSkeleton />
            </div>
        )
    }

    if (error) {
        return <NotFoundPage query={wordId} suggestedWords={suggestedWords} />
    }

    const relatedEntries = word
        ?.slice(1)
        ?.filter(entry => getDefinitionPreview(entry).length > 0) ?? [];

    const hasRelatedEntries = relatedEntries.length > 0;

    return (
        <div className="font-body flex flex-col gap-3xl">

            <EntryCard entry={word?.[0]} />

            <div className="flex flex-col gap-md" >
                {hasRelatedEntries && <h2 className="text-h4 font-medium">Related definitions</h2>}
                <div>
                    {relatedEntries.map(entry => {
                        return <CompactEntryCard key={entry?.id} entry={entry} />
                    })}
                </div>
            </div >
        </div >
    );
};

export default WordDetailsPage;
