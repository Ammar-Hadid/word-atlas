import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Download, Search, Trash2, X } from "lucide-react";

import WordChip from "../components/ui/WordChip.jsx";

import { useLibrary, useToast } from "../context/contexts.js";
import { FEATURED_WORDS } from "../data/words.js";
import { wordPath } from "../lib/platform.js";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const UNITS = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
];

const formatRelative = (timestamp, now) => {
    const elapsed = timestamp - now;
    const [unit, ms] = UNITS.find(([, size]) => Math.abs(elapsed) >= size) ?? ["minute", 1000 * 60];
    return relativeTime.format(Math.round(elapsed / ms), unit);
};

const escapeCsv = (value = "") => `"${String(value ?? "").replaceAll('"', '""')}"`;

const downloadCsv = (items) => {
    const rows = [
        ["word", "part_of_speech", "phonetic", "definition", "saved_at"],
        ...items.map(item => [item.word, item.partOfSpeech, item.phonetic, item.definition, new Date(item.savedAt).toISOString()]),
    ];
    const csv = rows.map(row => row.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "word-atlas-library.csv" });
    link.click();
    URL.revokeObjectURL(url);
};

const TABS = [
    { key: "saved", label: "Saved" },
    { key: "history", label: "History" },
];

const EmptyState = ({ tab }) => (
    <div className="flex flex-col items-start gap-lg rounded-3xl border border-dashed border-line-strong p-xl sm:p-2xl">
        <h2 className="display text-h3">
            {tab === "saved" ? <>Your atlas is <em className="italic text-accent">waiting.</em></> : "No journeys yet."}
        </h2>
        <p className="max-w-[28rem] text-body text-muted">
            {tab === "saved"
                ? "Press S on any entry, or tap the bookmark, to keep it here. Your library stays on this device."
                : "Words you look up appear here, so you can retrace your steps."}
        </p>
        <div className="flex flex-wrap gap-xs">
            {FEATURED_WORDS.slice(0, 6).map(word => <WordChip key={word} word={word} />)}
        </div>
    </div>
);

const LibraryPage = () => {
    const { saved, history, removeSaved, clearHistory } = useLibrary();
    const notify = useToast();
    const [tab, setTab] = useState("saved");
    const [filter, setFilter] = useState("");
    const [sort, setSort] = useState("recent");
    const [now] = useState(() => Date.now());

    useDocumentTitle("Library");

    const source = tab === "saved" ? saved : history;
    const normalizedFilter = filter.trim().toLowerCase();

    const items = source
        .filter(item => !normalizedFilter || `${item.word} ${item.definition ?? ""}`.toLowerCase().includes(normalizedFilter))
        .toSorted((a, b) => sort === "alpha"
            ? a.word.localeCompare(b.word)
            : (b.savedAt ?? b.visitedAt) - (a.savedAt ?? a.visitedAt));

    return (
        <div className="container-page flex flex-col gap-xl pt-2xl sm:pt-3xl">
            <header className="flex flex-col gap-lg border-b border-line pb-xl md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-sm">
                    <span className="eyebrow">Your library</span>
                    <h1 className="display text-h1 leading-none">
                        A personal <em className="italic text-accent">lexicon.</em>
                    </h1>
                </div>

                <dl className="flex gap-xl">
                    <div>
                        <dt className="eyebrow">Saved</dt>
                        <dd className="display text-h3 tabular-nums">{saved.length}</dd>
                    </div>
                    <div>
                        <dt className="eyebrow">Explored</dt>
                        <dd className="display text-h3 tabular-nums">{history.length}</dd>
                    </div>
                </dl>
            </header>

            <div className="flex flex-col gap-md md:flex-row md:items-center md:justify-between">
                <div role="tablist" aria-label="Library view" className="flex w-fit rounded-full border border-line bg-surface p-xs">
                    {TABS.map(item => (
                        <button
                            key={item.key}
                            role="tab"
                            type="button"
                            aria-selected={tab === item.key}
                            onClick={() => setTab(item.key)}
                            className={`relative rounded-full px-md py-[0.4rem] text-body-sm transition-colors ${tab === item.key ? "text-paper" : "text-muted hover:text-ink"}`}
                        >
                            {tab === item.key && (
                                <motion.span layoutId="library-tab" transition={{ type: "spring", stiffness: 420, damping: 36 }} className="absolute inset-0 rounded-full bg-ink" />
                            )}
                            <span className="relative">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-sm">
                    <label className="flex h-10 flex-1 items-center gap-sm rounded-full border border-line bg-surface px-md focus-within:border-ink md:w-64 md:flex-none">
                        <Search className="h-4 w-4 text-faint" strokeWidth={1.75} />
                        <span className="sr-only">Filter words</span>
                        <input
                            value={filter}
                            onChange={event => setFilter(event.target.value)}
                            placeholder="Filter…"
                            className="min-w-0 flex-1 bg-transparent text-body-sm outline-none placeholder:text-faint"
                        />
                    </label>

                    <label className="sr-only" htmlFor="library-sort">Sort</label>
                    <select
                        id="library-sort"
                        value={sort}
                        onChange={event => setSort(event.target.value)}
                        className="h-10 rounded-full border border-line bg-surface px-md text-body-sm outline-none focus:border-ink"
                    >
                        <option value="recent">Most recent</option>
                        <option value="alpha">A → Z</option>
                    </select>

                    {tab === "saved" && saved.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                downloadCsv(saved);
                                notify("Library exported as CSV");
                            }}
                            className="flex h-10 items-center gap-sm rounded-full bg-ink px-md text-body-sm text-paper transition-colors hover:bg-accent hover:text-accent-ink"
                        >
                            <Download className="h-4 w-4" strokeWidth={1.75} /> Export
                        </button>
                    )}

                    {tab === "history" && history.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                clearHistory();
                                notify("History cleared");
                            }}
                            className="flex h-10 items-center gap-sm rounded-full border border-line px-md text-body-sm text-muted transition-colors hover:border-ink hover:text-ink"
                        >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {source.length === 0 ? <EmptyState tab={tab} /> : (
                <ul className="flex flex-col border-t border-line">
                    <AnimatePresence initial={false}>
                        {items.map(item => (
                            <motion.li
                                key={`${tab}-${item.word}`}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -16 }}
                                transition={{ duration: 0.3 }}
                                className="group relative grid items-center gap-sm border-b border-line py-lg sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:gap-xl"
                            >
                                <Link to={wordPath(item.word)} className="flex flex-col after:absolute after:inset-0">
                                    <span className="display text-h4 leading-tight transition-colors group-hover:text-accent">{item.word}</span>
                                    <span className="flex items-baseline gap-sm text-body-sm text-muted">
                                        {item.partOfSpeech && <span className="display italic">{item.partOfSpeech}</span>}
                                        {item.phonetic && <span className="font-mono text-[0.75rem]">/{item.phonetic}/</span>}
                                    </span>
                                </Link>

                                <p className="line-clamp-2 max-w-[42rem] text-body text-muted">{item.definition}</p>

                                <div className="relative z-10 flex items-center gap-md sm:justify-end">
                                    <span className="font-mono text-[0.75rem] text-faint">
                                        {formatRelative(item.savedAt ?? item.visitedAt, now)}
                                    </span>
                                    {tab === "saved" ? (
                                        <button
                                            type="button"
                                            aria-label={`Remove ${item.word}`}
                                            onClick={() => {
                                                removeSaved(item.word);
                                                notify(`Removed “${item.word}”`);
                                            }}
                                            className="grid h-8 w-8 place-items-center rounded-full text-faint transition-colors hover:bg-sunken hover:text-ink"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    ) : (
                                        <ArrowUpRight className="h-4 w-4 text-faint transition-colors group-hover:text-accent" />
                                    )}
                                </div>
                            </motion.li>
                        ))}
                    </AnimatePresence>

                    {!items.length && (
                        <li className="py-xl text-body text-muted">Nothing matches &ldquo;{filter}&rdquo;.</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default LibraryPage;
