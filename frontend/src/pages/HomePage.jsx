import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, AudioLines, BookMarked, Network, ScrollText } from "lucide-react";

import HeroSearch from "../features/search/components/HeroSearch.jsx";
import WordOfTheDay from "../features/word/components/WordOfTheDay.jsx";
import WordChip from "../components/ui/WordChip.jsx";
import Kbd from "../components/ui/Kbd.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";

import { useCommand, useLibrary } from "../context/contexts.js";
import { COLLECTIONS, getWordOfTheDay } from "../data/words.js";
import { modKey, wordPath } from "../lib/platform.js";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

const TRY_WORDS = ["serendipity", "ephemeral", "resilient", "luminous"];

const FEATURES = [
    { icon: AudioLines, title: "Hear it", text: "Studio recordings from Merriam-Webster, with a synthesised voice for everything else." },
    { icon: ScrollText, title: "Trace it", text: "Etymology, first known use and quotations from published writing." },
    { icon: Network, title: "Map it", text: "An interactive constellation of synonyms, related words and associations." },
    { icon: BookMarked, title: "Keep it", text: "Save words to your library, revisit your history and export it anytime." },
];

const reveal = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const HomePage = () => {
    const [today] = useState(() => new Date());
    const wordOfTheDay = getWordOfTheDay(today);
    const { history } = useLibrary();
    const { openPalette } = useCommand();

    useDocumentTitle(null);

    return (
        <>
            <section className="relative z-10">
                <div className="atlas-grid pointer-events-none absolute inset-0" aria-hidden="true" />

                <div className="container-page relative grid items-stretch gap-2xl pb-3xl pt-2xl sm:pt-4xl lg:grid-cols-12 lg:gap-3xl">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col justify-center gap-xl lg:col-span-7"
                    >
                        <span className="eyebrow flex items-center gap-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            A modern lexicon
                        </span>

                        <h1 className="display text-hero leading-[0.95]">
                            Every word,
                            <br />
                            <em className="italic text-accent">beautifully</em> mapped.
                        </h1>

                        <p className="max-w-[32rem] text-body-lg leading-relaxed text-muted">
                            Definitions, pronunciation, origins and the web of meaning
                            around every word, arranged with the care of a fine atlas.
                        </p>

                        <div className="flex max-w-[42rem] flex-col gap-md">
                            <HeroSearch autoFocus />
                            <div className="flex flex-wrap items-center gap-xs text-body-sm text-muted">
                                <span className="mr-xs">Try</span>
                                {TRY_WORDS.map(word => <WordChip key={word} word={word} variant="ghost" />)}
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 32 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="lg:col-span-5"
                    >
                        <WordOfTheDay word={wordOfTheDay} date={today} />
                    </motion.div>
                </div>
            </section>

            <section className="container-page">
                <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
                    {FEATURES.map(({ icon: Icon, title, text }, index) => (
                        <motion.div
                            key={title}
                            {...reveal}
                            transition={{ ...reveal.transition, delay: index * 0.08 }}
                            className="flex flex-col gap-sm bg-paper p-lg"
                        >
                            <div className="flex items-center justify-between">
                                <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
                                <span className="font-mono text-eyebrow text-faint">0{index + 1}</span>
                            </div>
                            <h2 className="display text-h5">{title}</h2>
                            <p className="text-body-sm leading-relaxed text-muted">{text}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {history.length > 0 && (
                <motion.section {...reveal} className="container-page flex flex-col gap-lg pt-3xl">
                    <SectionHeading
                        eyebrow="Pick up where you left off"
                        title="Recently explored"
                        action={
                            <Link to="/library" className="flex items-center gap-xs text-body-sm text-muted hover:text-ink">
                                Library <ArrowRight className="h-4 w-4" />
                            </Link>
                        }
                    />
                    <div className="flex flex-wrap gap-xs">
                        {history.slice(0, 12).map(item => <WordChip key={item.word} word={item.word} />)}
                    </div>
                </motion.section>
            )}

            <section className="container-page flex flex-col gap-xl pt-3xl">
                <SectionHeading eyebrow="Curated" title="Collections worth knowing" />

                <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
                    {COLLECTIONS.map((collection, index) => (
                        <motion.article
                            key={collection.id}
                            {...reveal}
                            transition={{ ...reveal.transition, delay: index * 0.08 }}
                            className="group flex flex-col gap-lg rounded-2xl border border-line bg-surface p-lg transition-colors duration-300 hover:border-line-strong"
                        >
                            <div className="flex items-start justify-between gap-md">
                                <div className="flex flex-col gap-xs">
                                    <h3 className="display text-h5">{collection.title}</h3>
                                    <p className="text-body-sm text-muted">{collection.description}</p>
                                </div>
                                <span className="display text-h3 italic leading-none text-faint transition-colors group-hover:text-accent">
                                    {index + 1}
                                </span>
                            </div>
                            <ul className="mt-auto flex flex-col divide-y divide-line border-t border-line">
                                {collection.words.map(word => (
                                    <li key={word}>
                                        <Link
                                            to={wordPath(word)}
                                            className="group/link flex items-center justify-between py-sm text-body transition-colors hover:text-accent"
                                        >
                                            {word}
                                            <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover/link:translate-x-0 group-hover/link:opacity-100" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </motion.article>
                    ))}
                </div>
            </section>

            <motion.section {...reveal} className="container-page pt-3xl">
                <div className="relative flex flex-col items-start gap-lg overflow-hidden rounded-3xl border border-line bg-surface p-xl sm:flex-row sm:items-center sm:justify-between sm:p-2xl">
                    <div className="atlas-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
                    <div className="relative flex flex-col gap-sm">
                        <span className="eyebrow">Keyboard first</span>
                        <h2 className="display text-h3">Any word, two keystrokes away.</h2>
                        <p className="max-w-[28rem] text-body text-muted">
                            Open search from anywhere, then press <Kbd>P</Kbd> to hear a word and <Kbd>S</Kbd> to save it.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={openPalette}
                        className="relative flex items-center gap-md rounded-full bg-ink py-sm pl-lg pr-sm text-body text-paper transition-colors hover:bg-accent hover:text-accent-ink"
                    >
                        Open search
                        <span className="flex gap-2xs rounded-full bg-paper/15 px-sm py-xs font-mono text-body-sm">
                            {modKey} K
                        </span>
                    </button>
                </div>
            </motion.section>
        </>
    );
};

export default HomePage;
