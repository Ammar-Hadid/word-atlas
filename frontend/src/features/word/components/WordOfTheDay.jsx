import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

import AudioButton from "./AudioButton.jsx";

import { useWordDetails } from "../hooks/useWordDetails.js";
import { getFirstDefinition, splitEntries, getHighlightTerms } from "../utils/entries.js";
import highlightTerms from "../utils/highlightTerms.jsx";
import { wordPath } from "../../../lib/platform.js";

const formatDate = (date) => date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

const WordOfTheDay = ({ word, date }) => {
    const { entries, isLoading } = useWordDetails(word);

    const entry = entries ? splitEntries(entries, word).primary[0] : null;
    const definition = getFirstDefinition(entry);
    const example = entry?.senses?.flatMap(group => group.senses).find(sense => sense.examples.length)?.examples[0];

    return (
        <article className="group relative flex h-full flex-col justify-between gap-2xl overflow-hidden dark rounded-3xl border border-line bg-surface p-xl text-ink sm:p-2xl">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl transition-transform duration-1000 group-hover:scale-125" />

            <div className="relative flex items-center justify-between gap-md">
                <span className="font-mono text-eyebrow uppercase tracking-[0.14em] text-ink/60">Word of the day</span>
                <span className="font-mono text-eyebrow uppercase tracking-[0.14em] text-ink/60">{formatDate(date)}</span>
            </div>

            <div className="relative flex flex-col gap-lg">
                <div className="flex flex-col gap-sm">
                    <h2 className="display text-hero leading-none">{word}</h2>
                    <div className="flex min-h-6 flex-wrap items-center gap-md font-mono text-body-sm text-ink/60">
                        {isLoading ? <span className="h-4 w-48 animate-pulse rounded bg-ink/10" /> : (
                            <>
                                {entry?.partOfSpeech && <span className="display text-body-lg italic text-ink/80">{entry.partOfSpeech}</span>}
                                {entry?.phonetic && <span>/{entry.phonetic}/</span>}
                            </>
                        )}
                    </div>
                </div>

                <div className="min-h-20 max-w-[42rem]">
                    {isLoading ? (
                        <div className="flex flex-col gap-sm">
                            <span className="h-5 w-full animate-pulse rounded bg-ink/10" />
                            <span className="h-5 w-2/3 animate-pulse rounded bg-ink/10" />
                        </div>
                    ) : (
                        <>
                            {definition && <p className="text-body-lg leading-relaxed text-ink/90">{definition}</p>}
                            {example && (
                                <p className="display mt-sm text-body-lg italic text-ink/60 [&_mark]:text-accent">
                                    {highlightTerms(example, getHighlightTerms(entry))}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="relative flex items-center justify-between gap-md">
                {entry ? (
                    <AudioButton word={word} audio={entry.audio} />
                ) : <span />}

                <Link
                    to={wordPath(word)}
                    className="flex items-center gap-xs rounded-full border border-ink/20 px-md py-sm text-body-sm transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                >
                    Open entry <ArrowUpRight className="h-4 w-4" />
                </Link>
            </div>
        </article>
    );
};

export default WordOfTheDay;
