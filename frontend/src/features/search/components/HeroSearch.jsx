import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Search } from "lucide-react";

import Kbd from "../../../components/ui/Kbd.jsx";

import { useSuggestions } from "../hooks/useSuggestions.js";
import { useListNavigation } from "../../../lib/useListNavigation.js";
import { wordPath } from "../../../lib/platform.js";

const HighlightedSuggestion = ({ query, suggestion }) => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery || !suggestion.toLowerCase().startsWith(cleanQuery)) {
        return <span>{suggestion}</span>;
    }

    return (
        <span>
            <span className="text-faint">{suggestion.slice(0, cleanQuery.length)}</span>
            {suggestion.slice(cleanQuery.length)}
        </span>
    );
};

const HeroSearch = ({ size = "lg", autoFocus = false }) => {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef(null);
    const wrapperRef = useRef(null);

    const navigate = useNavigate();
    const { suggestions, isLoading } = useSuggestions(query);

    const go = (word) => {
        const trimmed = word.trim();
        if (!trimmed) return;
        setIsOpen(false);
        navigate(wordPath(trimmed));
    };

    const { activeIndex, setActiveIndex, onKeyDown } = useListNavigation(suggestions.length, index => go(suggestions[index]));

    useEffect(() => {
        if (autoFocus && window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
    }, [autoFocus]);

    useEffect(() => {
        const onPointerDown = (event) => {
            if (!wrapperRef.current?.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, []);

    const showList = isOpen && query.trim() && (suggestions.length > 0 || !isLoading);
    const isLarge = size === "lg";

    return (
        <form
            ref={wrapperRef}
            role="search"
            onSubmit={event => {
                event.preventDefault();
                go(activeIndex >= 0 ? suggestions[activeIndex] : query);
            }}
            className="relative w-full"
        >
            <label
                className={`flex items-center gap-base rounded-full border bg-surface shadow-soft transition-colors focus-within:border-ink ${showList ? "border-ink" : "border-line-strong"} ${isLarge ? "h-16 pl-lg pr-sm sm:h-[4.5rem]" : "h-14 pl-md pr-xs"}`}
            >
                <Search className={`${isLarge ? "h-5 w-5" : "h-4 w-4"} shrink-0 text-muted`} strokeWidth={1.75} />
                <span className="sr-only">Search for a word</span>
                <input
                    ref={inputRef}
                    value={query}
                    onChange={event => {
                        setQuery(event.target.value);
                        setIsOpen(true);
                        setActiveIndex(-1);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={event => {
                        if (event.key === "Escape") setIsOpen(false);
                        onKeyDown(event);
                    }}
                    placeholder="Search any English word…"
                    role="combobox"
                    aria-expanded={Boolean(showList)}
                    aria-controls="hero-suggestions"
                    aria-autocomplete="list"
                    aria-activedescendant={activeIndex >= 0 ? `hero-option-${activeIndex}` : undefined}
                    autoComplete="off"
                    spellCheck="false"
                    className={`min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint ${isLarge ? "text-body-lg sm:text-h5" : "text-body"}`}
                />
                {isLarge && !query && (
                    <span className="hidden items-center gap-xs text-body-sm text-faint sm:flex">
                        press <Kbd>/</Kbd> anywhere
                    </span>
                )}
                <button
                    type="submit"
                    aria-label="Search"
                    className={`grid shrink-0 place-items-center rounded-full bg-ink text-paper transition-colors hover:bg-accent hover:text-accent-ink ${isLarge ? "h-11 w-11 sm:h-12 sm:w-12" : "h-10 w-10"}`}
                >
                    <ArrowRight className="h-5 w-5" strokeWidth={1.75} />
                </button>
            </label>

            <AnimatePresence>
                {showList && (
                    <motion.ul
                        id="hero-suggestions"
                        role="listbox"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-x-0 top-full z-30 mt-sm overflow-hidden rounded-2xl border border-line-strong bg-surface p-xs shadow-soft"
                    >
                        {suggestions.map((suggestion, index) => (
                            <li
                                key={suggestion}
                                id={`hero-option-${index}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                onMouseMove={() => setActiveIndex(index)}
                                onClick={() => go(suggestion)}
                                className={`display flex cursor-pointer items-center justify-between rounded-xl px-md py-sm text-h5 transition-colors ${index === activeIndex ? "bg-sunken" : ""}`}
                            >
                                <HighlightedSuggestion query={query} suggestion={suggestion} />
                                {index === activeIndex && <ArrowRight className="h-4 w-4 text-accent" />}
                            </li>
                        ))}

                        {!suggestions.length && (
                            <li className="px-md py-sm text-body-sm text-muted">
                                No suggestions. Press enter to look up &ldquo;{query.trim()}&rdquo;.
                            </li>
                        )}
                    </motion.ul>
                )}
            </AnimatePresence>
        </form>
    );
};

export default HeroSearch;
