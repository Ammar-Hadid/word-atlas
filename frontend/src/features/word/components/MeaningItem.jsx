import WordRelationCard from "./WordRelationCard.jsx";


const MeaningItem = ({ meaning, index }) => {
    const hasSynonyms = meaning.synonyms?.length > 0;
    const hasAntonyms = meaning.antonyms?.length > 0;
    const hasRelations = hasSynonyms || hasAntonyms;

    return (
        <article className="flex flex-col gap-lg">
            <div className="grid grid-cols-[auto_1fr] gap-x-sm gap-y-sm">
                <p className="text-body font-bold">{index + 1}.</p>
                <h3 className="font-display text-body font-bold">
                    {meaning.partOfSpeech}
                </h3>

                <div className="col-start-2 flex flex-col gap-xs">
                    {meaning.definition && (
                        <p className="text-body text-primary">
                            {meaning.definition}
                        </p>
                    )}

                    {meaning.example && (
                        <p className="text-body-sm italic text-primary-muted">
                            "{meaning.example}"
                        </p>
                    )}
                </div>
            </div>

            {hasRelations && (
                <div className="grid max-w-248 grid-cols-1 gap-lg md:grid-cols-2">
                    <WordRelationCard
                        title="Synonyms"
                        words={meaning.synonyms}
                        limit={5}
                    />

                    <WordRelationCard
                        title="Antonyms"
                        words={meaning.antonyms}
                        limit={4}
                    />
                </div>
            )}
        </article>
    );
};

export default MeaningItem