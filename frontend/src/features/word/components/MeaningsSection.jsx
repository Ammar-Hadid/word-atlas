import MeaningItem from "./MeaningItem.jsx";

const MeaningsSection = ({ meanings }) => {
    if (!meanings?.length) return null;

    return (
        <section className="py-xl">
            <h2 className="mb-lg font-display text-h5 font-bold">Meanings</h2>

            <div className="flex max-w-248 flex-col gap-2xl">
                {meanings.map((meaning, index) => (
                    <MeaningItem
                        key={`${meaning.partOfSpeech}-${meaning.definition}`}
                        meaning={meaning}
                        index={index}
                    />
                ))}
            </div>
        </section>
    );
};

export default MeaningsSection;