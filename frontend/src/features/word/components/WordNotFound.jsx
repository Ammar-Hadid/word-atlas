import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RotateCw } from "lucide-react";

import WordChip from "../../../components/ui/WordChip.jsx";
import HeroSearch from "../../search/components/HeroSearch.jsx";

import { fetchSuggestions } from "../../search/api/datamuseApi.js";

const WordNotFound = ({ query, suggestedWords = [], isNetworkError = false }) => {
    const [spellings, setSpellings] = useState({ query: null, words: [] });

    // Merriam-Webster's suggestions are validated server-side; Datamuse's
    // spelling suggestions fill in when there are none.
    useEffect(() => {
        if (suggestedWords.length || isNetworkError) return;

        const controller = new AbortController();

        fetchSuggestions(query, { signal: controller.signal })
            .then(words => setSpellings({ query, words: words.filter(word => word.toLowerCase() !== query.toLowerCase()) }))
            .catch(() => { });

        return () => controller.abort();
    }, [query, suggestedWords.length, isNetworkError]);

    const suggestions = suggestedWords.length
        ? suggestedWords
        : spellings.query === query ? spellings.words : [];

    return (
        <section className="relative z-10">
            <div className="atlas-grid pointer-events-none absolute inset-0" aria-hidden="true" />

            <div className="container-page relative flex min-h-[60vh] flex-col items-start justify-center gap-xl py-3xl">
                <span className="eyebrow">{isNetworkError ? "Connection issue" : "Uncharted territory"}</span>

                <h1 className="display max-w-[56rem] text-h1 leading-[1.05]">
                    {isNetworkError ? (
                        <>We couldn&rsquo;t reach the dictionary.</>
                    ) : (
                        <>No entry for <em className="italic text-accent">&ldquo;{query}&rdquo;</em> on our map.</>
                    )}
                </h1>

                <p className="max-w-[36rem] text-body-lg text-muted">
                    {isNetworkError
                        ? "Check your connection, then try again."
                        : "It may be misspelled, very new, or a proper noun. Try one of these nearby words, or search again."}
                </p>

                {isNetworkError && (
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-sm rounded-full bg-ink px-lg py-sm text-body-sm text-paper hover:bg-accent hover:text-accent-ink"
                    >
                        <RotateCw className="h-4 w-4" /> Try again
                    </button>
                )}

                {suggestions.length > 0 && (
                    <div className="flex flex-col gap-sm">
                        <span className="text-body-sm text-muted">Did you mean</span>
                        <div className="flex flex-wrap gap-xs">
                            {suggestions.slice(0, 6).map(word => <WordChip key={word} word={word} />)}
                        </div>
                    </div>
                )}

                <div className="w-full max-w-[36rem]">
                    <HeroSearch size="md" autoFocus={false} />
                </div>

                <Link to="/" className="text-body-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
                    Back to the atlas
                </Link>
            </div>
        </section>
    );
};

export default WordNotFound;
