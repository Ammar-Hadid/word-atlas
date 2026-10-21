import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bookmark, Clock, CornerDownLeft, Library, Search, Shuffle, SunMoon } from "lucide-react";

import Kbd from "../ui/Kbd.jsx";

import { useLibrary, useTheme } from "../../context/contexts.js";
import { useSuggestions } from "../../features/search/hooks/useSuggestions.js";
import { useListNavigation } from "../../lib/useListNavigation.js";
import { getRandomWord } from "../../data/words.js";
import { wordPath } from "../../lib/platform.js";

const buildGroups = ({ query, suggestions, history, saved }) => {
    const trimmed = query.trim();

    if (trimmed) {
        const lookups = [trimmed, ...suggestions.filter(word => word.toLowerCase() !== trimmed.toLowerCase())];

        return [{
            label: "Words",
            items: lookups.map((word, index) => ({
                id: `word-${word}`,
                icon: index === 0 ? Search : ArrowRight,
                label: word,
                hint: index === 0 ? "Look up" : null,
                word,
            })),
        }];
    }

    const groups = [];

    if (history.length) {
        groups.push({
            label: "Recent",
            items: history.slice(0, 4).map(item => ({ id: `recent-${item.word}`, icon: Clock, label: item.word, hint: item.partOfSpeech, word: item.word })),
        });
    }

    if (saved.length) {
        groups.push({
            label: "Saved",
            items: saved.slice(0, 3).map(item => ({ id: `saved-${item.word}`, icon: Bookmark, label: item.word, hint: item.partOfSpeech, word: item.word })),
        });
    }

    groups.push({
        label: "Actions",
        items: [
            { id: "surprise", icon: Shuffle, label: "Surprise me", hint: "Random word", action: "surprise" },
            { id: "library", icon: Library, label: "Open your library", action: "library" },
            { id: "theme", icon: SunMoon, label: "Change theme", action: "theme" },
        ],
    });

    return groups;
};

const CommandPalette = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && <PalettePanel onClose={onClose} />}
        </AnimatePresence>
    );
};

const PalettePanel = ({ onClose }) => {
    const [query, setQuery] = useState("");
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const navigate = useNavigate();
    const location = useLocation();
    const { history, saved } = useLibrary();
    const { cycleTheme } = useTheme();
    const { suggestions, isLoading } = useSuggestions(query, { delay: 120 });

    const groups = buildGroups({ query, suggestions, history, saved });
    const items = groups.flatMap(group => group.items);

    const runItem = (item) => {
        if (item.word) navigate(wordPath(item.word));
        if (item.action === "surprise") navigate(wordPath(getRandomWord()));
        if (item.action === "library") navigate("/library");
        if (item.action === "theme") return cycleTheme();
        onClose();
    };

    const { activeIndex, setActiveIndex, onKeyDown } = useListNavigation(items.length, index => runItem(items[index]));

    // Close when the route changes underneath the palette (e.g. browser back).
    const [initialPath] = useState(location.pathname);
    useEffect(() => {
        if (location.pathname !== initialPath) onClose();
    }, [location.pathname, initialPath, onClose]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        inputRef.current?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    const handleKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
        }
        onKeyDown(event);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-md pt-[12vh]" onKeyDown={handleKeyDown}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={onClose}
                className="absolute inset-0 bg-ink/25 backdrop-blur-sm dark:bg-black/60"
            />

            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Search Word Atlas"
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-[36rem] overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-soft"
            >
                <div className="flex items-center gap-base border-b border-line px-lg">
                    <Search className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.75} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={event => {
                            setQuery(event.target.value);
                            setActiveIndex(event.target.value.trim() ? 0 : -1);
                        }}
                        placeholder="Search for a word…"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="command-list"
                        aria-activedescendant={activeIndex >= 0 ? items[activeIndex]?.id : undefined}
                        autoComplete="off"
                        spellCheck="false"
                        className="h-14 flex-1 bg-transparent text-body-lg text-ink outline-none placeholder:text-faint"
                    />
                    {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent" />}
                    <Kbd>esc</Kbd>
                </div>

                <div ref={listRef} id="command-list" role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto p-sm">
                    {groups.map(group => (
                        <div key={group.label} className="py-xs">
                            <p className="eyebrow px-base pb-xs pt-sm">{group.label}</p>
                            {group.items.map(item => {
                                const index = items.indexOf(item);
                                const isActive = index === activeIndex;
                                const Icon = item.icon;

                                return (
                                    <button
                                        key={item.id}
                                        id={item.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isActive}
                                        data-active={isActive}
                                        onMouseMove={() => setActiveIndex(index)}
                                        onClick={() => runItem(item)}
                                        className={`flex w-full items-center gap-base rounded-lg px-base py-sm text-left transition-colors ${isActive ? "bg-sunken text-ink" : "text-ink/80"}`}
                                    >
                                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-faint"}`} strokeWidth={1.75} />
                                        <span className={item.word ? "display text-h5" : "text-body"}>{item.label}</span>
                                        {item.hint && <span className="ml-auto text-body-sm text-faint">{item.hint}</span>}
                                        {isActive && <CornerDownLeft className={`${item.hint ? "ml-sm" : "ml-auto"} h-3.5 w-3.5 text-faint`} />}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="hidden items-center gap-lg border-t border-line bg-paper/60 px-lg py-sm text-[0.75rem] text-faint sm:flex">
                    <span className="flex items-center gap-xs"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
                    <span className="flex items-center gap-xs"><Kbd>↵</Kbd> open</span>
                    <span className="ml-auto">Word Atlas</span>
                </div>
            </motion.div>
        </div>
    );
};

export default CommandPalette;
