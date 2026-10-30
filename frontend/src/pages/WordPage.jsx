import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";

import WordHero from "../features/word/components/WordHero.jsx";
import SourceNote from "../features/word/components/SourceNote.jsx";
import EditorialEntries from "../features/word/components/EditorialEntries.jsx";
import SenseList from "../features/word/components/SenseList.jsx";
import FormsList from "../features/word/components/FormsList.jsx";
import PhraseList from "../features/word/components/PhraseList.jsx";
import QuoteList from "../features/word/components/QuoteList.jsx";
import GlanceCard from "../features/word/components/GlanceCard.jsx";
import OriginCard from "../features/word/components/OriginCard.jsx";
import ThesaurusCard from "../features/word/components/ThesaurusCard.jsx";
import InsightCard from "../features/word/components/InsightCard.jsx";
import WordMap from "../features/word/components/WordMap.jsx";
import WordPageSkeleton from "../features/word/components/WordPageSkeleton.jsx";
import WordNotFound from "../features/word/components/WordNotFound.jsx";
import WordChip from "../components/ui/WordChip.jsx";
import Kbd from "../components/ui/Kbd.jsx";

import { useWordDetails } from "../features/word/hooks/useWordDetails.js";
import { useWordInsights } from "../features/word/hooks/useWordInsights.js";
import { getFirstDefinition, getHighlightTerms, splitEntries } from "../features/word/utils/entries.js";
import { useLibrary } from "../context/contexts.js";
import { modKey, wordPath } from "../lib/platform.js";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

const Section = ({ index, eyebrow, title, children }) => (
    <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-lg"
    >
        <header className="flex items-baseline gap-md border-b border-line pb-md">
            <span className="font-mono text-eyebrow text-accent">{String(index).padStart(2, "0")}</span>
            <div className="flex flex-1 flex-wrap items-baseline justify-between gap-sm">
                <h2 className="display text-h4">{title}</h2>
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            </div>
        </header>
        {children}
    </motion.section>
);

const WordEntry = ({ term, entries, quotes, insights, insightsLoading }) => {
    const { primary, related } = splitEntries(entries, term);
    const [activeIndex, setActiveIndex] = useState(0);

    const entry = primary[activeIndex] ?? primary[0];
    const terms = getHighlightTerms(entry);

    useDocumentTitle(entry?.word);

    if (!entry) return <WordNotFound query={term} />;

    const sections = [
        { key: "meaning", title: "Meaning", eyebrow: `${entry.partOfSpeech ?? "entry"}`, show: true, render: () => (
            <>
                <SourceNote source={entry.source} />
                {entry.requestedForm && <p className="text-body-sm text-muted">“{entry.requestedForm.form}” is a {entry.requestedForm.labels?.join(", ") || "form"} of <Link className="underline underline-offset-4 hover:text-ink" to={wordPath(entry.word)}>{entry.word}</Link>.</p>}
                {entry.formResolution && entry.formResolution.status !== "resolved" && <div className="flex flex-wrap items-center gap-xs text-body-sm text-muted">
                    <span>{entry.formResolution.status === "ambiguous" ? "Possible base entries:" : "A base entry could not be selected safely."}</span>
                    {(entry.formResolution.candidates ?? []).map((candidate, index) => <WordChip key={candidate.id ?? index} word={typeof candidate === "string" ? candidate : candidate.word} />)}
                </div>}
                <SenseList key={`senses-${entry.id}`} entry={entry} terms={terms} />
                {entry.source?.id === "wiktionary-en" && <EditorialEntries key={`editorial-${entry.id}`} entry={entry} />}
            </>
        ) },
        { key: "forms", title: "Forms", eyebrow: "Inflections", show: entry.forms?.length > 0, render: () => <FormsList forms={entry.forms} /> },
        { key: "phrases", title: "Phrases & idioms", eyebrow: `${entry.phrases?.length ?? 0} found`, show: entry.phrases?.length > 0, render: () => <PhraseList key={entry.id} phrases={entry.phrases} terms={terms} /> },
        { key: "quotes", title: "In the wild", eyebrow: "Published usage", show: quotes.length > 0, render: () => <QuoteList quotes={quotes} terms={terms} /> },
        {
            key: "related", title: "Related entries", eyebrow: null, show: related.length > 0, render: () => (
                <ul className="grid gap-sm sm:grid-cols-2">
                    {related.map(item => (
                        <li key={item.id}>
                            <Link to={wordPath(item.word)} className="flex h-full flex-col gap-xs rounded-xl border border-line bg-surface p-md transition-colors hover:border-ink">
                                <span className="flex items-baseline gap-sm">
                                    <span className="display text-h5">{item.word}</span>
                                    {item.partOfSpeech && <span className="display text-body italic text-muted">{item.partOfSpeech}</span>}
                                </span>
                                <span className="line-clamp-2 text-body-sm text-muted">{getFirstDefinition(item)}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ),
        },
    ].filter(section => section.show);

    return (
        <>
            <WordHero entries={primary} activeIndex={activeIndex} onSelect={setActiveIndex} insights={insights} />

            <div className="container-page grid gap-2xl py-2xl lg:grid-cols-12 lg:gap-3xl lg:py-3xl">
                <div className="flex min-w-0 flex-col gap-3xl lg:col-span-8">
                    {sections.map((section, index) => (
                        <Section key={section.key} index={index + 1} title={section.title} eyebrow={section.eyebrow}>
                            {section.render()}
                        </Section>
                    ))}
                </div>

                <aside className="flex flex-col gap-md lg:sticky lg:top-24 lg:col-span-4 lg:self-start">
                    <GlanceCard entry={entry} entries={primary} insights={insights} isLoading={insightsLoading} />
                    <OriginCard entry={entry} entries={primary} />
                    <ThesaurusCard insights={insights} isLoading={insightsLoading} />
                    <InsightCard eyebrow="Shortcuts" className="hidden lg:flex">
                        <ul className="flex flex-col gap-sm text-body-sm text-muted">
                            <li className="flex items-center justify-between">Listen <Kbd>P</Kbd></li>
                            <li className="flex items-center justify-between">Save to library <Kbd>S</Kbd></li>
                            <li className="flex items-center justify-between">Search <span className="flex gap-2xs"><Kbd>{modKey}</Kbd><Kbd>K</Kbd></span></li>
                        </ul>
                    </InsightCard>
                </aside>
            </div>

            <section className="container-page flex flex-col gap-lg">
                <header className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-xs">
                        <span className="eyebrow">The atlas</span>
                        <h2 className="display text-h2 leading-none">
                            The world around <em className="italic text-accent">{entry.word}</em>
                        </h2>
                    </div>
                    <p className="max-w-[24rem] text-body-sm text-muted">
                        Words orbit by closeness of meaning. Follow a thread to see how language connects.
                    </p>
                </header>

                <WordMap word={entry.word} insights={insights} isLoading={insightsLoading} />

                {insights.rhymes.length > 0 && (
                    <div className="flex flex-col gap-sm pt-md sm:flex-row sm:items-baseline sm:gap-lg">
                        <span className="eyebrow shrink-0">Rhymes with</span>
                        <div className="flex flex-wrap gap-xs">
                            {insights.rhymes.map(word => <WordChip key={word} word={word} variant="ghost" />)}
                        </div>
                    </div>
                )}
            </section>
        </>
    );
};

const WordPage = () => {
    const { term = "" } = useParams();
    const { entries, quotes, error, suggestedWords, isLoading } = useWordDetails(term);
    const { insights, isLoading: insightsLoading } = useWordInsights(term);
    const { recordVisit } = useLibrary();
    const lastVisit = useRef(null);
    useEffect(() => {
        if (!term) return;
        if (lastVisit.current?.term !== term) lastVisit.current = { term, operationId: crypto.randomUUID(), visitedAt: Date.now() };
        // The same submitted navigation has one key, including StrictMode's
        // effect replay. Misses are history too; autocomplete never comes here.
        void recordVisit({ word: term, ...lastVisit.current });
    }, [term, recordVisit]);

    // On success the entry sets its own title.
    useDocumentTitle(isLoading ? term : "Not found", isLoading || Boolean(error));

    if (isLoading) return <WordPageSkeleton />;

    if (error) {
        return <WordNotFound query={term} suggestedWords={suggestedWords} isNetworkError={error.status === 0 || error.status >= 500} editorialUnavailable={error.editorialUnavailable} />;
    }

    return (
        <WordEntry
            key={term}
            term={term}
            entries={entries}
            quotes={quotes}
            insights={insights}
            insightsLoading={insightsLoading}
        />
    );
};

export default WordPage;
