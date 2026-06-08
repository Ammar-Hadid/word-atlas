import { Volume2 } from "lucide-react";

import PillList from "../../../components/ui/PillList.jsx";

const WordSummary = ({ word, phonetic, audio, partsOfSpeech }) => {
    return (
        <section className="border-b border-primary/15 py-3xl">
            <div className="flex items-center gap-lg">
                <h1 className="font-display text-h1 font-bold leading-none text-primary">
                    {word}
                </h1>

                {audio && (
                    <button
                        type="button"
                        aria-label={`Play pronunciation for ${word}`}
                        className="flex h-2xl w-2xl items-center justify-center rounded-full bg-card text-primary transition-colors duration-200 ease-in-out hover:bg-primary hover:text-secondary cursor-pointer"
                    >
                        <Volume2 strokeWidth={1.8} className="h-lg w-lg" />
                    </button>
                )}
            </div>

            {phonetic && (
                <p className="mt-lg text-h5 text-primary-muted">{phonetic}</p>
            )}

            {partsOfSpeech?.length > 0 && (
                <div className="mt-sm">
                    <PillList items={partsOfSpeech} />
                </div>
            )}
        </section>
    );
};

export default WordSummary;