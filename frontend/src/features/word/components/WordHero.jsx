import { Link } from "react-router-dom";
import { motion } from "motion/react";

import AudioButton from "./AudioButton.jsx";
import WordActions from "./WordActions.jsx";

const getHeadwordSize = (word = "") => {
    if (word.length > 16) return "text-h1";
    if (word.length > 11) return "text-hero";
    return "text-mega";
};

const WordHero = ({ entries, activeIndex, onSelect, insights }) => {
    const entry = entries[activeIndex];
    const hasTabs = entries.length > 1;
    const syllables = entry.syllables?.length > 1 ? entry.syllables.join("·") : null;
    const definition = entry.senses?.flatMap(group => group.senses).find(sense => sense.definition)?.definition ?? null;

    return (
        <section className="relative overflow-hidden border-b border-line">
            <div className="atlas-grid pointer-events-none absolute inset-0" aria-hidden="true" />

            <span
                aria-hidden="true"
                className="display pointer-events-none absolute -right-8 -top-24 hidden select-none text-[28rem] italic leading-none text-ink/[0.035] lg:block"
            >
                {entry.word.charAt(0)}
            </span>

            <div className="container-page relative flex flex-col gap-xl pb-xl pt-2xl sm:pt-3xl">
                <nav aria-label="Breadcrumb" className="eyebrow flex items-center gap-sm">
                    <Link to="/" className="hover:text-ink">Atlas</Link>
                    <span className="text-faint">/</span>
                    <span>Entry</span>
                    <span className="text-faint">/</span>
                    <span className="text-ink">{entry.word}</span>
                </nav>

                <div className="flex flex-col gap-lg">
                    {entry.isOffensive && (
                        <span className="w-fit rounded-full border border-accent px-base py-2xs text-[0.75rem] font-medium uppercase tracking-wider text-accent">
                            Offensive
                        </span>
                    )}

                    <motion.h1
                        key={entry.word}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className={`display break-words leading-[0.95] ${getHeadwordSize(entry.word)}`}
                    >
                        {entry.word}
                    </motion.h1>

                    <div className="flex flex-wrap items-center gap-x-lg gap-y-sm font-mono text-body-sm text-muted">
                        {syllables && <span>{syllables}</span>}
                        {entry.phonetic && <span className="text-ink">/{entry.phonetic}/</span>}
                        {insights.syllableCount && (
                            <span>{insights.syllableCount} {insights.syllableCount === 1 ? "syllable" : "syllables"}</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-lg sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-md">
                        <AudioButton key={entry.id} word={entry.word} audio={entry.audio} shortcutKey="p" />

                        {hasTabs ? (
                            <div role="tablist" aria-label="Part of speech" className="flex rounded-full border border-line bg-surface p-xs">
                                {entries.map((item, index) => {
                                    const isActive = index === activeIndex;

                                    return (
                                        <button
                                            key={item.id}
                                            role="tab"
                                            type="button"
                                            aria-selected={isActive}
                                            onClick={() => onSelect(index)}
                                            className={`relative rounded-full px-md py-[0.4rem] text-body-sm transition-colors ${isActive ? "text-paper" : "text-muted hover:text-ink"}`}
                                        >
                                            {isActive && (
                                                <motion.span
                                                    layoutId="pos-tab"
                                                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                                                    className="absolute inset-0 rounded-full bg-ink"
                                                />
                                            )}
                                            <span className="relative">{item.partOfSpeech ?? "entry"}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            entry.partOfSpeech && (
                                <span className="display text-h5 italic text-muted">{entry.partOfSpeech}</span>
                            )
                        )}
                    </div>

                    <WordActions entry={entry} definition={definition} />
                </div>
            </div>
        </section>
    );
};

export default WordHero;
